"""Watchdog: missed doses and inactivity. `send` is injected so the logic is testable."""
from datetime import datetime, timedelta

from sqlmodel import Session, select

from app.agent import companion
from app.models import Alert, Device, DoseEvent, Medication


def in_quiet_hours(device: Device, now: datetime) -> bool:
    local = now + timedelta(minutes=device.tz_offset_minutes)
    t = local.strftime("%H:%M")
    start, end = device.quiet_start, device.quiet_end
    return (start <= t or t < end) if start > end else (start <= t < end)


def _already_alerted(session: Session, device_id: str, kind: str, ref_id: str) -> bool:
    return session.exec(select(Alert).where(
        Alert.device_id == device_id, Alert.kind == kind, Alert.ref_id == ref_id)).first() is not None


def _record(session: Session, device_id: str, kind: str, ref_id: str) -> None:
    session.add(Alert(device_id=device_id, kind=kind, ref_id=ref_id))
    session.commit()


async def check_missed_doses(session: Session, now: datetime, send) -> int:
    sent = 0
    for device in session.exec(select(Device)).all():
        limit = now - timedelta(minutes=device.grace_minutes)
        doses = session.exec(select(DoseEvent).where(
            DoseEvent.device_id == device.id, DoseEvent.scheduled_at <= limit,
            DoseEvent.status.in_(["pending", "snoozed"]))).all()
        for dose in doses:
            dose.status = "missed"
            session.add(dose)
            session.commit()
            if _already_alerted(session, device.id, "missed_dose", dose.id):
                continue
            med = session.get(Medication, dose.medication_id)
            local = dose.scheduled_at + timedelta(minutes=device.tz_offset_minutes)
            text = await companion.alert_text("missed_dose", device.preferred_name or "Your loved one", {
                "medication": med.name if med else "a medication",
                "scheduled_time": local.strftime("%H:%M"),
                "minutes_late": int((now - dose.scheduled_at).total_seconds() // 60),
            })
            await send(device, text)
            _record(session, device.id, "missed_dose", dose.id)
            sent += 1
    return sent


async def check_inactivity(session: Session, now: datetime, send) -> int:
    sent = 0
    for device in session.exec(select(Device)).all():
        if in_quiet_hours(device, now):
            continue
        idle = now - device.last_activity
        if idle < timedelta(hours=device.inactivity_hours):
            continue
        ref = device.last_activity.isoformat()  # one alert per inactivity window
        if _already_alerted(session, device.id, "inactivity", ref):
            continue
        local = device.last_activity + timedelta(minutes=device.tz_offset_minutes)
        text = await companion.alert_text("inactivity", device.preferred_name or "Your loved one",
                                          {"last_activity": local.strftime("%a %H:%M"),
                                           "hours_idle": round(idle.total_seconds() / 3600, 1)})
        await send(device, text)
        _record(session, device.id, "inactivity", ref)
        sent += 1
    return sent
