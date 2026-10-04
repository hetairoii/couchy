import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '../src/Avatar';
import { companionById } from '../src/companions';
import { dosesBetween, ensureDose, getProfile, listMeds, updateDose } from '../src/db';
import { dosesForDay } from '../src/doses';
import { flushOutbox } from '../src/sync';
import { colors } from '../src/theme';
import type { Dose, Med, Profile } from '../src/types';
import { HelpButton } from '../src/HelpButton';
import { BigButton, Body, Card, Chip, Title } from '../src/ui';

const statusColor = (s: Dose['status']) =>
  s === 'taken' ? colors.taken : s === 'missed' || s === 'skipped' ? colors.missed : colors.pending;

const fmt = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export default function Home() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [meds, setMeds] = useState<Med[]>([]);
  const [doses, setDoses] = useState<Dose[]>([]);

  const load = useCallback(async () => {
    const p = await getProfile();
    if (!p.preferredName) return router.replace('/onboarding');
    const allMeds = await listMeds();
    const now = new Date();
    for (const slot of dosesForDay(allMeds, now)) await ensureDose(slot.id, slot.medId, slot.scheduledAt);
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let today = await dosesBetween(start, new Date(start.getTime() + 86_400_000));
    // Pending doses long past their time are shown as missed (the server marks them too).
    const limit = now.getTime() - p.graceMinutes * 60_000;
    for (const d of today) {
      if ((d.status === 'pending' || d.status === 'snoozed') && new Date(d.scheduledAt).getTime() < limit) {
        await updateDose(d.id, { status: 'missed' });
      }
    }
    today = await dosesBetween(start, new Date(start.getTime() + 86_400_000));
    setProfile(p); setMeds(allMeds); setDoses(today);
    void flushOutbox();
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (!profile) return null;
  const companion = companionById(profile.companionId);
  const medName = (id: string) => meds.find((m) => m.id === id)?.name ?? 'Medication';
  const next = doses.find((d) => d.status === 'pending' || d.status === 'snoozed');
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Avatar companion={companion} size={72} />
          <View style={{ flex: 1 }}>
            <Title>{greeting}, {profile.preferredName}</Title>
            <Body muted>{companion.name} is with you today.</Body>
          </View>
        </View>

        {next ? (
          <Card style={{ borderColor: colors.primary, borderWidth: 3 }}>
            <Body muted>Next pill</Body>
            <Text style={{ fontSize: 34, fontWeight: '800', color: colors.text }}>{medName(next.medId)}</Text>
            <Body>at {fmt(next.scheduledAt)}</Body>
            <BigButton label="Open reminder" onPress={() => router.push(`/dose/${next.id}`)} />
          </Card>
        ) : (
          <Card>
            <Text style={{ fontSize: 28, fontWeight: '800', color: colors.primary }}>
              {doses.length ? 'All done for today ✓' : 'No pills scheduled today'}
            </Text>
            {!meds.length && <BigButton label="Add a medication" onPress={() => router.push('/meds')} />}
          </Card>
        )}

        <Title>Today</Title>
        {doses.map((d) => (
          <Card key={d.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text }}>{medName(d.medId)}</Text>
              <Body muted>{fmt(d.scheduledAt)}</Body>
            </View>
            <Chip label={d.status === 'taken' ? 'Taken' : d.status === 'missed' ? 'Missed' : d.status === 'skipped' ? 'Skipped' : 'Waiting'}
              color={statusColor(d.status)} />
          </Card>
        ))}

        <HelpButton />
        <BigButton label="Medications" variant="secondary"onPress={() => router.push('/meds')} />
        <BigButton label="Caregiver settings" variant="secondary" onPress={() => router.push('/settings')} />
      </ScrollView>
    </SafeAreaView>
  );
}
