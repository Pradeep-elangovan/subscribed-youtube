import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Channel } from '@subtube/shared';
import { api } from '../api';
import { googleConfigured, requestYouTubeAccessToken } from '../google';
import type { RootStackParamList } from '../navigation';
import { useTheme } from '../theme';

export function ChannelsScreen() {
  const t = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [channels, setChannels] = useState<Channel[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(
    () => api.channels().then(setChannels).catch((e: Error) => setMessage(e.message)),
    [],
  );
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = async (fn: () => Promise<{ imported: number } | null>) => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await fn();
      if (result) {
        setMessage(`Imported ${result.imported} channel${result.imported === 1 ? '' : 's'}. Videos appear as they load.`);
        await refresh();
      }
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const syncGoogle = () => run(async () => api.syncGoogle(await requestYouTubeAccessToken()));

  const uploadCsv = () =>
    run(async () => {
      const picked = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'text/*', '*/*'] });
      const asset = picked.assets?.[0];
      if (picked.canceled || !asset) return null;
      const csv = await (await fetch(asset.uri)).text();
      return api.importCsv(csv);
    });

  const setGroup = (channel: Channel, value: string) => {
    const group = value.trim() || null;
    if (group === channel.group) return;
    setChannels((list) => list?.map((c) => (c.id === channel.id ? { ...c, group } : c)) ?? null);
    api.setGroup(channel.id, group).catch((e: Error) => setMessage(e.message));
  };

  const remove = (channel: Channel) =>
    Alert.alert('Remove channel', `Remove ${channel.title} from this app? Your YouTube subscription is not affected.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          setChannels((list) => list?.filter((c) => c.id !== channel.id) ?? null);
          api.unsubscribe(channel.id).catch((e: Error) => setMessage(e.message));
        },
      },
    ]);

  return (
    <FlatList
      style={{ backgroundColor: t.bg }}
      contentContainerStyle={styles.list}
      data={channels ?? []}
      keyExtractor={(c) => c.id}
      ListHeaderComponent={
        <View style={[styles.panel, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Text style={[styles.heading, { color: t.text }]}>Import subscriptions</Text>
          <View style={styles.row}>
            <Pressable
              disabled={busy || !googleConfigured}
              onPress={() => void syncGoogle()}
              style={[styles.pill, { borderColor: t.border, opacity: busy || !googleConfigured ? 0.5 : 1 }]}
            >
              <Text style={{ color: t.text }}>Sync from Google</Text>
            </Pressable>
            <Pressable
              disabled={busy}
              onPress={() => void uploadCsv()}
              style={[styles.pill, { borderColor: t.border, opacity: busy ? 0.5 : 1 }]}
            >
              <Text style={{ color: t.text }}>Upload Takeout CSV</Text>
            </Pressable>
            {busy && <ActivityIndicator color={t.muted} />}
          </View>
          <Text style={{ color: t.muted, fontSize: 13 }}>
            Takeout: takeout.google.com, select only YouTube, choose Subscriptions, then pick subscriptions.csv here.
          </Text>
          {message && <Text style={{ color: t.muted }}>{message}</Text>}
        </View>
      }
      ListEmptyComponent={channels?.length === 0 ? <Text style={{ color: t.muted, textAlign: 'center' }}>No channels yet.</Text> : null}
      renderItem={({ item }) => (
        <View style={[styles.item, { borderColor: t.border }]}>
          <Text
            style={[styles.name, { color: t.text }]}
            numberOfLines={1}
            onPress={() => navigation.navigate('Channel', { id: item.id, title: item.title })}
          >
            {item.title}
          </Text>
          <TextInput
            defaultValue={item.group ?? ''}
            placeholder="Group"
            placeholderTextColor={t.muted}
            maxLength={60}
            onEndEditing={(e) => setGroup(item, e.nativeEvent.text)}
            style={[styles.group, { color: t.text, borderColor: t.border }]}
          />
          <Text style={{ color: t.muted }} onPress={() => remove(item)}>
            Remove
          </Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 12, gap: 4 },
  panel: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 10, marginBottom: 12 },
  heading: { fontSize: 16, fontWeight: '600' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  name: { flex: 1 },
  group: { width: 100, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, fontSize: 13 },
});
