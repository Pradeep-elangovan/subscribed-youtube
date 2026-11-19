import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import type { Channel } from '@subtube/shared';
import { api } from '../api';
import { useAuth } from '../auth';
import { FeedList } from '../components';
import type { TabParamList } from '../navigation';
import { useTheme } from '../theme';

export function FeedScreen() {
  const t = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<BottomTabNavigationProp<TabParamList, 'Feed'>>();
  const shortsMode = user?.settings.shortsMode ?? 'tab';

  const [tab, setTab] = useState<'videos' | 'shorts'>('videos');
  const [group, setGroup] = useState<string | null>(null);
  const [hideWatched, setHideWatched] = useState(false);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [channels, setChannels] = useState<Channel[] | null>(null);

  // Reload channels whenever this tab is focused (e.g. after importing).
  useEffect(() => {
    const load = () => api.channels().then(setChannels).catch(() => setChannels([]));
    void load();
    return navigation.addListener('focus', () => void load());
  }, [navigation]);

  // Wait for the person to stop typing before searching.
  useEffect(() => {
    const timer = setTimeout(() => setQ(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const groups = [...new Set((channels ?? []).map((c) => c.group).filter((g): g is string => !!g))].sort();
  const showShortsTab = shortsMode !== 'hidden';
  const activeTab = showShortsTab ? tab : 'videos';

  if (channels && channels.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: t.bg }]}>
        <Text style={[styles.heading, { color: t.text }]}>Add your subscriptions to get started</Text>
        <Text style={{ color: t.muted, textAlign: 'center' }}>
          Import them from Google or a Takeout file on the Channels tab.
        </Text>
        <Pressable onPress={() => navigation.navigate('Channels')} style={[styles.pill, { borderColor: t.border }]}>
          <Text style={{ color: t.text }}>Go to Channels</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <View style={styles.filters}>
        {showShortsTab && (
          <View style={styles.row}>
            {(['videos', 'shorts'] as const).map((name) => (
              <Pressable
                key={name}
                onPress={() => setTab(name)}
                style={[
                  styles.pill,
                  { borderColor: t.border },
                  activeTab === name && { backgroundColor: t.text, borderColor: t.text },
                ]}
              >
                <Text style={{ color: activeTab === name ? t.bg : t.text }}>{name === 'videos' ? 'Videos' : 'Shorts'}</Text>
              </Pressable>
            ))}
          </View>
        )}
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search your subscriptions"
          placeholderTextColor={t.muted}
          style={[styles.input, { color: t.text, backgroundColor: t.surface, borderColor: t.border }]}
          returnKeyType="search"
        />
        {groups.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {[null, ...groups].map((g) => (
              <Pressable
                key={g ?? 'all'}
                onPress={() => setGroup(g)}
                style={[styles.pill, { borderColor: t.border }, group === g && { backgroundColor: t.text, borderColor: t.text }]}
              >
                <Text style={{ color: group === g ? t.bg : t.text }}>{g ?? 'All groups'}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
        <View style={[styles.row, { alignItems: 'center' }]}>
          <Switch value={hideWatched} onValueChange={setHideWatched} />
          <Text style={{ color: t.muted }}>Hide watched</Text>
        </View>
      </View>
      <FeedList
        short={activeTab === 'shorts'}
        params={{ tab: activeTab, group: group ?? undefined, q: q || undefined, hideWatched }}
        empty={q ? `Nothing matches “${q}”.` : 'Nothing here yet. New uploads appear within a few minutes.'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 12 },
  heading: { fontSize: 18, fontWeight: '600', textAlign: 'center' },
  filters: { paddingHorizontal: 12, paddingTop: 8, gap: 10 },
  row: { flexDirection: 'row', gap: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15 },
});
