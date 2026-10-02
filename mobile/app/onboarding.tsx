import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CompanionPicker } from '../src/CompanionPicker';
import { getProfile, setProfile } from '../src/db';
import { stopPlayback } from '../src/audio';
import { pushConfig } from '../src/sync';
import { BigButton, Body, Field, Title } from '../src/ui';

const split = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

export default function Onboarding() {
  const [name, setName] = useState('');
  const [family, setFamily] = useState('');
  const [likes, setLikes] = useState('');
  const [routine, setRoutine] = useState('');
  const [companionId, setCompanionId] = useState('grace');

  async function save() {
    stopPlayback();
    const p = await getProfile();
    await setProfile({
      ...p, preferredName: name.trim(), familyNames: split(family), likes: split(likes),
      routineNotes: routine.trim(), companionId,
    });
    void pushConfig();
    router.replace('/meds');
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
          <Title>Who is Couchy for?</Title>
          <Body muted>A family member can fill this in. The companion uses it to sound personal.</Body>
          <Field label="What should we call them?" value={name} onChangeText={setName} placeholder="Rose" />
          <Field label="Family names (comma separated)" value={family} onChangeText={setFamily} placeholder="Leo, Maria" />
          <Field label="Things they like" value={likes} onChangeText={setLikes} placeholder="gardening, tea, old movies" />
          <Field label="Daily routine" value={routine} onChangeText={setRoutine}
            placeholder="Breakfast at 8, a walk in the afternoon" multiline />
          <Title>Pick a companion</Title>
          <CompanionPicker value={companionId} onChange={setCompanionId} />
          <BigButton label="Next: add medications" onPress={save} disabled={!name.trim()} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
