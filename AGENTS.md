# Couchy — project context
Couchy is an open-source mobile app that helps an elderly person remember to take their pills.
A warm AI companion — brain: Gemma (open-weight, served by Ollama); voice: ElevenLabs — reminds them,
understands their spoken replies, and alerts family via Telegram. Built for the DEV Hacktoberfest 2026
"Build for a Friend" challenge: open-source AI (Gemma) must be what makes the project work.

## Stack
- mobile/: Expo SDK (latest) + TypeScript + expo-router, expo-sqlite, expo-notifications, expo-audio
  (play + record), expo-file-system, @react-native-community/netinfo. Runs in Expo Go for UI/voice testing; notifications need a development build (expo-notifications is skipped in Expo Go).
- server/: Python 3.11+, FastAPI, SQLModel (SQLite), APScheduler, httpx, pandas, python-telegram-bot,
  elevenlabs (official SDK), piper-tts (fallback), tabpfn, sentry-sdk (optional).
- LLM: Gemma via Ollama (OLLAMA_URL, OLLAMA_MODEL default `gemma3:4b`). Always use Ollama structured
  outputs (`format` = JSON schema), validate with Pydantic, and fall back to fixed templates on failure.
  The LLM writes friendly text and classifies replies. It NEVER computes metrics and NEVER gives medical
  advice, dosage changes or diagnoses.
- Voice: ElevenLabs TTS (`eleven_v3` for pre-generated messages, `eleven_flash_v2_5` for live replies),
  ElevenLabs Scribe for speech-to-text. ELEVENLABS_API_KEY lives only on the server.
  VOICE_PROVIDER=elevenlabs|piper switches TTS; Piper is the automatic fallback.

## Domain
Medication, Schedule(times HH:MM, days_of_week), DoseEvent(scheduled_at, reminded_at, opened_at,
taken_at, status pending|taken|snoozed|skipped|missed, snooze_count, source button|voice),
VoiceReply(transcript, intent, concern), ActivityPing, Profile(preferred_name, family_names, likes,
routine_notes), Settings(companion_id, grace_minutes=60, inactivity_hours=3, quiet 22:00–07:00,
timezone), FamilyLink, MessageCache(text, audio_path, used), Alert.
Companions: grace, walter, sunny, arthur (server/app/companions.py holds ElevenLabs voice_ids + personas).

## UX rules (elderly users — non-negotiable)
Min font 20pt, AA+ contrast, touch targets >= 64dp, one primary action per screen, no typing in the
daily flow, voice + vibration + text together, plain English, settings behind a 4-digit caregiver PIN.

## Engineering rules
Offline-first reminder flow (cached audio, local outbox). UTC ISO-8601 timestamps; schedules in device
timezone. Simple readable code, no premature abstractions. Tests for analytics, watchdog and intent
handling. Secrets only in .env (provide .env.example). Repo is public and MIT-licensed.
