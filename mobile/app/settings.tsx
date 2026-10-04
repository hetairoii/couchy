import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { getLinkCode, rotateLinkCode, type LinkCode } from '../src/api';
import { AlarmSetup } from '../src/AlarmSetup';
import { CompanionPicker } from '../src/CompanionPicker';
import { getKV, getProfile, setKV, setProfile } from '../src/db';
import { stopPlayback } from '../src/audio';
import { syncVoice } from '../src/sync';
import { colors, INK } from '../src/theme';
import type { Profile } from '../src/types';
import { BigButton, Body, Card, Field, Screen, SectionTitle, Title } from '../src/ui';

function PinGate({ onOk }: { onOk: () => void }) {
  const [saved, setSaved] = useState<string | null | undefined>(undefined);
  const [pin, setPin] = useState('');
  useEffect(() => { void getKV<string | null>('pin', null).then(setSaved); }, []);
  if (saved === undefined) return null;

  async function submit() {
    if (saved === null) {
      if (pin.length !== 4) return Alert.alert('PIN', 'Please choose 4 digits.');
      await setKV('pin', pin);
      return onOk();
    }
    if (pin === saved) return onOk();
    setPin('');
    Alert.alert('Wrong PIN', 'Please try again.');
  }

  return (
    <Screen scroll={false}>
      <SectionTitle>{saved === null ? 'Create a caregiver PIN' : 'Caregiver PIN'}</SectionTitle>
      <Body muted>This keeps settings away from accidental taps.</Body>
      <Field label="4-digit PIN" value={pin} onChangeText={(t) => setPin(t.replace(/\D/g, '').slice(0, 4))}
        keyboardType="number-pad" secureTextEntry maxLength={4} />
      <BigButton label="Continue" onPress={submit} />
    </Screen>
  );
}

export default function Settings() {
  const [unlocked, setUnlocked] = useState(false);
  const [p, setP] = useState<Profile | null>(null);
  const [link, setLink] = useState<LinkCode | null>(null);
  const [linkError, setLinkError] = useState(false);

  useEffect(() => {
    if (!unlocked) return;
    void getProfile().then(setP);
    getLinkCode().then(setLink).catch(() => setLinkError(true));
    return () => stopPlayback();
  }, [unlocked]);

  if (!unlocked) return <PinGate onOk={() => setUnlocked(true)} />;
  if (!p) return null;

  function newCode() {
    Alert.alert('Create a new code?',
      'The old link will stop working for new relatives. Relatives already connected stay connected.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Create new code', onPress: () => rotateLinkCode().then(setLink).catch(() => setLinkError(true)) },
      ]);
  }

  const num = (v: string, fallback: number) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : fallback);

  async function save() {
    await setProfile(p!);
    void syncVoice();
    router.back();
  }

  return (
    <Screen>
      <SectionTitle>Family alerts</SectionTitle>
      <Card>
        <Body>Family members get alerts on Telegram. Ask them to open this link, or scan the code:</Body>
        {link ? (
          <View style={{ alignItems: 'center', gap: 10 }}>
            <View style={{ padding: 12, backgroundColor: '#fff', borderWidth: INK, borderColor: colors.ink, borderRadius: 14 }}>
              <QRCode value={link.deep_link} size={180} color={colors.ink} />
            </View>
            <Title>{link.code}</Title>
            <Body muted style={{ fontSize: 16, lineHeight: 22, textAlign: 'center' }}>{link.deep_link}</Body>
          </View>
        ) : <Body muted>{linkError ? 'Could not reach the server. Try again later.' : 'Loading...'}</Body>}
        <Body muted>Every relative uses this same link. It never changes unless you create a new one.</Body>
        {link && <BigButton label="Create a new code" variant="secondary" onPress={newCode} />}
      </Card>

      <AlarmSetup />

      <SectionTitle>Alert timing</SectionTitle>
      <Field label="Alert family after this many minutes late" keyboardType="number-pad"
        value={String(p.graceMinutes)} onChangeText={(v) => setP({ ...p, graceMinutes: num(v, 60) })} />
      <Field label="Alert if no activity for this many hours" keyboardType="decimal-pad"
        value={String(p.inactivityHours)} onChangeText={(v) => setP({ ...p, inactivityHours: num(v, 3) })} />
      <Field label="Quiet hours start (no inactivity alerts)" value={p.quietStart}
        onChangeText={(quietStart) => setP({ ...p, quietStart })} />
      <Field label="Quiet hours end" value={p.quietEnd} onChangeText={(quietEnd) => setP({ ...p, quietEnd })} />

      <SectionTitle>Companion</SectionTitle>
      <CompanionPicker value={p.companionId} onChange={(companionId) => setP({ ...p, companionId })} />

      <BigButton icon="check" label="Save settings" onPress={save} />
      <BigButton icon="chart" label="View insights" variant="secondary" onPress={() => router.push('/insights')} />
      <BigButton icon="pill" label="Edit medications" variant="secondary" onPress={() => router.push('/meds')} />
    </Screen>
  );
}
