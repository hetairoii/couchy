# Couchy

A warm AI companion that helps an elderly person remember their pills, and keeps their family in the loop.

Built for the DEV **Hacktoberfest 2026 Weekend Challenge: Build for a Friend**.

- **Brain:** Gemma (open-weight). In production it runs through Google AI Studio (`LLM_PROVIDER=google`); locally
  it runs with Ollama (`LLM_PROVIDER=ollama`). It writes the reminders, understands spoken replies, and drafts
  family alerts and summaries. Prompts are in [`docs/prompts.md`](docs/prompts.md).
- **Voice:** ElevenLabs TTS and Scribe. `VOICE_PROVIDER=piper` switches to the open-source Piper voices (fully
  local); there is no automatic fallback to a different voice.
- **Offline reminders:** audio is pre-generated and cached on the phone, so the voice plays without internet.
- **A real alarm:** on Android a native module (`mobile/modules/couchy-alarm`) rings like an alarm clock: on the
  alarm audio stream (so it sounds on silent / Do Not Disturb), waking the screen and opening Couchy over the lock
  screen, with the companion's voice naming the medicine, until the person answers.
- **Never a robotic voice:** if the companion's voice is unavailable the app shows large text and vibrates; it
  never falls back to a system voice.
- **Help button:** one tap to record a voice note; every relative on Telegram gets an urgent alert plus the audio.
- **Family:** Telegram bot with missed-dose, inactivity, help and concern alerts, and a report on request
  (`/report`). One stable link/QR code for all relatives.
- **Analytics:** adherence, punctuality, delay and consistency computed with pandas (never by the LLM). An
  experimental TabPFN model that predicts late doses exists in `server/app/analytics/tabpfn_risk.py` but is not
  enabled in production.

## Layout

| Path | What |
|---|---|
| `mobile/` | Expo / React Native app (+ the Kotlin alarm module in `mobile/modules`) |
| `server/` | FastAPI backend (Gemma, voice, analytics, watchdog, Telegram) |
| `docs/prompts.md` | The Gemma prompts |
| `render.yaml` | Render blueprint used for the live backend |
| `deploy/` | Docker Compose to self-host everything (Gemma through Ollama) on any server |

## Live demo

- Backend: https://couchy-api.onrender.com/health (free tier: the first request after idle can take ~1 minute)
- Telegram bot: https://t.me/youfriendcouchy_bot
- Android app: see the latest [release](../../releases) (APK)

## Run the server

```bash
cd server
python -m venv .venv && .venv/Scripts/activate   # or source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                              # fill in keys
ollama pull gemma3:4b                             # or set LLM_PROVIDER=google and GOOGLE_API_KEY
uvicorn app.main:app --reload
pytest
```

## Build the app (needs a development build, not Expo Go)

```bash
cd mobile
npm install --legacy-peer-deps
eas build --profile preview --platform android     # cloud build, gives an APK
# or locally, with the phone on USB:  npx expo run:android
```

After installing, open *Caregiver settings → Alarm setup* and turn every item green so the alarm always rings
(notifications, alarms & reminders, full-screen alerts, Do Not Disturb access, unrestricted battery).

## Privacy and limits

Health data stays on the server you run. In the live demo Gemma is served by Google AI Studio; run it with Ollama
to keep the model on your own machine. Reminder text (including the medicine name) is sent to ElevenLabs when
`VOICE_PROVIDER=elevenlabs`; use `piper` to keep everything on your server. The AI never gives medical advice.
On Android the alarm rings from a native foreground service, so it works with the app closed; iOS is not
supported yet.

## Challenge note

All code was started within the challenge window (Oct 2–5, 2026). Any commits after the deadline will be listed here.

License: MIT
