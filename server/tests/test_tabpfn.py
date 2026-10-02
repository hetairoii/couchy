from datetime import datetime, timedelta

from app.analytics.tabpfn_risk import build_table, predict_late_risk

BASE = datetime(2026, 9, 1, 20, 0)


def dose(i: int, delay: int | None):
    sched = BASE + timedelta(days=i)
    return {"id": f"d{i}", "medication_id": "m1", "scheduled_at": sched, "status": "taken" if delay is not None else "missed",
            "taken_at": sched + timedelta(minutes=delay) if delay is not None else None, "snooze_count": 0}


def test_build_table_labels_and_lags():
    t = build_table([dose(0, 5), dose(1, 50), dose(2, None), dose(3, 0)])
    assert list(t["late"]) == [0, 1, 1, 0]
    assert t.loc[1, "prev_delay_1"] == 5
    assert t.loc[3, "prev_delay_1"] == 120  # the missed dose counts as a long delay


def test_too_little_history_returns_none():
    assert predict_late_risk([dose(i, 5) for i in range(10)], [dose(11, None)]) is None
