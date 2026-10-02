import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getLinkCode } from '../src/api';
import { CompanionPicker } from '../src/CompanionPicker';
import { getKV, getProfile, setKV, setProfile } from '../src/db';
import { stopPlayback } from '../src/audio';
import { pushConfig } from '../src/sync';
import type { Profile } from '../src/types';
import { BigButton, Body, Card, Field, Title } from '../src/ui';

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
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ padding: 20, gap: 16 }}>
        <Title>{saved === null ? 'Create a caregiver PIN' : 'Caregiver PIN'}</Title>
        <Body muted>This keeps settings away from accidental taps.</Body>
        <Field label="4-digit PIN" value={pin} onChangeText={(t) => setPin(t.replace(/\D/g, '').slice(0, 4))}
          keyboardType="number-pad" secureTextEntry maxLength={4} />
        <BigButton label="Continue" onPress={submit} />
      </View>
    </SafeAreaView>
  );
}

export default function Settings() {
  const [unlocked, setUnlocked] = useState(false);
  const [p, setP] = useState<Profile | null>(null);
  const [link, setLink] = useState<{ code: string; deep_link: string } | null>(null);
  const [linkError, setLinkError] = useState(false);

  useEffect(() => {
    if (!unlocked) return;
    void getProfile().then(setP);
    getLinkCode().then(setLink).catch(() => setLinkError(true));
    return () => stopPlayback();
  }, [unlocked]);

  if (!unlocked) return <PinGate onOk={() => setUnlocked(true)} />;
  if (!p) return null;

  const num = (v: string, fallback: number) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : fallback);

  async function save() {
    await setProfile(p!);
    void pushConfig();
    router.back();
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
        <Title>Family alerts</Title>
        <Card>
          <Body>Family members get alerts on Telegram. Ask them to open this link, or scan the code:</Body>
          {link ? (
            <View style={{ alignItems: 'center', gap: 10 }}>
              <QRCode value={link.deep_link} size={180} />
              <Title>{link.code}</Title>
              <Body muted>{link.deep_link}</Body>
            </View>
          ) : <Body muted>{linkError ? 'Could not reach the server. Try again later.' : 'Loading...'}</Body>}
        </Card>

        <Title>Alert timing</Title>
        <Field label="Alert family after this many minutes late" keyboardType="number-pad"
          value={String(p.graceMinutes)} onChangeText={(v) => setP({ ...p, graceMinutes: num(v, 60) })} />
        <Field label="Alert if no activity for this many hours" keyboardType="decimal-pad"
          value={String(p.inactivityHours)} onChangeText={(v) => setP({ ...p, inactivityHours: num(v, 3) })} />
        <Field label="Quiet hours start (no inactivity alerts)" value={p.quietStart}
          onChangeText={(quietStart) => setP({ ...p, quietStart })} />
        <Field label="Quiet hours end" value={p.quietEnd} onChangeText={(quietEnd) => setP({ ...p, quietEnd })} />

        <Title>Companion</Title>
        <CompanionPicker value={p.companionId} onChange={(companionId) => setP({ ...p, companionId })} />

        <BigButton label="Save settings" onPress={save} />
        <BigButton label="View insights" variant="secondary" onPress={() => router.push('/insights')} />
        <BigButton label="Edit medications" variant="secondary" onPress={() => router.push('/meds')} />
      </ScrollView>
    </SafeAreaView>
  );
}
