from datetime import datetime, timedelta

import pytest

from app.agent import companion as agent
from app.models import Device, DoseEvent, Medication
from app.watchdog import jobs

NOW = datetime(2026, 10, 3, 12, 0)


@pytest.fixture(autouse=True)
def no_llm(monkeypatch):
    async def fake(alert_type, name, facts):
        return f"{alert_type}:{name}"
    monkeypatch.setattr(agent, "alert_text", fake)


def make_device(session, **kw) -> Device:
    d = Device(id="d1", api_key="k", preferred_name="Rose", **kw)
    session.add(d)
    session.add(Medication(id="m1", device_id="d1", name="Metformin", dosage="500mg"))
    session.commit()
    return d


def collector():
    sent = []

    async def send(device, text):
        sent.append(text)
    return sent, send


async def test_missed_dose_alerts_once(session):
    make_device(session, grace_minutes=60)
    session.add(DoseEvent(id="x1", device_id="d1", medication_id="m1", scheduled_at=NOW - timedelta(minutes=90)))
    session.add(DoseEvent(id="x2", device_id="d1", medication_id="m1", scheduled_at=NOW - timedelta(minutes=30)))
    session.commit()
    sent, send = collector()
    assert await jobs.check_missed_doses(session, NOW, send) == 1
    assert sent == ["missed_dose:Rose"]
    assert session.get(DoseEvent, "x1").status == "missed"
    assert session.get(DoseEvent, "x2").status == "pending"  # still within grace
    assert await jobs.check_missed_doses(session, NOW, send) == 0  # no duplicate


async def test_inactivity_alert_and_dedupe(session):
    make_device(session, inactivity_hours=3, last_activity=NOW - timedelta(hours=4))
    sent, send = collector()
    assert await jobs.check_inactivity(session, NOW, send) == 1
    assert await jobs.check_inactivity(session, NOW, send) == 0


async def test_no_inactivity_alert_when_recent(session):
    make_device(session, inactivity_hours=3, last_activity=NOW - timedelta(hours=1))
    sent, send = collector()
    assert await jobs.check_inactivity(session, NOW, send) == 0


async def test_quiet_hours_silence_inactivity(session):
    night = datetime(2026, 10, 3, 2, 0)
    make_device(session, inactivity_hours=3, last_activity=night - timedelta(hours=5))
    sent, send = collector()
    assert await jobs.check_inactivity(session, night, send) == 0


def test_quiet_hours_wraparound_and_timezone(session):
    d = make_device(session, tz_offset_minutes=-300)  # UTC-5
    assert jobs.in_quiet_hours(d, datetime(2026, 10, 3, 3, 30))   # 22:30 local
    assert not jobs.in_quiet_hours(d, datetime(2026, 10, 3, 15, 0))  # 10:00 local
