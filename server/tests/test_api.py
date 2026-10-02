import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.agent import companion as agent
from app.agent.ollama import ReplyIntent
from app.api import routes
from app.telegram import bot
from app.voice import tts


@pytest.fixture
def client(engine, monkeypatch, tmp_path):
    async def fake_messages(med, companion_id, profile, time_of_day, count):
        return [f"Take your {med['name']} #{i}" for i in range(count)]

    async def fake_synth(text, companion_id, model="eleven_v3"):
        (tmp_path / "a.mp3").write_bytes(b"x")
        return "a.mp3"

    async def fake_transcribe(audio, filename="reply.m4a"):
        return "I feel dizzy"

    async def fake_intent(*a, **k):
        return ReplyIntent(intent="concern", reply="I'll tell your family.", notify_family=True, concern="dizzy")

    async def fake_alert(*a, **k):
        return "alert!"

    notified = []

    async def fake_notify(device, text):
        notified.append(text)

    monkeypatch.setattr(agent, "reminder_messages", fake_messages)
    monkeypatch.setattr(agent, "interpret_reply", fake_intent)
    monkeypatch.setattr(agent, "alert_text", fake_alert)
    monkeypatch.setattr(tts, "synthesize", fake_synth)
    monkeypatch.setattr(tts, "transcribe", fake_transcribe)
    monkeypatch.setattr(bot, "notify_family", fake_notify)
    app = FastAPI()
    app.include_router(routes.router)
    c = TestClient(app)
    c.notified = notified
    return c


def register(client):
    r = client.post("/devices").json()
    return r["device_id"], {"X-API-Key": r["api_key"]}


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

    link = client.post(f"/devices/{did}/family/link-code", headers=h).json()
    assert len(link["code"]) == 6 and link["deep_link"].endswith(link["code"])


def test_voice_concern_notifies_family(client):
    did, h = register(client)
    client.put(f"/devices/{did}/schedules", json=[{"id": "m1", "name": "Metformin"}], headers=h)
    client.post(f"/devices/{did}/events", headers=h, json={"doses": [
        {"id": "d-1", "medication_id": "m1", "scheduled_at": "2026-10-03T08:00:00"}]})
    r = client.post(f"/devices/{did}/voice/reply", headers=h, data={"dose_event_id": "d-1"},
                    files={"audio": ("r.m4a", b"audio")}).json()
    assert r["intent"] == "concern" and r["transcript"] == "I feel dizzy"
    assert client.notified == ["alert!"]


def test_insights(client):
    did, h = register(client)
    r = client.get(f"/devices/{did}/insights", headers=h).json()
    assert r["metrics"]["total_doses"] == 0
