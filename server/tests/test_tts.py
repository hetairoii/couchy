import pytest

from app.config import settings
from app.voice import tts


@pytest.fixture(autouse=True)
def isolated_audio(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "data_dir", tmp_path)


async def test_elevenlabs_failure_never_falls_back_to_another_voice(monkeypatch):
    monkeypatch.setattr(settings, "voice_provider", "elevenlabs")
    monkeypatch.setattr(settings, "elevenlabs_key", "k")

    async def boom(*a, **k):
        raise RuntimeError("quota")

    def no_piper(*a, **k):
        raise AssertionError("Piper must not be used as a silent fallback")

    monkeypatch.setattr(tts, "_elevenlabs_tts", boom)
    monkeypatch.setattr(tts, "_piper_tts", no_piper)
    with pytest.raises(tts.VoiceUnavailable):
        await tts.synthesize("hello", "grace")
    assert await tts.synthesize_or_none("hello", "grace") is None


async def test_missing_key_is_unavailable_not_robotic(monkeypatch):
    monkeypatch.setattr(settings, "voice_provider", "elevenlabs")
    monkeypatch.setattr(settings, "elevenlabs_key", "")
    assert await tts.synthesize_or_none("hello", "grace") is None


async def test_success_is_cached(monkeypatch):
    monkeypatch.setattr(settings, "voice_provider", "elevenlabs")
    monkeypatch.setattr(settings, "elevenlabs_key", "k")
    calls = []

    async def ok(text, voice_id, model):
        calls.append(voice_id)
        return b"mp3"

    monkeypatch.setattr(tts, "_elevenlabs_tts", ok)
    first = await tts.synthesize("hello", "walter")
    assert first.endswith(".mp3") and await tts.synthesize("hello", "walter") == first
    assert len(calls) == 1
