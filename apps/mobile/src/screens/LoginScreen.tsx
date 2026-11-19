import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth';
import { googleConfigured, signInWithGoogle } from '../google';
import { useTheme } from '../theme';

export function LoginScreen() {
  const t = useTheme();
  const { signIn } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onPress = async () => {
    setBusy(true);
    setError(null);
    try {
      const idToken = await signInWithGoogle();
      if (idToken) await signIn(idToken);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <Text style={[styles.title, { color: t.text }]}>Subscribed</Text>
      <Text style={[styles.sub, { color: t.muted }]}>
        Only the videos from channels you subscribe to. No recommendations, nothing else.
      </Text>
      {googleConfigured ? (
        <Pressable
          onPress={() => void onPress()}
          disabled={busy}
          style={[styles.button, { backgroundColor: t.text, opacity: busy ? 0.6 : 1 }]}
        >
          {busy ? <ActivityIndicator color={t.bg} /> : <Text style={{ color: t.bg, fontWeight: '600' }}>Continue with Google</Text>}
        </Pressable>
      ) : (
        <Text style={{ color: t.accent, textAlign: 'center' }}>
          Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in apps/mobile/.env to enable sign-in.
        </Text>
      )}
      {error && <Text style={{ color: t.accent, textAlign: 'center' }}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 32, gap: 16 },
  title: { fontSize: 32, fontWeight: '700', textAlign: 'center' },
  sub: { fontSize: 15, textAlign: 'center', marginBottom: 8 },
  button: { paddingVertical: 14, borderRadius: 999, alignItems: 'center' },
});
