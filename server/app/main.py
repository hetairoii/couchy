import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from sqlmodel import Session

from app.agent import companion as agent
from app.analytics import metrics as m
from app.api.routes import dose_dicts, router
from app.models import get_engine
from app.telegram import bot
from app.voice import tts
from app.watchdog import jobs

logging.basicConfig(level=logging.INFO)


async def _watchdog_tick() -> None:
    now = datetime.utcnow()
    with Session(get_engine()) as session:
        await jobs.check_missed_doses(session, now, bot.notify_family)
        await jobs.check_inactivity(session, now, bot.notify_family)


async def _status_text(session: Session, device) -> str:
    now = datetime.utcnow()
    doses = dose_dicts(session, device.id, 1, now)
    counts = {s: sum(1 for d in doses if d["status"] == s) for s in ("taken", "pending", "missed")}
    return f"Last 24h: {counts['taken']} taken, {counts['pending']} pending, {counts['missed']} missed."


async def _send_report(session: Session, device, chat_id: int) -> None:
    now = datetime.utcnow()
    metrics = m.compute_metrics(dose_dicts(session, device.id, 7, now))
    name = device.preferred_name or "your loved one"
    report = await agent.weekly_report(name, device.companion_id, metrics)
    await bot.send_message(chat_id, "\n".join([report.headline, *[f"- {b}" for b in report.bullets],
                                               "", report.suggestion]))
    try:
        file = await tts.synthesize(report.spoken_version, device.companion_id, "eleven_flash_v2_5")
        await bot.send_audio(chat_id, (tts.audio_dir() / file).read_bytes(), file, report.headline)
    except Exception:
        logging.getLogger("couchy").warning("weekly audio skipped", exc_info=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler = AsyncIOScheduler()
    scheduler.add_job(_watchdog_tick, "interval", minutes=1)
    scheduler.start()
    poller = asyncio.create_task(bot.poll(_status_text, _send_report))
    yield
    poller.cancel()
    scheduler.shutdown(wait=False)


app = FastAPI(title="Couchy", lifespan=lifespan)
app.include_router(router)
