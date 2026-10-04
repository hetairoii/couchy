"""Text-to-speech and speech-to-text.

VOICE_PROVIDER=elevenlabs (default) never falls back to another voice: an elderly person must not hear a
different, robotic voice. When ElevenLabs is unavailable we raise VoiceUnavailable and the app shows text only.
VOICE_PROVIDER=piper is an explicit, fully local alternative.
"""
import hashlib
import logging
import shutil
import subprocess
import tempfile
from pathlib import Path

import httpx

from app.companions import get_companion
from app.config import settings

log = logging.getLogger("couchy.voice")
ELEVEN = "https://api.elevenlabs.io/v1"
PIPER_VOICES = {"grace": "en_US-amy-medium", "walter": "en_US-joe-medium",
                "sunny": "en_US-lessac-medium", "arthur": "en_GB-alan-medium"}


class VoiceUnavailable(RuntimeError):
    """No audio could be produced with the configured voice."""


class TranscriptionFailed(RuntimeError):
    """Speech-to-text failed (network, quota, unsupported audio...)."""


def audio_dir() -> Path:
    d = settings.data_dir / "audio"
    d.mkdir(parents=True, exist_ok=True)
    return d


async def _elevenlabs_tts(text: str, voice_id: str, model: str) -> bytes:
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(
            f"{ELEVEN}/text-to-speech/{voice_id}",
            params={"output_format": "mp3_44100_64"},
            headers={"xi-api-key": settings.elevenlabs_key},
            json={"text": text, "model_id": model},
        )
        r.raise_for_status()
        return r.content


def _piper_tts(text: str, companion_id: str) -> bytes:
    if not shutil.which("piper"):
        raise VoiceUnavailable("piper binary not found")
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        out = Path(f.name)
    try:
        subprocess.run(["piper", "--model", PIPER_VOICES.get(companion_id, "en_US-amy-medium"),
                        "--output_file", str(out)], input=text.encode(), check=True, timeout=60)
        return out.read_bytes()
    finally:
        out.unlink(missing_ok=True)


async def synthesize(text: str, companion_id: str, model: str = "eleven_v3") -> str:
    """Returns the cached audio file name (mp3 for ElevenLabs, wav for Piper). Raises VoiceUnavailable."""
    provider = settings.voice_provider
    key = hashlib.sha256(f"{provider}|{model}|{companion_id}|{text}".encode()).hexdigest()[:24]
    for ext in ("mp3", "wav"):
        if (audio_dir() / f"{key}.{ext}").exists():
            return f"{key}.{ext}"

    if provider == "piper":
        data, ext = _piper_tts(text, companion_id), "wav"
    else:
        if not settings.elevenlabs_key:
            raise VoiceUnavailable("ELEVENLABS_API_KEY is empty")
        voice_id = get_companion(companion_id)["voice_id"]
        try:
            data, ext = await _elevenlabs_tts(text, voice_id, model), "mp3"
        except httpx.HTTPStatusError as exc:
            log.warning("ElevenLabs TTS failed for voice %s: HTTP %s %s",
                        voice_id, exc.response.status_code, exc.response.text[:300])
            raise VoiceUnavailable(f"ElevenLabs HTTP {exc.response.status_code}") from exc
        except Exception as exc:
            log.warning("ElevenLabs TTS failed (%s)", exc)
            raise VoiceUnavailable(str(exc)) from exc
    name = f"{key}.{ext}"
    (audio_dir() / name).write_bytes(data)
    return name


async def synthesize_or_none(text: str, companion_id: str, model: str = "eleven_v3") -> str | None:
    """Like synthesize, but returns None instead of raising (callers then show text only)."""
    try:
        return await synthesize(text, companion_id, model)
    except VoiceUnavailable:
        return None


async def transcribe(audio: bytes, filename: str = "reply.m4a", content_type: str = "audio/mp4") -> str:
    """ElevenLabs Scribe speech-to-text."""
    if not settings.elevenlabs_key:
        raise TranscriptionFailed("ELEVENLABS_API_KEY not configured")
    try:
        async with httpx.AsyncClient(timeout=90) as client:
            r = await client.post(
                f"{ELEVEN}/speech-to-text",
                headers={"xi-api-key": settings.elevenlabs_key},
                data={"model_id": settings.elevenlabs_stt_model},
                files={"file": (filename, audio, content_type or "audio/mp4")},
            )
            r.raise_for_status()
            return r.json().get("text", "").strip()
    except httpx.HTTPStatusError as exc:
        log.warning("ElevenLabs STT failed: HTTP %s %s", exc.response.status_code, exc.response.text[:300])
        raise TranscriptionFailed(f"HTTP {exc.response.status_code}") from exc
    except Exception as exc:
        log.warning("ElevenLabs STT failed (%s)", exc)
        raise TranscriptionFailed(str(exc)) from exc
