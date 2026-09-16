import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '@/src/theme/colors';

type Props = { title: string; onPress: () => void; loading?: boolean; disabled?: boolean; variant?: 'primary' | 'secondary' | 'danger' };

export function AppButton({ title, onPress, loading, disabled, variant = 'primary' }: Props) {
  return (
    <Pressable onPress={onPress} disabled={disabled || loading} style={({ pressed }) => [styles.base, styles[variant], pressed && styles.pressed, (disabled || loading) && styles.disabled]}>
      {loading ? <ActivityIndicator color={variant === 'primary' ? '#fff' : colors.brand} /> : <Text style={[styles.text, variant !== 'primary' && styles.altText]}>{title}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 50, borderRadius: 13, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  primary: { backgroundColor: colors.brand }, secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, danger: { backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: '#FECDCA' },
  text: { color: '#fff', fontSize: 15, fontWeight: '800' }, altText: { color: colors.brandDark }, pressed: { opacity: 0.78 }, disabled: { opacity: 0.5 },
});
