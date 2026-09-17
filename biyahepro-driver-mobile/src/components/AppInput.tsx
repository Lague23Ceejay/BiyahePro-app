import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';
import { colors } from '@/src/theme/colors';

export function AppInput({ label, secureTextEntry, ...props }: TextInputProps & { label: string }) {
  const [visible, setVisible] = useState(false);
  const isPasswordField = !!secureTextEntry;
  return <View style={styles.group}><Text style={styles.label}>{label}</Text><View style={styles.row}><TextInput placeholderTextColor="#98A2B3" style={[styles.input, isPasswordField && styles.inputWithToggle]} secureTextEntry={isPasswordField && !visible} {...props} />{isPasswordField && <Pressable onPress={() => setVisible(value => !value)} hitSlop={10} style={styles.toggle} accessibilityRole="button" accessibilityLabel={visible ? 'Hide password' : 'Show password'}><Text style={styles.toggleText}>{visible ? 'Hide' : 'Show'}</Text></Pressable>}</View></View>;
}

const styles = StyleSheet.create({ group: { gap: 7 }, label: { color: colors.text, fontSize: 12, fontWeight: '700' }, row: { position: 'relative', justifyContent: 'center' }, input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 11, paddingHorizontal: 14, color: colors.text, backgroundColor: colors.background, fontSize: 14 }, inputWithToggle: { paddingRight: 60 }, toggle: { position: 'absolute', right: 14 }, toggleText: { color: colors.brand, fontWeight: '800', fontSize: 12 } });
