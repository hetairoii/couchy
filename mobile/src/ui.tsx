import { type ReactNode } from 'react';
import {
  Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type TextInputProps, type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Icon, type IconName } from './Icon';
import { colors, font, fonts, INK, RADIUS, SHADOW, TOUCH } from './theme';

/** Warm paper with grain behind every screen, like the illustrations. */
export function Screen({ children, scroll = true, contentStyle }:
  { children: ReactNode; scroll?: boolean; contentStyle?: ViewStyle }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <Image source={require('../assets/brand/paper.jpg')} resizeMode="cover" style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }}>
        {scroll ? (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, contentStyle]}>
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.content, { flex: 1 }, contentStyle]}>{children}</View>
        )}
      </SafeAreaView>
    </View>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={styles.title} accessibilityRole="header">{children}</Text>;
}

/** Title with a hand-drawn wavy underline. */
export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <View style={{ gap: 2, alignSelf: 'flex-start' }}>
      <Title>{children}</Title>
      <Squiggle />
    </View>
  );
}

export function Squiggle({ width = 96, color = colors.ink }: { width?: number; color?: string }) {
  const waves = Math.floor(width / 16);
  let d = 'M2 6';
  for (let i = 0; i < waves; i++) d += ` q4 -6 8 0 t8 0`;
  return (
    <Svg width={width} height={12} viewBox={`0 0 ${width} 12`}>
      <Path d={d} stroke={color} strokeWidth={2.6} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

export function Body({ children, muted, style }: { children: ReactNode; muted?: boolean; style?: object }) {
  return <Text style={[styles.body, muted && { color: colors.muted }, style]}>{children}</Text>;
}

/** Outlined card with a hard offset shadow. Pass `style` to override the card itself (borders, row layout...). */
export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return (
    <View style={{ paddingRight: SHADOW, paddingBottom: SHADOW }}>
      <View style={styles.shadow} />
      <View style={[styles.card, style]}>{children}</View>
    </View>
  );
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'accent';
  icon?: IconName;
  disabled?: boolean;
  big?: boolean;
};

const BUTTON_COLORS = {
  primary: { bg: colors.primary, fg: colors.primaryText },
  secondary: { bg: colors.card, fg: colors.ink },
  danger: { bg: colors.red, fg: colors.primaryText },
  accent: { bg: colors.mustard, fg: colors.ink },
};

/** Chunky button: ink outline, hard shadow, and it "presses in" when tapped. */
export function BigButton({ label, onPress, variant = 'primary', icon, disabled, big }: ButtonProps) {
  const { bg, fg } = BUTTON_COLORS[variant];
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress}
      style={{ paddingRight: SHADOW, paddingBottom: SHADOW, opacity: disabled ? 0.5 : 1 }}>
      {({ pressed }) => (
        <View>
          {!pressed && <View style={[styles.shadow, { borderRadius: RADIUS - 2 }]} />}
          <View style={[styles.button, { backgroundColor: bg, minHeight: big ? TOUCH + 20 : TOUCH },
            pressed && { transform: [{ translateX: SHADOW }, { translateY: SHADOW }] }]}>
            {icon && <Icon name={icon} size={big ? 34 : 28} color={fg} />}
            <Text style={[styles.buttonText, { color: fg, fontSize: big ? 28 : 24 }]}>{label}</Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

export function Field({ label, ...props }: { label: string } & TextInputProps) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput {...props} placeholderTextColor="#8A8372" style={styles.input} />
    </View>
  );
}

export function Chip({ label, color, dark }: { label: string; color: string; dark?: boolean }) {
  return (
    <View style={[styles.chip, { backgroundColor: color }]}>
      <Text style={[styles.chipText, { color: dark ? colors.ink : colors.primaryText }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 18, paddingBottom: 40 },
  title: { fontFamily: fonts.title, fontSize: font.title, color: colors.ink, lineHeight: 38 },
  body: { fontFamily: fonts.body, fontSize: font.body, color: colors.ink, lineHeight: 28 },
  shadow: {
    position: 'absolute', top: SHADOW, left: SHADOW, right: -SHADOW, bottom: -SHADOW,
    backgroundColor: colors.ink, borderRadius: RADIUS,
  },
  card: {
    backgroundColor: colors.card, borderRadius: RADIUS, padding: 18, gap: 10,
    borderWidth: INK, borderColor: colors.ink,
  },
  button: {
    borderRadius: RADIUS - 2, paddingHorizontal: 20, paddingVertical: 10, borderWidth: INK, borderColor: colors.ink,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  buttonText: { fontFamily: fonts.title, textAlign: 'center', flexShrink: 1 },
  label: { fontFamily: fonts.strong, fontSize: font.label, color: colors.ink },
  input: {
    minHeight: TOUCH, borderWidth: INK, borderColor: colors.ink, borderRadius: 14, paddingHorizontal: 16,
    fontFamily: fonts.body, fontSize: font.body, backgroundColor: colors.card, color: colors.ink,
  },
  chip: {
    borderRadius: 999, paddingHorizontal: 14, paddingVertical: 4, alignSelf: 'flex-start',
    borderWidth: 2.5, borderColor: colors.ink,
  },
  chipText: { fontFamily: fonts.title, fontSize: 17 },
});
