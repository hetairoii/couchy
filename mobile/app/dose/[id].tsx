import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Text, Vibration, View } from 'react-native';
import { absolute, ApiError, sendVoiceReply } from '../../src/api';
import { refreshAlarmAudio, stopAlarm } from '../../src/alarm';
import { playPhrase, playUri, stopPlayback } from '../../src/audio';
import { Avatar } from '../../src/Avatar';
import { companionById } from '../../src/companions';
import { getDose, getProfile, listMeds, nextMessage, updateDose } from '../../src/db';
import { scheduleSnooze } from '../../src/notifications';
import { flushOutbox } from '../../src/sync';
import { colors, fonts } from '../../src/theme';
import type { Dose, Med, Profile } from '../../src/types';
import { useVoiceRecorder } from '../../src/useVoiceRecorder';
import { Icon } from '../../src/Icon';
import { BigButton, Body, Card, Screen } from '../../src/ui';
import { HelpButton } from '../../src/HelpButton';

const MAX_SNOOZES = 3;

export default function DoseScreen() {
  // fromAlarm: the native alarm is already playing the voice, so this screen must not play it twice.
  const { id, fromAlarm } = useLocalSearchParams<{ id: string; fromAlarm?: string }>();
  const [dose, setDose] = useState<Dose | null>(null);
  const [med, setMed] = useState<Med | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [said, setSaid] = useState<string | null>(null); // what the companion says (text of the voice message)
  const [heard, setHeard] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { recording, start, stop } = useVoiceRecorder(60_000, () => void sendRecording());
  const started = useRef(false);

  useEffect(() => {
    (async () => {
      const d = await getDose(id);
      if (!d) return router.replace('/');
      const allMeds = await listMeds();
      const m = allMeds.find((x) => x.id === d.medId) ?? null;
      const p = await getProfile();
      setDose(d); setMed(m); setProfile(p);
      if (started.current || !m) return;
      started.current = true;
      if (!d.openedAt) await updateDose(d.id, { openedAt: new Date().toISOString() });
      if (d.status === 'taken' || d.status === 'skipped') return void stopAlarm();
      if (!fromAlarm) await stopAlarm(); // opened by hand while the alarm rings: avoid two voices at once
      const msg = await nextMessage(m.id);
      setSaid(msg?.text ?? `It is time to take your ${m.name}.`);
      if (!fromAlarm) {
        if (msg?.audioPath) await playUri(msg.audioPath);
        else Vibration.vibrate([0, 400, 200, 400]); // no voice available: show the text and vibrate
      }
      void refreshAlarmAudio(allMeds); // the alarm now gets the next message
    })();
    return () => stopPlayback();
  }, [id, fromAlarm]);

  if (!dose || !med || !profile) return null;
  const companion = companionById(profile.companionId);
  const localTime = new Date(dose.scheduledAt);
  const hhmm = `${String(localTime.getHours()).padStart(2, '0')}:${String(localTime.getMinutes()).padStart(2, '0')}`;

  async function finish(patch: Parameters<typeof updateDose>[1], phrase: Parameters<typeof playPhrase>[0]) {
    stopPlayback();
    await stopAlarm();
    await updateDose(dose!.id, patch);
    void playPhrase(phrase);
    void flushOutbox();
    setDose((await getDose(dose!.id)) ?? dose);
    setTimeout(() => router.replace('/'), 2500);
  }

  const took = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await finish({ status: 'taken', takenAt: new Date().toISOString(), source: 'button' }, 'well_done');
  };

  const snooze = async () => {
    await scheduleSnooze(med, hhmm, 10);
    await finish({ status: 'snoozed', snoozeCount: dose.snoozeCount + 1 }, 'snooze_ok');
  };

  const skip = () =>
    Alert.alert('Skip this dose?', 'Your family will be told that you skipped it.', [
      { text: 'No, go back', style: 'cancel' },
      { text: 'Skip it', style: 'destructive', onPress: () => void finish({ status: 'skipped' }, 'skip_ok') },
    ]);

  async function talk() {
    if (busy) return;
    if (recording) return sendRecording();
    setNotice(null);
    await stopAlarm();
    if (!(await start())) setNotice('I need the microphone to listen. Please allow it in the phone settings, or tap a button.');
  }

  async function sendRecording() {
    const rec = await stop();
    if (!rec) return setNotice("I didn't hear anything. Tap the microphone and try again.");
    setBusy(true);
    try {
      const r = await sendVoiceReply(dose!, rec.uri);
      setHeard(r.transcript);
      setSaid(r.reply);
      if (r.audio_url) await playUri(absolute(r.audio_url));
      else Vibration.vibrate(300);
      // Keep the phone in step with what the server decided, or the old status would overwrite it on the next sync.
      if (r.dose_status !== dose!.status) {
        await updateDose(dose!.id, {
          status: r.dose_status, source: 'voice',
          ...(r.dose_status === 'taken' ? { takenAt: r.taken_at ?? new Date().toISOString() } : {}),
          ...(r.dose_status === 'snoozed' ? { snoozeCount: dose!.snoozeCount + 1 } : {}),
        });
        setDose((await getDose(dose!.id)) ?? dose);
        if (r.dose_status === 'taken' || r.dose_status === 'skipped') {
          await stopAlarm();
          setTimeout(() => router.replace('/'), 4000);
        }
      }
      void flushOutbox();
    } catch (e) {
      setNotice(
        e instanceof TypeError ? 'There is no internet right now. Please tap one of the big buttons.'
          : e instanceof ApiError && e.status === 422 ? "I didn't hear anything. Tap the microphone and try again."
            : "I couldn't understand that. Please tap one of the big buttons.");
    } finally {
      setBusy(false);
    }
  }

  const done = dose.status === 'taken' || dose.status === 'skipped';

  return (
    <Screen>
      <View style={{ alignItems: 'center', gap: 10 }}>
        <Avatar companion={companion} size={120} />
        <Text style={{ fontFamily: fonts.title, fontSize: 24, color: colors.ink }}>{companion.name}</Text>
      </View>

      {!!said && (
        <Card style={{ backgroundColor: colors.card }}>
          <Text style={{ fontFamily: fonts.body, fontSize: 24, color: colors.ink, lineHeight: 34 }}>{said}</Text>
        </Card>
      )}

      <Card style={{ borderLeftWidth: 18, borderLeftColor: med.color }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Icon name="pill" size={30} />
          <Text style={{ fontFamily: fonts.title, fontSize: 36, color: colors.ink, flex: 1, lineHeight: 44 }}>{med.name}</Text>
        </View>
        {!!med.dosage && <Text style={{ fontFamily: fonts.strong, fontSize: 28, color: colors.ink }}>{med.dosage}</Text>}
        {!!med.instructions && <Body>{med.instructions}</Body>}
        <Body muted>Scheduled for {localTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</Body>
      </Card>

      {done ? (
        <Card style={{ backgroundColor: '#DCE8DD' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Icon name="check" size={36} color={colors.primary} stroke={3.6} />
            <Text style={{ fontFamily: fonts.title, fontSize: 30, color: colors.ink, flex: 1 }}>
              {dose.status === 'taken' ? 'Taken. Great job!' : 'Skipped'}
            </Text>
          </View>
        </Card>
      ) : (
        <>
          <BigButton big icon="check" label="I took it" onPress={took} />
          <BigButton icon="clock" label={dose.snoozeCount >= MAX_SNOOZES ? 'No more snoozes' : 'Remind me in 10 min'}
            variant="secondary" onPress={snooze} disabled={dose.snoozeCount >= MAX_SNOOZES} />
          <BigButton big icon="mic" variant={recording ? 'danger' : 'accent'} disabled={busy}
            label={busy ? 'Listening...' : recording ? 'Tap here to send' : `Tell ${companion.name}`} onPress={talk} />
          {recording && <Card><Body>I'm listening. Say what you want, then tap again.</Body></Card>}
          {heard && <Card><Body muted>You said:</Body><Body>"{heard}"</Body></Card>}
          {!!notice && <Card><Body>{notice}</Body></Card>}
          <HelpButton />
          <BigButton icon="skip" label="Skip this dose" variant="secondary" onPress={skip} />
        </>
      )}
    </Screen>
  );
}
