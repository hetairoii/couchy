import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { Avatar } from '../src/Avatar';
import { companionById } from '../src/companions';
import { dosesBetween, ensureDose, getProfile, listMeds, updateDose } from '../src/db';
import { dosesForDay } from '../src/doses';
import { HelpButton } from '../src/HelpButton';
import { Icon } from '../src/Icon';
import { flushOutbox } from '../src/sync';
import { colors, fonts } from '../src/theme';
import type { Dose, Med, Profile } from '../src/types';
import { BigButton, Body, Card, Chip, Screen, SectionTitle, Title } from '../src/ui';

const STATUS: Record<Dose['status'], { label: string; color: string; dark?: boolean }> = {
  taken: { label: 'Taken', color: colors.primary },
  missed: { label: 'Missed', color: colors.red },
  skipped: { label: 'Skipped', color: colors.blue },
  pending: { label: 'Waiting', color: colors.mustard, dark: true },
  snoozed: { label: 'Waiting', color: colors.mustard, dark: true },
};

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
  const med = (id: string) => meds.find((m) => m.id === id);
  const next = doses.find((d) => d.status === 'pending' || d.status === 'snoozed');
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Image source={require('../assets/brand/mark.png')} style={{ width: 44, height: 44 }} resizeMode="contain" />
        <Text style={{ fontFamily: fonts.title, fontSize: 30, color: colors.ink }}>Couchy</Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <Avatar companion={companion} size={84} />
        <View style={{ flex: 1 }}>
          <Title>{greeting}, {profile.preferredName}!</Title>
          <Body muted>{companion.name} is with you today.</Body>
        </View>
      </View>

      {next ? (
        <Card style={{ backgroundColor: '#FFF1C9' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name="clock" size={26} />
            <Body style={{ fontFamily: fonts.strong }}>Next pill</Body>
          </View>
          <Text style={{ fontFamily: fonts.title, fontSize: 38, color: colors.ink, lineHeight: 46 }}>
            {med(next.medId)?.name ?? 'Medication'}
          </Text>
          <Body>at {fmt(next.scheduledAt)}</Body>
          <BigButton icon="pill" label="Open reminder" onPress={() => router.push(`/dose/${next.id}`)} />
        </Card>
      ) : (
        <Card style={{ backgroundColor: '#DCE8DD' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Icon name="check" size={34} color={colors.primary} stroke={3.4} />
            <Text style={{ fontFamily: fonts.title, fontSize: 28, color: colors.ink, flex: 1 }}>
              {doses.length ? 'All done for today!' : 'No pills scheduled today'}
            </Text>
          </View>
          {!meds.length && <BigButton icon="plus" label="Add a medication" onPress={() => router.push('/meds')} />}
        </Card>
      )}

      <SectionTitle>Today</SectionTitle>
      {doses.map((d) => {
        const m = med(d.medId);
        const s = STATUS[d.status];
        return (
          <Card key={d.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12,
            borderLeftWidth: 16, borderLeftColor: m?.color ?? colors.rose }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.title, fontSize: 24, color: colors.ink }}>{m?.name ?? 'Medication'}</Text>
              <Body muted>{fmt(d.scheduledAt)}</Body>
            </View>
            <Chip label={s.label} color={s.color} dark={s.dark} />
          </Card>
        );
      })}

      <HelpButton />
      <BigButton icon="pill" label="Medications" variant="secondary" onPress={() => router.push('/meds')} />
      <BigButton icon="sliders" label="Caregiver settings" variant="secondary" onPress={() => router.push('/settings')} />
    </Screen>
  );
}
