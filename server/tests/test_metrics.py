from datetime import datetime, timedelta

from app.analytics.metrics import compute_metrics, daily_series, week_over_week

BASE = datetime(2026, 10, 1, 8, 0)


def dose(day: int, hour: int, delay: int | None, status: str = "taken", snoozes: int = 0, source: str = "button"):
    sched = BASE.replace(hour=hour) + timedelta(days=day)
    return {
        "scheduled_at": sched, "reminded_at": sched,
        "taken_at": sched + timedelta(minutes=delay) if delay is not None else None,
        "status": status, "snooze_count": snoozes, "source": source,
    }


def test_basic_metrics():
    doses = [dose(0, 8, 5), dose(0, 20, 50), dose(1, 8, 0, source="voice"), dose(1, 20, None, "missed")]
    r = compute_metrics(doses)
    assert r["total_doses"] == 4
    assert r["adherence_rate"] == 75.0
    assert r["on_time_rate"] == 50.0  # only the 5 and 0 minute delays are within 30 min
    assert r["mean_delay_min"] == 18.3
    assert r["missed"] == 1
    assert r["voice_replies_pct"] == 33.3
    assert r["worst_time_slot"] == "evening"


def test_empty_is_safe():
    r = compute_metrics([])
    assert r["total_doses"] == 0 and r["adherence_rate"] is None and r["worst_time_slot"] is None


def test_week_over_week():
    now = BASE + timedelta(days=14)
    doses = [dose(1, 8, 0), dose(2, 8, None, "missed"),   # previous week: 50%
             dose(8, 8, 0), dose(9, 8, 0)]                 # this week: 100%
    r = week_over_week(doses, now)
    assert r == {"this_week": 100.0, "previous_week": 50.0, "delta": 50.0}


def test_daily_series():
    out = daily_series([dose(0, 8, 0), dose(0, 20, None, "missed"), dose(1, 8, 0)])
    assert out == [{"day": "2026-10-01", "total": 2, "taken": 1}, {"day": "2026-10-02", "total": 1, "taken": 1}]
