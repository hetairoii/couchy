---
title: "Couchy: a companion with a real voice so [PERSON] never misses a pill"
published: false
tags: devchallenge, weekendchallenge, hf26challenge
cover_image: 
---

*This is a submission for the [Hacktoberfest Weekend Challenge: Build for a Friend](https://dev.to/challenges/hacktoberfest-weekend-2026-10-01)*

## What I Built

<!-- TODO (the heart of the post, 1-2 short paragraphs, specific and personal):
     Who is [PERSON]? What do they take and when? What went wrong before (forgotten doses, a double dose,
     the family worrying from far away)? Why a phone alarm or a pill box was not enough. -->

Couchy is an Android app for [PERSON]: a warm companion that reminds them to take their pills, in a voice they
picked, and keeps their family in the loop.

- **A real alarm.** It rings like an alarm clock: on the alarm audio stream (so it sounds even if the phone is
  muted or in Do Not Disturb), it wakes the screen and opens over the lock screen, and the companion says the
  name of the medicine out loud until [PERSON] answers.
- **Four companions** (Grace, Walter, Sunny, Arthur), each with their own voice and personality.
- **Talk back.** [PERSON] can say "I already took it after breakfast" or "I feel a bit dizzy" and the companion
  understands, answers, marks the dose, and tells the family if it sounds worrying.
- **A help button.** One tap, a short voice note, and every relative gets an urgent Telegram alert with the audio.
- **Family peace of mind.** A Telegram bot alerts relatives when a dose is late (60 min by default), when there
  has been no activity for a while (3 h by default, configurable, quiet at night), and on request sends adherence
  stats: how many pills are taken, how late, how consistent.

## Demo

<!-- TODO: embed the video (<= 2 min):  {% embed https://www.youtube.com/watch?v=XXXXXXXX %}
     Add 2-3 screenshots or GIFs: the alarm over the lock screen, the dose screen, the Telegram alert. -->

APK: <!-- TODO: link to the GitHub Release -->  ·  Backend: https://couchy-api.onrender.com/health

## What [PERSON] said

<!-- TODO: their reaction, a quote, a photo of them holding the phone. The challenge gives bonus points for
     actually handing it over and telling what they said. -->

## Code

{% embed https://github.com/hetairoii/couchy %}

## How I Built It

```
Android app (Expo / React Native + a small Kotlin module for the alarm)
        │  events, voice notes
        ▼
FastAPI backend (Render) ──► Gemma  (writes, understands, decides)
        │                ──► ElevenLabs  (voice out, speech in)
        │                ──► Postgres  (doses, settings)
        ▼
Telegram bot ──► family
```

**Gemma is the brain.** Every piece of "thinking" goes through it, always with structured JSON output validated
with Pydantic and a fixed fallback if a call fails:

1. It writes ten fresh, personal reminders per medicine (it knows [PERSON]'s name, family, likes and routine) so
   the companion never repeats itself.
2. It classifies what [PERSON] says out loud (`taken`, `snooze`, `skip`, `concern`, `chat`) and writes the reply,
   including when to alert the family.
3. It drafts the family alerts and the weekly summary from numbers computed in pandas, never from the model's
   own arithmetic.

It never gives medical advice. In production the model is `gemma-4-26b-a4b-it` served through Google AI Studio;
the repo also runs it fully local with Ollama (`gemma3:4b`) through the included Docker Compose.

**ElevenLabs gives it a voice.** `eleven_v3` voices the pre-generated reminders (with expressive tags like
`[warmly]`), `eleven_flash_v2_5` voices live replies, and Scribe turns [PERSON]'s speech into text for Gemma.
Reminders are generated ahead of time and cached on the phone, so the alarm speaks even with no internet. If the
voice is ever unavailable, the app shows large text and vibrates: it never falls back to a robotic system voice,
which would confuse the person it is built for.

**The alarm is native.** A small Kotlin module (`mobile/modules/couchy-alarm`) uses `AlarmManager.setAlarmClock`
and a foreground service on `USAGE_ALARM`, plus a full-screen intent, so it behaves like a real alarm clock and
survives reboots. A checklist in the caregiver settings walks through the permissions Android requires.

**Designed for an older person.** Large text, 64 dp buttons, one main action per screen, no typing in the daily
flow, caregiver settings behind a PIN, and an illustrated look that matches the portraits of the companions.

**Deployed for free.** The API runs on Render's free tier with a free Postgres, and I built the app with
Claude Code as my coding agent.

## Why Does Open Innovation Matter?

<!-- TODO: add one concrete number or anecdote if you have it (cost per month, latency, a swap you tried). -->

- **Health data is sensitive.** With an open-weight model the same code runs on a server I control. For a
  caregiver, "where does my mother's medication list go?" has a real answer: swap one environment variable
  (`LLM_PROVIDER=ollama`) and the model runs on a laptop.
- **Zero per-token cost.** Reminders are written once, cached and reused, and an open model has no usage bill, so
  a family could run this indefinitely.
- **Swappable parts.** Gemma 4 in the cloud, `gemma3:1b` on a small server, or a local voice with Piper
  (`VOICE_PROVIDER=piper`): each is one setting, not a rewrite.
- **Behavior I can change.** The prompts live in a plain file (`docs/prompts.md`) and I tuned the tone, the safety
  rules and the structured outputs myself, which a closed assistant would not let me do.

**Honest trade-offs.** In production Gemma is hosted by Google, so the "stays on my server" benefit applies to the
local setup, not to the live demo. And ElevenLabs is not open source: the text of each reminder, including the
medicine name, goes to it to be voiced.

## My Agent Session

<!-- TODO: embed the DevRelay session, or link to it. -->

## Prize Categories

- **Best Use of Gemma**: Gemma is the agent's brain: personalised reminders, understanding spoken replies,
  deciding when to alert the family, and writing alerts and summaries. Runs on Google AI Studio or locally with Ollama.
- **Best Use of ElevenLabs**: gives the open-source agent a voice (TTS), transcribes [PERSON]'s speech for Gemma
  (Scribe), and narrates the demo video.
- **Best Use of Render**: the agent's backend (FastAPI, Telegram watchdog, voice pipeline) runs on Render.

## Limitations and what is next

- The native alarm is Android only; iOS would need a different approach.
- On Render's free tier the server sleeps after 15 minutes without traffic, so a monitor pings it every 5 minutes.
- The weekly family report is sent on request (`/report` in Telegram), not yet on a schedule.
- A risk model that predicts which doses will be late (TabPFN) exists in the repo but is not enabled in production.
