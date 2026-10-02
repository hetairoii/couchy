import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { colors, font, TOUCH } from './theme';

export function Title({ children }: { children: ReactNode }) {
  return <Text style={styles.title} accessibilityRole="header">{children}</Text>;
}

export function Body({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return <Text style={[styles.body, muted && { color: colors.muted }]}>{children}</Text>;
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
};

export function BigButton({ label, onPress, variant = 'primary', disabled }: ButtonProps) {
  const bg = variant === 'primary' ? colors.primary : variant === 'danger' ? colors.danger : colors.card;
  const fg = variant === 'secondary' ? colors.primary : colors.primaryText;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        variant === 'secondary' && { borderWidth: 2, borderColor: colors.primary },
      ]}
    >
      <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, ...props }: { label: string } & TextInputProps) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput {...props} placeholderTextColor={colors.muted} style={styles.input} />
    </View>
  );
}

export function Chip({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.chip, { backgroundColor: color }]}>
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: font.title, fontWeight: '800', color: colors.text },
  body: { fontSize: font.body, color: colors.text, lineHeight: 28 },
  card: {
    backgroundColor: colors.card, borderRadius: 20, padding: 20, gap: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  button: { minHeight: TOUCH, borderRadius: 18, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 24, fontWeight: '700', textAlign: 'center' },
  label: { fontSize: font.label, fontWeight: '600', color: colors.text },
  input: {
    minHeight: TOUCH, borderWidth: 2, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 16,
    fontSize: font.body, backgroundColor: colors.card, color: colors.text,
  },
  chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6, alignSelf: 'flex-start' },
  chipText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
