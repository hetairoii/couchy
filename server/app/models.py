"""Database models. All datetimes are naive UTC."""
import secrets
import string
from datetime import datetime

from pydantic import NaiveDatetime
from sqlalchemy import JSON, Column
from sqlmodel import Field, Session, SQLModel, create_engine

from app.config import settings


def _utcnow() -> datetime:
    return datetime.utcnow()


class Device(SQLModel, table=True):
    id: str = Field(primary_key=True)
    api_key: str
    companion_id: str = "grace"
    preferred_name: str = ""
    family_names: list = Field(default_factory=list, sa_column=Column(JSON))
    likes: list = Field(default_factory=list, sa_column=Column(JSON))
    routine_notes: str = ""
    grace_minutes: int = 60
    inactivity_hours: float = 3
    quiet_start: str = "22:00"
    quiet_end: str = "07:00"
    tz_offset_minutes: int = 0  # device offset from UTC
    link_code: str = ""
    telegram_chat_ids: list = Field(default_factory=list, sa_column=Column(JSON))
    last_activity: NaiveDatetime = Field(default_factory=_utcnow)
    created_at: NaiveDatetime = Field(default_factory=_utcnow)


class Medication(SQLModel, table=True):
    id: str = Field(primary_key=True)
    device_id: str = Field(index=True)
    name: str
    dosage: str = ""
    instructions: str = ""
    times: list = Field(default_factory=list, sa_column=Column(JSON))  # ["08:00", "20:00"] device-local
    days_of_week: list = Field(default_factory=lambda: [0, 1, 2, 3, 4, 5, 6], sa_column=Column(JSON))
    active: bool = True


class DoseEvent(SQLModel, table=True):
    id: str = Field(primary_key=True)  # client generated, makes sync idempotent
    device_id: str = Field(index=True)
    medication_id: str
    scheduled_at: NaiveDatetime
    reminded_at: NaiveDatetime | None = None
    opened_at: NaiveDatetime | None = None
    taken_at: NaiveDatetime | None = None
    status: str = "pending"  # pending|taken|snoozed|skipped|missed
    snooze_count: int = 0
    source: str = "button"  # button|voice


class VoiceReply(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    device_id: str = Field(index=True)
    dose_event_id: str
    transcript: str
    intent: str
    concern: str | None = None
    created_at: NaiveDatetime = Field(default_factory=_utcnow)


class Alert(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    device_id: str = Field(index=True)
    kind: str
    ref_id: str  # dose id, or inactivity window id
    sent_at: NaiveDatetime = Field(default_factory=_utcnow)


def new_link_code() -> str:
    return "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(6))


_engine = None


def get_engine():
    global _engine
    if _engine is None:
        if settings.database_url:  # e.g. a free Neon/Supabase Postgres, survives restarts
            url = settings.database_url.replace("postgres://", "postgresql://", 1)
            if url.startswith("postgresql://"):
                url = url.replace("postgresql://", "postgresql+psycopg://", 1)
            _engine = create_engine(url, pool_pre_ping=True)
        else:
            settings.data_dir.mkdir(parents=True, exist_ok=True)
            _engine = create_engine(f"sqlite:///{settings.data_dir / 'couchy.db'}",
                                    connect_args={"check_same_thread": False})
        SQLModel.metadata.create_all(_engine)
    return _engine


def set_engine(engine) -> None:
    global _engine
    _engine = engine
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(get_engine()) as session:
        yield session
