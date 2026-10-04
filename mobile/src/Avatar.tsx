import { Image, View } from 'react-native';
import type { Companion } from './companions';
import { colors } from './theme';

/** Round portrait of a companion. */
export function Avatar({ companion, size = 64 }: { companion: Companion; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden',
      backgroundColor: companion.color, borderWidth: 2, borderColor: colors.border }}>
      <Image source={companion.image} style={{ width: size, height: size }} resizeMode="cover"
        accessibilityLabel={`${companion.name}'s portrait`} />
    </View>
  );
}
