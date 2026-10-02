import { Pressable, Text, View } from 'react-native';
import { getPreview, absolute } from './api';
import { playUri, speakFallback } from './audio';
import { COMPANIONS } from './companions';
import { colors } from './theme';
import { Body, Card } from './ui';

type Props = { value: string; onChange: (id: string) => void };

export function CompanionPicker({ value, onChange }: Props) {
  async function choose(id: string, name: string) {
    onChange(id);
    try {
      const { audio_url } = await getPreview(id);
      await playUri(absolute(audio_url));
    } catch {
      speakFallback(`Hello, I'm ${name}. I'll be your companion.`);
    }
  }

  return (
    <View style={{ gap: 12 }}>
      {COMPANIONS.map((c) => {
        const selected = c.id === value;
        return (
          <Pressable key={c.id} accessibilityRole="button" accessibilityState={{ selected }}
            accessibilityLabel={`${c.name}. ${c.tagline}`} onPress={() => choose(c.id, c.name)}>
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
      <Body muted>Tap a companion to hear their voice.</Body>
    </View>
  );
}
