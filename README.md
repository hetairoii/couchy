# Couchy

A warm AI companion that helps an elderly person remember their pills, and keeps their family in the loop.

Built for the DEV **Hacktoberfest 2026 Weekend Challenge: Build for a Friend**.

- **Brain:** Gemma (open-weight) served by Ollama. Writes the reminders, understands spoken replies, drafts family alerts and weekly reports.
- **Voice:** ElevenLabs TTS and Scribe, with Piper (open source) as automatic fallback (`VOICE_PROVIDER=piper`).
- **Offline reminders:** audio is pre-generated and cached on the phone, so the voice plays without internet.
- **Family:** Telegram bot with missed-dose, inactivity and concern alerts, plus a weekly report.
- **Analytics:** adherence, punctuality, delay and consistency computed with pandas (never by the LLM); TabPFN predicts risky doses.

## Layout

| Path | What |
|---|---|
| `mobile/` | Expo / React Native app |
| `server/` | FastAPI backend (Gemma, voice, analytics, watchdog, Telegram) |
| `docs/prompts.md` | The Gemma prompts |
| `deploy/` | Docker Compose for a DigitalOcean Droplet |

## Run the server

```bash
cd server
python -m venv .venv && .venv/Scripts/activate   # or source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                              # fill in keys
ollama pull gemma3:4b
uvicorn app.main:app --reload
pytest
```

## Run the app

```bash
cd mobile
npm install
npx expo start
```

## Privacy and limits

Health data stays on your own server. Reminder text (including the medicine name) is sent to ElevenLabs when `VOICE_PROVIDER=elevenlabs`; use `piper` to keep everything on your server. The AI never gives medical advice. The voice plays when the reminder is opened, not from the background.

## Challenge note

All code was started within the challenge window (Oct 2–5, 2026). Any commits after the deadline will be listed here.

License: MIT
