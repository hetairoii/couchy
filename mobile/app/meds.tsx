import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { deleteMed, listMeds, saveMed } from '../src/db';
import { parseTimes } from '../src/doses';
import { isExpoGo, requestPermissions, rescheduleAll } from '../src/notifications';
import { syncVoice } from '../src/sync';
import { colors, TOUCH } from '../src/theme';
import type { Med } from '../src/types';
import { BigButton, Body, Card, Field, Title } from '../src/ui';

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const PALETTE = ['#E9B7B0', '#B7C9E2', '#F6D98B', '#C6D8B5', '#D8B7E2', '#F2C1A0'];
const blank = (): Med => ({
  id: `med_${Date.now()}`, name: '', dosage: '', instructions: '', color: PALETTE[0],
  times: [], days: [0, 1, 2, 3, 4, 5, 6],
});

export default function Meds() {
  const [meds, setMeds] = useState<Med[]>([]);
  const [editing, setEditing] = useState<Med | null>(null);
  const [timesText, setTimesText] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);

  const refresh = useCallback(async () => setMeds(await listMeds()), []);
  useEffect(() => { void refresh(); }, [refresh]);

  const edit = (m: Med) => { setEditing(m); setTimesText(m.times.join(', ')); setPhoto(null); };

  async function pickPhoto() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.5 });
    if (!r.canceled) setPhoto(r.assets[0].uri);
  }

  async function save() {
    if (!editing) return;
    const times = parseTimes(timesText);
    if (!editing.name.trim() || !times.length) {
      Alert.alert('Almost there', 'Please enter a name and at least one time like 08:00.');
      return;
    }
    await saveMed({ ...editing, name: editing.name.trim(), times });
    setEditing(null);
    await refresh();
    if (isExpoGo) Alert.alert('Saved', 'Reminders only fire in a development build; Expo Go cannot schedule them.');
    else if (await requestPermissions()) await rescheduleAll();
    else Alert.alert('Notifications are off', 'Reminders need notification permission. You can enable it in Settings.');
    void syncVoice();
  }

  async function remove(m: Med) {
    Alert.alert(`Delete ${m.name}?`, 'Its reminders will stop.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteMed(m.id); await refresh(); await rescheduleAll(); void syncVoice();
      } },
    ]);
  }

  if (editing) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
          <Title>{meds.some((m) => m.id === editing.id) ? 'Edit medication' : 'New medication'}</Title>
          <Field label="Name" value={editing.name} onChangeText={(name) => setEditing({ ...editing, name })} placeholder="Metformin" />
          <Field label="Dose" value={editing.dosage} onChangeText={(dosage) => setEditing({ ...editing, dosage })} placeholder="500 mg, 1 tablet" />
          <Field label="Instructions (optional)" value={editing.instructions}
            onChangeText={(instructions) => setEditing({ ...editing, instructions })} placeholder="With food" />
          <Field label="Times (24h, comma separated)" value={timesText} onChangeText={setTimesText}
            placeholder="08:00, 20:00" autoCapitalize="none" />
          <Body>Days</Body>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {DAYS.map((d, i) => {
              const on = editing.days.includes(i);
              return (
                <Pressable key={i} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
                  accessibilityLabel={['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][i]}
                  onPress={() => setEditing({ ...editing, days: on ? editing.days.filter((x) => x !== i) : [...editing.days, i].sort() })}
                  style={{ flex: 1, minHeight: TOUCH, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: on ? colors.primary : colors.card, borderWidth: 2, borderColor: colors.primary }}>
                  <Text style={{ fontSize: 20, fontWeight: '800', color: on ? '#fff' : colors.primary }}>{d}</Text>
                </Pressable>
              );
            })}
          </View>
          <Body>Color</Body>
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            {PALETTE.map((c) => (
              <Pressable key={c} accessibilityRole="button" accessibilityLabel={`Color ${c}`}
                onPress={() => setEditing({ ...editing, color: c })}
                style={{ width: TOUCH, height: TOUCH, borderRadius: 32, backgroundColor: c,
                  borderWidth: editing.color === c ? 5 : 1, borderColor: editing.color === c ? colors.primary : colors.border }} />
            ))}
          </View>
          <BigButton label={photo ? 'Change photo' : 'Add a photo (optional)'} variant="secondary" onPress={pickPhoto} />
          {photo && <Image source={{ uri: photo }} style={{ width: '100%', height: 160, borderRadius: 16 }} />}
          <BigButton label="Save" onPress={save} />
          <BigButton label="Cancel" variant="secondary" onPress={() => setEditing(null)} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
        {meds.length === 0 && <Body muted>No medications yet. Add the first one to start the reminders.</Body>}
        {meds.map((m) => (
          <Card key={m.id} style={{ borderLeftWidth: 12, borderLeftColor: m.color }}>
            <Text style={{ fontSize: 26, fontWeight: '800', color: colors.text }}>{m.name}</Text>
            <Body>{[m.dosage, m.times.join(' · ')].filter(Boolean).join(' — ')}</Body>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><BigButton label="Edit" variant="secondary" onPress={() => edit(m)} /></View>
              <View style={{ flex: 1 }}><BigButton label="Delete" variant="danger" onPress={() => remove(m)} /></View>
            </View>
          </Card>
        ))}
        <BigButton label="Add medication" onPress={() => edit(blank())} />
        <BigButton label="Done" variant="secondary" onPress={() => router.replace('/')} />
      </ScrollView>
    </SafeAreaView>
  );
}
