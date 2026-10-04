import { router } from 'expo-router';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { CompanionPicker } from '../src/CompanionPicker';
import { getProfile, setProfile } from '../src/db';
import { stopPlayback } from '../src/audio';
import { syncVoice } from '../src/sync';
import { colors, fonts } from '../src/theme';
import { BigButton, Body, Field, Screen, SectionTitle } from '../src/ui';

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
    void syncVoice();
    router.replace('/meds');
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <View style={{ alignItems: 'center', gap: 6 }}>
          <Image source={require('../assets/brand/mark.png')} style={{ width: 120, height: 120 }} resizeMode="contain" />
          <Text style={{ fontFamily: fonts.title, fontSize: 44, color: colors.ink }}>Couchy</Text>
          <Body muted>Your friendly pill companion</Body>
        </View>

        <SectionTitle>Who is Couchy for?</SectionTitle>
        <Body muted>A family member can fill this in. The companion uses it to sound personal.</Body>
        <Field label="What should we call them?" value={name} onChangeText={setName} placeholder="Rose" />
        <Field label="Family names (comma separated)" value={family} onChangeText={setFamily} placeholder="Leo, Maria" />
        <Field label="Things they like" value={likes} onChangeText={setLikes} placeholder="gardening, tea, old movies" />
        <Field label="Daily routine" value={routine} onChangeText={setRoutine}
          placeholder="Breakfast at 8, a walk in the afternoon" multiline />

        <SectionTitle>Pick a companion</SectionTitle>
        <CompanionPicker value={companionId} onChange={setCompanionId} />
        <BigButton icon="pill" label="Next: add medications" onPress={save} disabled={!name.trim()} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
