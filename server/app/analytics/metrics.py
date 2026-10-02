"""Adherence analytics. Pure pandas; the LLM never computes numbers."""
import pandas as pd

ON_TIME_MINUTES = 30
COLUMNS = ["scheduled_at", "reminded_at", "taken_at", "status", "snooze_count", "source"]


def to_frame(doses: list[dict]) -> pd.DataFrame:
    df = pd.DataFrame(doses, columns=COLUMNS)
    for col in ("scheduled_at", "reminded_at", "taken_at"):
        df[col] = pd.to_datetime(df[col])
    df["delay_min"] = (df["taken_at"] - df["scheduled_at"]).dt.total_seconds() / 60
    df["response_min"] = (df["taken_at"] - df["reminded_at"]).dt.total_seconds() / 60
    return df


def _pct(num: float, den: float) -> float | None:
    return round(100 * num / den, 1) if den else None


def _round(x) -> float | None:
    return None if pd.isna(x) else round(float(x), 1)


def _slot(hour: int) -> str:
    return "morning" if hour < 12 else "afternoon" if hour < 18 else "evening"


def compute_metrics(doses: list[dict]) -> dict:
    """doses: dicts with scheduled_at/reminded_at/taken_at (datetime|None), status, snooze_count, source."""
    df = to_frame(doses)
    total = len(df)
    taken = df[df["status"] == "taken"]
    on_time = taken[taken["delay_min"].abs() <= ON_TIME_MINUTES]

    worst_slot = None
    if total:
        df = df.assign(slot=df["scheduled_at"].dt.hour.map(_slot))
        bad = df.assign(bad=(df["status"] != "taken") | (df["delay_min"] > ON_TIME_MINUTES))
        rates = bad.groupby("slot")["bad"].mean()
        if rates.max() > 0:
            worst_slot = rates.idxmax()

    return {
        "total_doses": total,
        "taken": len(taken),
        "missed": int((df["status"] == "missed").sum()),
        "skipped": int((df["status"] == "skipped").sum()),
        "adherence_rate": _pct(len(taken), total),
        "on_time_rate": _pct(len(on_time), total),
        "mean_delay_min": _round(taken["delay_min"].mean()),
        "median_delay_min": _round(taken["delay_min"].median()),
        "delay_std_min": _round(taken["delay_min"].std()),
        "mean_response_min": _round(taken["response_min"].mean()),
        "snoozes_per_dose": _round(df["snooze_count"].mean()) if total else None,
        "voice_replies_pct": _pct(int((taken["source"] == "voice").sum()), len(taken)),
        "worst_time_slot": worst_slot,
    }


def week_over_week(doses: list[dict], now) -> dict:
    """Adherence this week vs the previous one."""
    df = to_frame(doses)
    this_start, prev_start = now - pd.Timedelta(days=7), now - pd.Timedelta(days=14)

    def rate(mask) -> float | None:
        part = df[mask]
        return _pct(int((part["status"] == "taken").sum()), len(part))

    cur = rate(df["scheduled_at"] >= this_start)
    prev = rate((df["scheduled_at"] >= prev_start) & (df["scheduled_at"] < this_start))
    delta = None if cur is None or prev is None else round(cur - prev, 1)
    return {"this_week": cur, "previous_week": prev, "delta": delta}


def daily_series(doses: list[dict]) -> list[dict]:
    df = to_frame(doses)
    if df.empty:
        return []
    df["day"] = df["scheduled_at"].dt.strftime("%Y-%m-%d")
    out = []
    for day, g in df.groupby("day"):
        out.append({"day": day, "total": len(g), "taken": int((g["status"] == "taken").sum())})
    return out
