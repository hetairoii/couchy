"""Gemma through Ollama with structured outputs. Every call has a template fallback."""
import json
import logging
from typing import Any

import httpx
from pydantic import BaseModel

from app.config import settings

log = logging.getLogger("couchy.agent")


class Messages(BaseModel):
    messages: list[str]


class ReplyIntent(BaseModel):
    intent: str
    minutes_ago: int | None = None
    reply: str
    notify_family: bool = False
    concern: str | None = None


class AlertText(BaseModel):
    text: str


class WeeklyReport(BaseModel):
    headline: str
    bullets: list[str]
    suggestion: str
    spoken_version: str


async def chat_json(prompt: str, model_cls: type[BaseModel], temperature: float = 0.6) -> BaseModel:
    payload = {
        "model": settings.ollama_model,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
        "format": model_cls.model_json_schema(),
        "options": {"temperature": temperature, "num_predict": 500},
    }
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(f"{settings.ollama_url}/api/chat", json=payload)
        r.raise_for_status()
    return model_cls.model_validate(json.loads(r.json()["message"]["content"]))


async def safe_chat(prompt: str, model_cls: type[BaseModel], fallback: Any, temperature: float = 0.6):
    try:
        return await chat_json(prompt, model_cls, temperature)
    except Exception as exc:  # network, bad JSON, schema mismatch
        log.warning("Gemma call failed (%s); using fallback", exc)
        return fallback
