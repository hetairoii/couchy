"""Gemma through Ollama with structured outputs. Every call has a template fallback."""
import json
import logging
import re
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


def extract_json(text: str) -> dict:
    """Gemma on the Google API has no JSON mode, so pull the object out of fences/prose."""
    text = re.sub(r"```(?:json)?", "", text)
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        raise ValueError("no JSON object in model output")
    return json.loads(text[start:end + 1])


async def _ollama(prompt: str, model_cls: type[BaseModel], temperature: float) -> dict:
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
    return json.loads(r.json()["message"]["content"])


async def _google(prompt: str, model_cls: type[BaseModel], temperature: float) -> dict:
    schema_hint = json.dumps(model_cls.model_json_schema().get("properties", {}))
    text = f"{prompt}\n\nRespond with ONLY a JSON object with these fields: {schema_hint}"
    body = {
        "contents": [{"role": "user", "parts": [{"text": text}]}],
        "generationConfig": {"temperature": temperature, "maxOutputTokens": 600},
    }
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.google_model}:generateContent"
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(url, json=body, headers={"x-goog-api-key": settings.google_api_key})
        r.raise_for_status()
    return extract_json(r.json()["candidates"][0]["content"]["parts"][0]["text"])


async def chat_json(prompt: str, model_cls: type[BaseModel], temperature: float = 0.6) -> BaseModel:
    call = _google if settings.llm_provider == "google" else _ollama
    return model_cls.model_validate(await call(prompt, model_cls, temperature))


async def safe_chat(prompt: str, model_cls: type[BaseModel], fallback: Any, temperature: float = 0.6):
    try:
        return await chat_json(prompt, model_cls, temperature)
    except Exception as exc:  # network, bad JSON, schema mismatch
        log.warning("Gemma call failed (%s); using fallback", exc)
        return fallback
