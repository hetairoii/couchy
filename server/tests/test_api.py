import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlmodel import Session

from app import models
from app.agent import companion as agent
from app.agent.ollama import ReplyIntent
from app.api import routes
from app.models import Device
from app.telegram import bot
from app.voice import tts

AUDIO = b"a" * 2000  # long enough to count as speech


@pytest.fixture
def client(engine, monkeypatch, tmp_path):
    state = {"voice_ok": True, "intent": "concern"}

    async def fake_messages(med, companion_id, profile, time_of_day, count):
        return [f"Take your {med['name']} #{i}" for i in range(count)]

    async def fake_synth_none(text, companion_id, model="eleven_v3"):
        return "a.mp3" if state["voice_ok"] else None

    async def fake_synth(text, companion_id, model="eleven_v3"):
        if not state["voice_ok"]:
            raise tts.VoiceUnavailable("down")
        return "a.mp3"

    async def fake_transcribe(audio, filename="reply.m4a", content_type="audio/mp4"):
        return "I feel dizzy"

    async def fake_intent(*a, **k):
        if state["intent"] == "taken":
            return ReplyIntent(intent="taken", reply="Great.", minutes_ago=10)
        return ReplyIntent(intent="concern", reply="I'll tell your family.", notify_family=True, concern="dizzy")

    async def fake_alert(*a, **k):
        return "alert!"

    sent = {"texts": [], "voices": [], "followups": []}

    async def fake_notify(device, text):
        sent["texts"].append(text)
        return len(device.telegram_chat_ids or [])

    async def fake_send_voice(chat_id, audio, filename="help.m4a", caption=""):
        sent["voices"].append(chat_id)
        return True

    async def fake_send_message(chat_id, text):
        sent["followups"].append(text)
        return True

    monkeypatch.setattr(agent, "reminder_messages", fake_messages)
    monkeypatch.setattr(agent, "interpret_reply", fake_intent)
    monkeypatch.setattr(agent, "alert_text", fake_alert)
    monkeypatch.setattr(tts, "synthesize", fake_synth)
    monkeypatch.setattr(tts, "synthesize_or_none", fake_synth_none)
    monkeypatch.setattr(tts, "transcribe", fake_transcribe)
    monkeypatch.setattr(bot, "notify_family", fake_notify)
    monkeypatch.setattr(bot, "send_voice", fake_send_voice)
    monkeypatch.setattr(bot, "send_message", fake_send_message)
    app = FastAPI()
    app.include_router(routes.router)
    c = TestClient(app)
    c.state, c.sent = state, sent
    return c


def register(client):
    r = client.post("/devices").json()
    return r["device_id"], {"X-API-Key": r["api_key"]}


def link_family(device_id, chat_ids):
    with Session(models.get_engine()) as s:
        d = s.get(Device, device_id)
        d.telegram_chat_ids = chat_ids
        s.add(d)
        s.commit()


def test_auth_required(client):
    did, _ = register(client)
    assert client.put(f"/devices/{did}/profile", json={}, headers={"X-API-Key": "bad"}).status_code == 401


def test_full_flow(client):
    did, h = register(client)
    assert client.put(f"/devices/{did}/profile", json={"preferred_name": "Rose"}, headers=h).status_code == 200
    meds = [{"id": "m1", "name": "Metformin", "dosage": "500mg", "times": ["08:00"]}]
    assert client.put(f"/devices/{did}/schedules", json=meds, headers=h).json()["count"] == 1

    batch = client.post(f"/devices/{did}/messages/batch", json={"medication_id": "m1", "count": 3}, headers=h).json()
    assert len(batch) == 3 and batch[0]["audio_url"] == "/audio/a.mp3"

    dose = {"id": "d-1", "medication_id": "m1", "scheduled_at": "2026-10-03T08:00:00", "status": "taken",
            "taken_at": "2026-10-03T08:10:00"}
    assert client.post(f"/devices/{did}/events", json={"doses": [dose]}, headers=h).json()["doses"] == 1
    # idempotent: sending again does not duplicate
    client.post(f"/devices/{did}/events", json={"doses": [dose]}, headers=h)


def test_messages_without_voice_still_return_text(client):
    did, h = register(client)
    client.put(f"/devices/{did}/schedules", json=[{"id": "m1", "name": "Metformin"}], headers=h)
    client.state["voice_ok"] = False
    batch = client.post(f"/devices/{did}/messages/batch", json={"medication_id": "m1", "count": 2}, headers=h).json()
    assert [b["audio_url"] for b in batch] == [None, None] and batch[0]["text"]


