import secrets
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlmodel import Session, select

from app.agent import companion as agent
from app.analytics import metrics as m
from app.analytics import tabpfn_risk
from app.companions import COMPANIONS, get_companion
from app.config import settings
from app.models import Device, DoseEvent, Medication, VoiceReply, get_session, new_link_code
from app.telegram import bot
from app.voice import tts

router = APIRouter()


def _naive(dt: datetime | None) -> datetime | None:
    return dt.replace(tzinfo=None) if dt and dt.tzinfo is None else (
        dt.astimezone(tz=None).replace(tzinfo=None) if dt else None)


def auth(device_id: str, x_api_key: str = Header(default=""), session: Session = Depends(get_session)) -> Device:
    device = session.get(Device, device_id)
    if device is None or not secrets.compare_digest(device.api_key, x_api_key):
        raise HTTPException(401, "Invalid device or API key")
    return device


# ---- registration & configuration -------------------------------------------------

@router.post("/devices")
def register(session: Session = Depends(get_session)):
    device = Device(id=uuid.uuid4().hex, api_key=secrets.token_urlsafe(24), link_code=new_link_code())
    session.add(device)
    session.commit()
    return {"device_id": device.id, "api_key": device.api_key}


class ProfileIn(BaseModel):
    preferred_name: str = ""
    family_names: list[str] = []
    likes: list[str] = []
    routine_notes: str = ""
    companion_id: str = "grace"
    grace_minutes: int = 60
    inactivity_hours: float = 3
    quiet_start: str = "22:00"
    quiet_end: str = "07:00"
    tz_offset_minutes: int = 0


@router.put("/devices/{device_id}/profile")
def put_profile(body: ProfileIn, device: Device = Depends(auth), session: Session = Depends(get_session)):
    for k, v in body.model_dump().items():
        setattr(device, k, v)
    session.add(device)
    session.commit()
    return {"ok": True}


class MedIn(BaseModel):
    id: str
    name: str
    dosage: str = ""
    instructions: str = ""
    times: list[str] = []
    days_of_week: list[int] = [0, 1, 2, 3, 4, 5, 6]
    active: bool = True


@router.put("/devices/{device_id}/schedules")
def put_schedules(meds: list[MedIn], device: Device = Depends(auth), session: Session = Depends(get_session)):
    for old in session.exec(select(Medication).where(Medication.device_id == device.id)).all():
        session.delete(old)
    for med in meds:
        session.add(Medication(device_id=device.id, **med.model_dump()))
    session.commit()
    return {"ok": True, "count": len(meds)}


# ---- events -----------------------------------------------------------------------

class DoseIn(BaseModel):
    id: str
    medication_id: str
    scheduled_at: datetime
    reminded_at: datetime | None = None
    opened_at: datetime | None = None
    taken_at: datetime | None = None
    status: str = "pending"
    snooze_count: int = 0
    source: str = "button"


class EventsIn(BaseModel):
    doses: list[DoseIn] = []
    last_activity: datetime | None = None


@router.post("/devices/{device_id}/events")
def post_events(body: EventsIn, device: Device = Depends(auth), session: Session = Depends(get_session)):
    """Idempotent: doses are upserted by client id. Any call counts as activity."""
    for d in body.doses:
        data = {k: (_naive(v) if isinstance(v, datetime) else v) for k, v in d.model_dump().items()}
        existing = session.get(DoseEvent, d.id)
        if existing:
            for k, v in data.items():
                setattr(existing, k, v)
            session.add(existing)
        else:
            session.add(DoseEvent(device_id=device.id, **data))
    device.last_activity = _naive(body.last_activity) or datetime.utcnow()
    session.add(device)
    session.commit()
    return {"ok": True, "doses": len(body.doses)}


# ---- companion messages & audio ---------------------------------------------------

class BatchIn(BaseModel):
    medication_id: str
    time_of_day: str = "morning"
    count: int = 10


@router.post("/devices/{device_id}/messages/batch")
async def messages_batch(body: BatchIn, device: Device = Depends(auth), session: Session = Depends(get_session)):
    med = session.get(Medication, body.medication_id)
    if med is None or med.device_id != device.id:
        raise HTTPException(404, "Medication not found")
    profile = {"preferred_name": device.preferred_name, "family_names": device.family_names,
               "likes": device.likes, "routine_notes": device.routine_notes}
    texts = await agent.reminder_messages(med.model_dump(), device.companion_id, profile,
                                          body.time_of_day, min(body.count, 10))
    out = []
    for text in texts:
        file = await tts.synthesize(text, device.companion_id)
        out.append({"text": text, "audio_url": f"/audio/{file}"})
    return out


@router.get("/audio/{name}")
def get_audio(name: str):
    path = tts.audio_dir() / name
    if "/" in name or "\\" in name or not path.exists():
        raise HTTPException(404)
    return FileResponse(path)


