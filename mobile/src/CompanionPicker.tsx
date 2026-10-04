import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { getPreview, absolute } from './api';
import { playUri, stopPlayback } from './audio';
import { COMPANIONS } from './companions';
import { colors } from './theme';
import { Body, Card } from './ui';

type Props = { value: string; onChange: (id: string) => void };

export function CompanionPicker({ value, onChange }: Props) {
  const [error, setError] = useState(false);

  async function choose(id: string) {
    onChange(id);
    setError(false);
    try {
      const { audio_url } = await getPreview(id);
      await playUri(absolute(audio_url));
    } catch {
      // Never a system voice: only the companion's real voice is played.
      stopPlayback();
      setError(true);
    }
  }

  return (
    <View style={{ gap: 12 }}>
      {COMPANIONS.map((c) => {
        const selected = c.id === value;
        return (
          <Pressable key={c.id} accessibilityRole="button" accessibilityState={{ selected }}
            accessibilityLabel={`${c.name}. ${c.tagline}`} onPress={() => choose(c.id)}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 80,
              borderWidth: selected ? 4 : 1, borderColor: selected ? colors.primary : colors.border }}>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: c.color,
                alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 30 }}>{c.avatar}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text }}>{c.name}</Text>
                <Body muted>{c.tagline}</Body>
              </View>
            </Card>
          </Pressable>
        );
      })}
      <Body muted>
        {error ? "The voice isn't available right now. Check the internet connection and tap again."
          : 'Tap a companion to hear their voice.'}
      </Body>
    </View>
  );
}