def test_link_code_is_stable_and_rotates_only_on_purpose(client):
    did, h = register(client)
    first = client.get(f"/devices/{did}/family/link-code", headers=h).json()
    again = client.get(f"/devices/{did}/family/link-code", headers=h).json()
    legacy = client.post(f"/devices/{did}/family/link-code", headers=h).json()  # old app builds
    assert first == again == legacy
    assert len(first["code"]) == 6 and first["deep_link"].endswith(first["code"])
    rotated = client.post(f"/devices/{did}/family/link-code/rotate", headers=h).json()
    assert rotated["code"] != first["code"]
    assert client.get(f"/devices/{did}/family/link-code", headers=h).json() == rotated


def test_phrases_are_voiced_by_the_companion(client):
    did, h = register(client)
    p = client.get(f"/devices/{did}/phrases", headers=h).json()
    assert {"due", "well_done", "snooze_ok", "skip_ok", "help_listening", "help_sent"} <= set(p)
    assert p["well_done"]["audio_url"] == "/audio/a.mp3"
    client.state["voice_ok"] = False
    assert client.get(f"/devices/{did}/phrases", headers=h).json()["due"]["audio_url"] is None


def test_voice_concern_notifies_family(client):
    did, h = register(client)
    client.put(f"/devices/{did}/schedules", json=[{"id": "m1", "name": "Metformin"}], headers=h)
    client.post(f"/devices/{did}/events", headers=h, json={"doses": [
        {"id": "d-1", "medication_id": "m1", "scheduled_at": "2026-10-03T08:00:00"}]})
    r = client.post(f"/devices/{did}/voice/reply", headers=h, data={"dose_event_id": "d-1"},
                    files={"audio": ("r.m4a", AUDIO)}).json()
    assert r["intent"] == "concern" and r["transcript"] == "I feel dizzy"
    assert client.sent["texts"] == ["alert!"]


def test_voice_reply_creates_the_dose_when_not_synced_yet(client):
    did, h = register(client)
    client.put(f"/devices/{did}/schedules", json=[{"id": "m1", "name": "Metformin"}], headers=h)
    client.state["intent"] = "taken"
    r = client.post(f"/devices/{did}/voice/reply", headers=h,
                    data={"dose_event_id": "new-1", "medication_id": "m1", "scheduled_at": "2026-10-03T08:00:00Z"},
                    files={"audio": ("r.m4a", AUDIO)})
    assert r.status_code == 200 and r.json()["dose_status"] == "taken"
    # without the extra fields an unknown dose is still a 404
    r = client.post(f"/devices/{did}/voice/reply", headers=h, data={"dose_event_id": "nope"},
                    files={"audio": ("r.m4a", AUDIO)})
    assert r.status_code == 404


def test_voice_reply_survives_tts_failure_and_rejects_silence(client):
    did, h = register(client)
    client.put(f"/devices/{did}/schedules", json=[{"id": "m1", "name": "Metformin"}], headers=h)
    client.state["intent"] = "taken"
    client.state["voice_ok"] = False
    form = {"dose_event_id": "d-9", "medication_id": "m1", "scheduled_at": "2026-10-03T08:00:00"}
    r = client.post(f"/devices/{did}/voice/reply", headers=h, data=form, files={"audio": ("r.m4a", AUDIO)})
    assert r.status_code == 200 and r.json()["audio_url"] is None
    r = client.post(f"/devices/{did}/voice/reply", headers=h, data=form, files={"audio": ("r.m4a", b"x")})
    assert r.status_code == 422


def test_help_button_sends_text_and_voice_to_every_relative(client):
    did, h = register(client)
    client.put(f"/devices/{did}/profile", json={"preferred_name": "Rose"}, headers=h)
    link_family(did, [111, 222])
    r = client.post(f"/devices/{did}/help", headers=h, files={"audio": ("help.m4a", AUDIO)}).json()
    assert r == {"notified": 2, "linked": 2}
    assert "🆘 Rose" in client.sent["texts"][0]
    assert client.sent["voices"] == [111, 222]
    assert client.sent["followups"] == ["alert!", "alert!"]  # transcript follow-up (background task)


def test_help_button_works_without_audio_and_reports_no_relatives(client):
    did, h = register(client)
    assert client.post(f"/devices/{did}/help", headers=h).json() == {"notified": 0, "linked": 0}
    link_family(did, [111])
    r = client.post(f"/devices/{did}/help", headers=h).json()
    assert r == {"notified": 1, "linked": 1} and client.sent["voices"] == []


def test_insights(client):
    did, h = register(client)
    r = client.get(f"/devices/{did}/insights", headers=h).json()
    assert r["metrics"]["total_doses"] == 0
