import { Image, View } from 'react-native';
import type { Companion } from './companions';
import { colors, INK } from './theme';

/** Round portrait of a companion: ink outline and a small hard shadow, like a printed sticker. */
export function Avatar({ companion, size = 64 }: { companion: Companion; size?: number }) {
  const offset = Math.max(3, Math.round(size / 22));
  return (
    <View style={{ width: size + offset, height: size + offset }}>
      <View style={{ position: 'absolute', top: offset, left: offset, width: size, height: size,
        borderRadius: size / 2, backgroundColor: colors.ink }} />
      <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden',
        backgroundColor: companion.color, borderWidth: INK, borderColor: colors.ink }}>
        <Image source={companion.image} style={{ width: size, height: size }} resizeMode="cover"
          accessibilityLabel={`${companion.name}'s portrait`} />
      </View>
    </View>
  );
}
