# Demo video script: app only, no people on screen (target: 2:00–2:30)

Everything on screen is the app, Telegram and a few title cards. The demo person is a made-up profile called
**Rose**, so nobody real needs to appear. Speak (or generate with ElevenLabs) the narration below over the footage.

## Prepare before recording (15 minutes)

1. Install the latest APK and finish *Caregiver settings → Alarm setup* (everything green).
2. Onboarding as **Rose** (family: Leo, Maria; likes: gardening, tea). Pick **Grace**.
3. Add one medication, e.g. **Metformin 500 mg**, with a time two minutes from now. Wait for the voice to cache
   (open the app on Wi-Fi for a minute).
4. Telegram: open the bot (`@youfriendcouchy_bot`) on a second phone or on Telegram Desktop and link it with the QR/link
   from Settings, so the family side is ready.
5. In Settings set *Alert family after this many minutes late* to **2** (for the missed-dose clip; restore it to 60
   afterwards).
6. Phone: volume up, then switch the ringer to **silent** and turn **Do Not Disturb** on, to prove the alarm still rings.
7. How to record: the phone's screen recorder (check "record audio from the device" if it offers it). If the alarm voice
   is not captured, use **scrcpy** (`scrcpy --record=couchy.mp4`, it records screen and phone audio over USB), or
   record the voice separately and lay it over the clip when editing. Record the Telegram side with its own screen recorder.

## Shot list

| Time | On screen | Narration |
|---|---|---|
| 0:00–0:08 | Title card: the Couchy logo and "A companion with a real voice that never lets you miss a pill" | 1 |
| 0:08–0:25 | Onboarding: type "Rose", then tap each of the four companions so their portraits and voices play | 2 |
| 0:25–0:35 | Add the medication: name, dose, times, days of the week, colour; tap Save | 3 |
| 0:35–1:00 | **The alarm.** Locked phone, silent, Do Not Disturb. Screen wakes, Couchy opens full screen, the voice says the medicine's name. Hold on the dose screen | 4 |
| 1:00–1:12 | Tap **I took it** (check, "Well done" voice); show the Today list with the green "Taken" chip | 5 |
| 1:12–1:35 | Next dose or a second take: tap **Tell Grace**, say "I already took it, but I feel a bit dizzy"; the reply plays and the dose is marked | 6 |
| 1:35–1:55 | Split screen: tap **I need help**, say "I fell and I need help"; on Telegram the alert + the voice note arrive | 7 |
| 1:55–2:10 | Telegram: the missed-dose alert, then `/status` and `/report` replies | 8 |
| 2:10–2:25 | Caregiver settings: the single QR code, the alarm checklist, alert timing; flash the Insights screen | 9 |
| 2:25–2:35 | Architecture card (Gemma + ElevenLabs + Render + Telegram) and the repo link | 10 |

If you need it shorter, drop shots 3 and 9 and speak shots 8 and 10 faster: it fits in 1:45.

## Narration (≈ 220 words; paste into ElevenLabs or read it yourself)

1. Meet Couchy: a companion with a real voice, built to make sure an older person never misses a pill.
2. Setup takes a minute. Choose a name, and a companion: Grace, Walter, Sunny or Arthur, each with their own voice.
3. Add a medicine, its dose and its times. That is all a caregiver has to do.
4. And now, the part that matters. The phone is locked, on silent, in Do Not Disturb, and it still rings, like a real alarm clock. Couchy opens over the lock screen and the companion says the name of the medicine out loud.
5. One big button: "I took it". The family's dashboard updates right away.
6. She can also just talk. Gemma, an open model, understands what is said, marks the dose, and notices when something sounds worrying.
7. If she ever needs help, one tap records a voice note, and every relative gets an urgent message on Telegram, instantly.
8. When a dose is late, or there is no activity for a while, the family is alerted. They can ask for the day's status or a summary any time.
9. Relatives join with a single code. Alarm permissions are one checklist, and the numbers behind adherence are computed, never invented by the model.
10. Couchy runs on Gemma, ElevenLabs and Render. The code is open source, and the same setup can run on a laptop with the data staying at home.

## Title cards (make them in any editor, or a screenshot of a slide)

- **Card 1:** the Couchy logo (`mobile/assets/brand/mark.png`) on the paper background (`mobile/assets/brand/paper.jpg`).
- **Card 10:** four lines: `Gemma: the brain (reminders, understanding, alerts)`, `ElevenLabs: the voice and the ears`,
  `Render + Postgres: the backend`, `Telegram: the family`, then `github.com/hetairoii/couchy`.

## Tips

- Record the alarm first and keep the take where the phone is visibly muted (show the silent icon or the Do Not Disturb tile).
- Blur or crop anything personal (notifications, other apps, contacts). Use the demo profile only.
- Show the Render URL or the bot name once so the judges can see the backend is real.
- Upload to YouTube as *unlisted* and embed it in the DEV post with `{% embed https://www.youtube.com/watch?v=ID %}`.
- Voice for the narration: any ElevenLabs voice. It counts toward the ElevenLabs category ("narration for your demo").
