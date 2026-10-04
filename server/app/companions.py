"""Companions: persona + ElevenLabs voice. Replace voice_id with ones picked from the Voice Library."""

COMPANIONS = {
    "grace": {
        "name": "Grace",
        "personality": "warm, motherly and patient",
        "voice_id": "0gEqdZoZWnBTUlpOsHya",
        "greeting": "[warmly] Hello dear, I'm Grace. I'll be here to remind you about your pills.",
    },
    "walter": {
        "name": "Walter",
        "personality": "a calm grandfather with a gentle sense of humor",
        "voice_id": "NOpBlnGInO9m6vDvFkFC",
        "greeting": "[chuckles] Well hello there, I'm Walter. Let's keep those pills on schedule together.",
    },
    "sunny": {
        "name": "Sunny",
        "personality": "cheerful, upbeat and encouraging",
        "voice_id": "VJaB4BPzL7gFTshaufBX",
        "greeting": "Hi! I'm Sunny! I'll make sure your day starts bright and on time.",
    },
    "arthur": {
        "name": "Arthur",
        "personality": "a polite, formal British gentleman who is kind",
        "voice_id": "oaGwHLz3csUaSnc2NBD4",
        "greeting": "Good day. I'm Arthur, at your service for your daily pills.",
    },
}


def get_companion(companion_id: str) -> dict:
    return COMPANIONS.get(companion_id, COMPANIONS["grace"])


def fixed_phrases(name: str) -> dict[str, str]:
    """Short spoken lines the app plays in the companion's voice (never a system voice)."""
    return {
        "due": f"{name}, it's time to take your medicine.",
        "well_done": "Well done! See you next time.",
        "snooze_ok": "Okay, I'll remind you again in ten minutes.",
        "skip_ok": "Okay. I'll let your family know.",
        "help_listening": "I'm listening. Tell me what is happening, then tap again to send.",
        "help_sent": "I've told your family. They will contact you very soon.",
    }
