import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { absolute, sendVoiceReply } from '../../src/api';
import { playUri, speakFallback, stopPlayback } from '../../src/audio';
import { companionById } from '../../src/companions';
import { getDose, getProfile, listMeds, nextMessage, updateDose } from '../../src/db';
import { scheduleSnooze } from '../../src/notifications';
import { flushOutbox } from '../../src/sync';
import { colors, TOUCH } from '../../src/theme';
import type { Dose, Med, Profile } from '../../src/types';
import { BigButton, Body, Card, Title } from '../../src/ui';

const MAX_SNOOZES = 3;

export default function DoseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [dose, setDose] = useState<Dose | null>(null);
  const [med, setMed] = useState<Med | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [heard, setHeard] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const started = useRef(false);

  useEffect(() => {
    (async () => {
      const d = await getDose(id);
      if (!d) return router.replace('/');
      const m = (await listMeds()).find((x) => x.id === d.medId) ?? null;
      const p = await getProfile();
      setDose(d); setMed(m); setProfile(p);
      if (started.current || !m) return;
      started.current = true;
      if (!d.openedAt) await updateDose(d.id, { openedAt: new Date().toISOString() });
      if (d.status === 'taken') return;
      // Cached ElevenLabs audio plays offline; otherwise fall back to on-device speech.
      const msg = await nextMessage(m.id);
      if (msg?.audioPath) await playUri(msg.audioPath);
      else speakFallback(msg?.text ?? `Time for your ${m.name}, ${p.preferredName}.`);
    })();
    return () => stopPlayback();
  }, [id]);

  if (!dose || !med || !profile) return null;
  const companion = companionById(profile.companionId);
  const localTime = new Date(dose.scheduledAt);
  const hhmm = `${String(localTime.getHours()).padStart(2, '0')}:${String(localTime.getMinutes()).padStart(2, '0')}`;

  async function finish(patch: Parameters<typeof updateDose>[1], goodbye: string) {
    stopPlayback();
    await updateDose(dose!.id, patch);
    speakFallback(goodbye);
    void flushOutbox();
    setDose((await getDose(dose!.id)) ?? dose);
    setTimeout(() => router.replace('/'), 1800);
  }

  const took = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await finish({ status: 'taken', takenAt: new Date().toISOString(), source: 'button' }, 'Well done. See you next time.');
  };

  const snooze = async () => {
    await scheduleSnooze(med.id, hhmm, 10);
    await finish({ status: 'snoozed', snoozeCount: dose.snoozeCount + 1 }, "Okay, I'll remind you again in ten minutes.");
  };

  const skip = () =>
    Alert.alert('Skip this dose?', 'Your family will be told that you skipped it.', [
      { text: 'No, go back', style: 'cancel' },
      { text: 'Skip it', style: 'destructive', onPress: () => void finish({ status: 'skipped' }, 'Okay.') },
    ]);

  async function startTalking() {
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) return Alert.alert('Microphone needed', 'Please allow the microphone to talk to ' + companion.name);
    stopPlayback();
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setRecording(true);
  }

  async function stopTalking() {
    if (!recording) return;
    setRecording(false);
    setBusy(true);
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const r = await sendVoiceReply(dose!.id, recorder.uri!);
      setHeard(r.transcript);
      await playUri(absolute(r.audio_url));
      setDose((prev) => (prev ? { ...prev, status: r.dose_status } : prev));
      if (r.dose_status === 'taken' || r.dose_status === 'skipped') setTimeout(() => router.replace('/'), 3500);
    } catch {
      setHeard(null);
      Alert.alert("I couldn't hear you", 'Please tap one of the big buttons instead.');
    } finally {
      setBusy(false);
    }
  }

  const done = dose.status === 'taken' || dose.status === 'skipped';

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <View style={{ alignItems: 'center', gap: 8 }}>
          <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: companion.color,
            alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 52 }}>{companion.avatar}</Text>
          </View>
          <Body muted>{companion.name}</Body>
        </View>

        <Card style={{ borderLeftWidth: 14, borderLeftColor: med.color }}>
          <Text style={{ fontSize: 36, fontWeight: '800', color: colors.text }}>{med.name}</Text>
          {!!med.dosage && <Title>{med.dosage}</Title>}
          {!!med.instructions && <Body>{med.instructions}</Body>}
          <Body muted>Scheduled for {localTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</Body>
        </Card>

        {done ? (
          <Card><Text style={{ fontSize: 30, fontWeight: '800', color: colors.primary }}>
            {dose.status === 'taken' ? 'Taken ✓ Great job!' : 'Skipped'}
          </Text></Card>
        ) : (
          <>
            <BigButton label="I took it ✓" onPress={took} />
            <BigButton label={dose.snoozeCount >= MAX_SNOOZES ? 'No more snoozes' : 'Remind me in 10 min'}
              variant="secondary" onPress={snooze} disabled={dose.snoozeCount >= MAX_SNOOZES} />
            <Pressable accessibilityRole="button" accessibilityLabel={`Hold and talk to ${companion.name}`}
              onPressIn={startTalking} onPressOut={stopTalking} disabled={busy}
              style={{ minHeight: TOUCH + 16, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
                backgroundColor: recording ? colors.danger : colors.accent, opacity: busy ? 0.6 : 1 }}>
              <Text style={{ fontSize: 24, fontWeight: '800', color: '#1B1B1B' }}>
                {busy ? 'Listening...' : recording ? 'Release to send' : `🎤 Hold to talk to ${companion.name}`}
              </Text>
            </Pressable>
            {heard && <Card><Body muted>You said:</Body><Body>"{heard}"</Body></Card>}
            <BigButton label="Skip this dose" variant="secondary" onPress={skip} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
