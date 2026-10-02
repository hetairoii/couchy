"""Predicts which upcoming doses are likely to be late (> 30 min) or missed, using TabPFN.

TabPFN is a tabular foundation model: it needs no training loop, so a couple of dozen labeled
doses are enough. If it is not installed or there is too little history, we return None and the
app simply skips the extra pre-reminder.
"""
import logging

import pandas as pd

log = logging.getLogger("couchy.tabpfn")
MIN_LABELED = 30
LATE_MINUTES = 30


def build_table(doses: list[dict]) -> pd.DataFrame:
    """One row per dose with features that are known *before* the dose happens."""
    df = pd.DataFrame(doses).sort_values("scheduled_at").reset_index(drop=True)
    df["scheduled_at"] = pd.to_datetime(df["scheduled_at"])
    df["taken_at"] = pd.to_datetime(df["taken_at"])
    delay = (df["taken_at"] - df["scheduled_at"]).dt.total_seconds() / 60
    df["late"] = ((df["status"] != "taken") | (delay > LATE_MINUTES)).astype(int)
    df["hour"] = df["scheduled_at"].dt.hour
    df["weekday"] = df["scheduled_at"].dt.weekday
    df["delay"] = delay.where(df["status"] == "taken", 120.0)  # a missed dose counts as a long delay
    for i in (1, 2, 3):
        df[f"prev_delay_{i}"] = df.groupby("medication_id")["delay"].shift(i)
    df["prev_snoozes"] = df.groupby("medication_id")["snooze_count"].shift(1)
    return df


FEATURES = ["hour", "weekday", "prev_delay_1", "prev_delay_2", "prev_delay_3", "prev_snoozes"]


def predict_late_risk(history: list[dict], upcoming: list[dict]) -> dict[str, float] | None:
    """Returns {dose_id: probability_late}, or None when TabPFN is unavailable or history is too short."""
    done = [d for d in history if d["status"] in ("taken", "missed", "skipped")]
    if len(done) < MIN_LABELED:
        return None
    try:
        from tabpfn import TabPFNClassifier
    except ImportError:
        log.info("tabpfn not installed; skipping risk prediction")
        return None

    table = build_table(done + upcoming)
    known = table.iloc[: len(done)].dropna(subset=["prev_delay_1"])
    if known["late"].nunique() < 2 or len(known) < 10:
        return None
    x_train, y_train = known[FEATURES].fillna(0), known["late"]
    clf = TabPFNClassifier(device="cpu")
    clf.fit(x_train, y_train)
    future = table.iloc[len(done):]
    probs = clf.predict_proba(future[FEATURES].fillna(0))[:, 1]
    return {str(i): round(float(p), 2) for i, p in zip(future["id"], probs)}
