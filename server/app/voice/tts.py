"""Text-to-speech and speech-to-text. ElevenLabs first, Piper (open source) as fallback."""
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
        raise RuntimeError("piper binary not found")
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        out = Path(f.name)
    try:
        subprocess.run(["piper", "--model", PIPER_VOICES.get(companion_id, "en_US-amy-medium"),
                        "--output_file", str(out)], input=text.encode(), check=True, timeout=60)
        return out.read_bytes()
    finally:
        out.unlink(missing_ok=True)


async def synthesize(text: str, companion_id: str, model: str = "eleven_v3") -> str:
    """Returns the cached audio file name (mp3 for ElevenLabs, wav for Piper)."""
    provider = settings.voice_provider
    key = hashlib.sha256(f"{provider}|{model}|{companion_id}|{text}".encode()).hexdigest()[:24]
    for ext in ("mp3", "wav"):
        if (audio_dir() / f"{key}.{ext}").exists():
            return f"{key}.{ext}"

    data, ext = None, "mp3"
    if provider == "elevenlabs" and settings.elevenlabs_key:
        try:
            data = await _elevenlabs_tts(text, get_companion(companion_id)["voice_id"], model)
        except Exception as exc:
            log.warning("ElevenLabs TTS failed (%s); falling back to Piper", exc)
    if data is None:
        data, ext = _piper_tts(text, companion_id), "wav"
    name = f"{key}.{ext}"
    (audio_dir() / name).write_bytes(data)
    return name


async def transcribe(audio: bytes, filename: str = "reply.m4a") -> str:
    """ElevenLabs Scribe speech-to-text."""
    if not settings.elevenlabs_key:
        raise RuntimeError("ELEVENLABS_API_KEY not configured")
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(
            f"{ELEVEN}/speech-to-text",
            headers={"xi-api-key": settings.elevenlabs_key},
            data={"model_id": "scribe_v1"},
            files={"file": (filename, audio)},
        )
        r.raise_for_status()
        return r.json().get("text", "").strip()
