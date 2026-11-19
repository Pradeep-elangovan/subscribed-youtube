import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ShortsMode } from '@subtube/shared';
import { api } from '../api';
import { useAuth } from '../auth';
import { useTheme } from '../theme';

const SHORTS_OPTIONS: { value: ShortsMode; label: string; help: string }[] = [
  { value: 'tab', label: 'Separate tab', help: 'Shorts live in their own tab, out of your main feed.' },
  { value: 'mixed', label: 'Mixed in', help: 'Shorts appear in the main feed alongside videos.' },
  { value: 'hidden', label: 'Hidden', help: 'Never show Shorts.' },
];

export function SettingsScreen() {
  const t = useTheme();
  const { user, setUser, signOut } = useAuth();
  const [error, setError] = useState<string | null>(null);
  if (!user) return null;

  const choose = async (shortsMode: ShortsMode) => {
    setError(null);
    try {
      setUser(await api.updateSettings({ shortsMode }));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const deleteAccount = () =>
    Alert.alert('Delete account', 'Delete your account and all your data? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteAccount();
            await signOut();
          } catch (e) {
            setError((e as Error).message);
          }
        },
      },
    ]);

  const panel = [styles.panel, { backgroundColor: t.surface, borderColor: t.border }];
  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={styles.content}>
      <View style={panel}>
        <Text style={[styles.heading, { color: t.text }]}>Shorts</Text>
        {SHORTS_OPTIONS.map((o) => {
          const selected = user.settings.shortsMode === o.value;
          return (
            <Pressable key={o.value} style={styles.option} onPress={() => void choose(o.value)} accessibilityRole="radio" accessibilityState={{ selected }}>
              <View style={[styles.radio, { borderColor: selected ? t.text : t.border }]}>
                {selected && <View style={[styles.dot, { backgroundColor: t.text }]} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.text, fontWeight: '600' }}>{o.label}</Text>
                <Text style={{ color: t.muted, fontSize: 13 }}>{o.help}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={panel}>
        <Text style={[styles.heading, { color: t.text }]}>Account</Text>
        <Text style={{ color: t.muted }}>Signed in as {user.email}</Text>
        <View style={styles.row}>
          <Pressable onPress={() => void signOut()} style={[styles.pill, { borderColor: t.border }]}>
            <Text style={{ color: t.text }}>Sign out</Text>
          </Pressable>
          <Pressable onPress={deleteAccount} style={[styles.pill, { borderColor: t.accent }]}>
            <Text style={{ color: t.accent }}>Delete account</Text>
          </Pressable>
        </View>
      </View>
      {error && <Text style={{ color: t.accent, textAlign: 'center' }}>{error}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 12, gap: 12 },
  panel: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  heading: { fontSize: 16, fontWeight: '600' },
  option: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 4 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  row: { flexDirection: 'row', gap: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
});
