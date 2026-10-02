"""Minimal Telegram Bot API client (httpx) + long-polling for /start, /status, /report."""
import asyncio
import logging

import httpx
from sqlmodel import Session, select

from app.config import settings
from app.models import Device, get_engine

log = logging.getLogger("couchy.telegram")


def _url(method: str) -> str:
    return f"https://api.telegram.org/bot{settings.telegram_token}/{method}"


async def send_message(chat_id: int, text: str) -> None:
    if not settings.telegram_token:
        log.info("[telegram disabled] to %s: %s", chat_id, text)
        return
    async with httpx.AsyncClient(timeout=30) as client:
        await client.post(_url("sendMessage"), json={"chat_id": chat_id, "text": text})


async def send_audio(chat_id: int, audio: bytes, filename: str, caption: str = "") -> None:
    if not settings.telegram_token:
        return
    async with httpx.AsyncClient(timeout=60) as client:
        await client.post(_url("sendAudio"), data={"chat_id": chat_id, "caption": caption[:1000]},
                          files={"audio": (filename, audio)})


async def notify_family(device: Device, text: str) -> None:
    for chat_id in device.telegram_chat_ids or []:
        await send_message(chat_id, text)


def link_chat(session: Session, code: str, chat_id: int) -> Device | None:
    device = session.exec(select(Device).where(Device.link_code == code.upper())).first()
    if device is None:
        return None
    if chat_id not in (device.telegram_chat_ids or []):
        device.telegram_chat_ids = [*(device.telegram_chat_ids or []), chat_id]
        session.add(device)
        session.commit()
    return device


async def handle_update(update: dict, status_text, report_sender) -> None:
    msg = update.get("message") or {}
    text = (msg.get("text") or "").strip()
    chat_id = (msg.get("chat") or {}).get("id")
    if not chat_id or not text.startswith("/"):
        return
    cmd, _, arg = text.partition(" ")
    with Session(get_engine()) as session:
        if cmd == "/start":
            device = link_chat(session, arg.strip(), chat_id) if arg.strip() else None
            reply = (f"Connected! You will now get updates about {device.preferred_name or 'your loved one'}."
                     if device else "Hi! Send /start CODE with the code shown in the Couchy app.")
            await send_message(chat_id, reply)
            return
        device = next((d for d in session.exec(select(Device)).all()
                       if chat_id in (d.telegram_chat_ids or [])), None)
        if device is None:
            await send_message(chat_id, "Not linked yet. Send /start CODE from the Couchy app.")
        elif cmd == "/status":
            await send_message(chat_id, await status_text(session, device))
        elif cmd == "/report":
            await report_sender(session, device, chat_id)


async def poll(status_text, report_sender) -> None:
    if not settings.telegram_token:
        log.info("TELEGRAM_BOT_TOKEN not set; bot polling disabled")
        return
    offset = 0
    async with httpx.AsyncClient(timeout=40) as client:
        while True:
            try:
                r = await client.get(_url("getUpdates"), params={"timeout": 30, "offset": offset})
                for update in r.json().get("result", []):
                    offset = update["update_id"] + 1
                    await handle_update(update, status_text, report_sender)
            except Exception as exc:
                log.warning("telegram poll error: %s", exc)
                await asyncio.sleep(5)
