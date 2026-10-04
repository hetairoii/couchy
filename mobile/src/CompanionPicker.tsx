import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { getPreview, absolute } from './api';
import { playUri, stopPlayback } from './audio';
import { Avatar } from './Avatar';
import { COMPANIONS } from './companions';
import { Icon } from './Icon';
import { colors, fonts } from './theme';
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
    <View style={{ gap: 14 }}>
      {COMPANIONS.map((c) => {
        const selected = c.id === value;
        return (
          <Pressable key={c.id} accessibilityRole="button" accessibilityState={{ selected }}
            accessibilityLabel={`${c.name}. ${c.tagline}`} onPress={() => choose(c.id)}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 96,
              backgroundColor: selected ? c.color : colors.card }}>
              <Avatar companion={c} size={72} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.title, fontSize: 26, color: colors.ink }}>{c.name}</Text>
                <Body style={{ fontSize: 18, lineHeight: 24 }}>{c.tagline}</Body>
              </View>
              {selected && <Icon name="check" size={32} />}
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