@router.get("/companions")
def list_companions():
    return [{"id": k, "name": v["name"], "personality": v["personality"]} for k, v in COMPANIONS.items()]


@router.get("/companions/{companion_id}/preview")
async def companion_preview(companion_id: str):
    try:
        file = await tts.synthesize(get_companion(companion_id)["greeting"], companion_id)
    except Exception as exc:
        raise HTTPException(503, f"No server voice available: {exc}")
    return {"audio_url": f"/audio/{file}", "engine": "elevenlabs" if file.endswith(".mp3") else "piper"}


# ---- spoken replies ---------------------------------------------------------------

@router.post("/devices/{device_id}/voice/reply")
async def voice_reply(dose_event_id: str = Form(...), audio: UploadFile = File(...),
                      device: Device = Depends(auth), session: Session = Depends(get_session)):
    dose = session.get(DoseEvent, dose_event_id)
    if dose is None or dose.device_id != device.id:
        raise HTTPException(404, "Dose not found")
    med = session.get(Medication, dose.medication_id)
    transcript = await tts.transcribe(await audio.read(), audio.filename or "reply.m4a")
    now = datetime.utcnow()
    local = lambda dt: (dt + timedelta(minutes=device.tz_offset_minutes)).strftime("%H:%M")  # noqa: E731
    profile = {"preferred_name": device.preferred_name}
    result = await agent.interpret_reply(transcript, med.model_dump() if med else {"name": "your medication"},
                                         device.companion_id, profile, local(dose.scheduled_at), local(now))
    await apply_intent(session, device, dose, result, transcript, now)
    reply_audio = await tts.synthesize(result.reply, device.companion_id, "eleven_flash_v2_5")
    return {"transcript": transcript, "intent": result.intent, "reply": result.reply,
            "audio_url": f"/audio/{reply_audio}", "dose_status": dose.status}


async def apply_intent(session: Session, device: Device, dose: DoseEvent, result, transcript: str, now: datetime):
    if result.intent == "taken":
        dose.status, dose.source = "taken", "voice"
        dose.taken_at = now - timedelta(minutes=result.minutes_ago or 0)
    elif result.intent == "snooze":
        dose.status, dose.snooze_count = "snoozed", dose.snooze_count + 1
    elif result.intent == "skip":
        dose.status = "skipped"
    session.add(dose)
    session.add(VoiceReply(device_id=device.id, dose_event_id=dose.id, transcript=transcript,
                           intent=result.intent, concern=result.concern))
    device.last_activity = now
    session.add(device)
    session.commit()
    if result.notify_family:
        text = await agent.alert_text("concern", device.preferred_name or "Your loved one",
                                      {"transcript": transcript, "concern": result.concern})
        await bot.notify_family(device, text)


# ---- insights & family ------------------------------------------------------------

def dose_dicts(session: Session, device_id: str, days: int, now: datetime) -> list[dict]:
    rows = session.exec(select(DoseEvent).where(
        DoseEvent.device_id == device_id, DoseEvent.scheduled_at >= now - timedelta(days=days),
        DoseEvent.scheduled_at <= now)).all()
    return [r.model_dump() for r in rows]


@router.get("/devices/{device_id}/insights")
def insights(days: int = 7, device: Device = Depends(auth), session: Session = Depends(get_session)):
    now = datetime.utcnow()
    doses = dose_dicts(session, device.id, days, now)
    return {"metrics": m.compute_metrics(doses), "daily": m.daily_series(doses),
            "week_over_week": m.week_over_week(dose_dicts(session, device.id, 14, now), now),
            "late_risk": late_risk(session, device.id, now)}


def late_risk(session: Session, device_id: str, now: datetime) -> dict | None:
    """TabPFN probability that each still-pending dose in the next 24h is late. None if unavailable."""
    upcoming = session.exec(select(DoseEvent).where(
        DoseEvent.device_id == device_id, DoseEvent.status == "pending",
        DoseEvent.scheduled_at > now, DoseEvent.scheduled_at <= now + timedelta(hours=24))).all()
    if not upcoming:
        return None
    history = dose_dicts(session, device_id, 60, now)
    try:
        return tabpfn_risk.predict_late_risk(history, [u.model_dump() for u in upcoming])
    except Exception:  # never let the optional model break insights
        return None


@router.post("/devices/{device_id}/family/link-code")
def link_code(device: Device = Depends(auth), session: Session = Depends(get_session)):
    device.link_code = new_link_code()
    session.add(device)
    session.commit()
    return {"code": device.link_code,
            "deep_link": f"https://t.me/{settings.telegram_username}?start={device.link_code}"}


@router.get("/health")
def health():
    return {"ok": True, "model": settings.ollama_model, "voice": settings.voice_provider,
            "elevenlabs_key_set": bool(settings.elevenlabs_key), "llm": settings.llm_provider}
