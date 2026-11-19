import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { FeedVideo, VideoStatePatch } from '@subtube/shared';
import { api } from '../api';
import { VideoCard } from '../components';
import { useTheme } from '../theme';

export function WatchLaterScreen() {
  const t = useTheme();
  const navigation = useNavigation();
  const [videos, setVideos] = useState<FeedVideo[] | null>(null);

  // Reload whenever the tab is focused so videos saved elsewhere show up.
  useEffect(() => {
    const load = () => api.watchLater().then(setVideos).catch(() => setVideos([]));
    void load();
    return navigation.addListener('focus', () => void load());
  }, [navigation]);

  const change = (id: string, patch: VideoStatePatch) => {
    // Un-saving removes the video from this list right away.
    setVideos((list) => list?.map((v) => (v.id === id ? { ...v, ...patch } : v)).filter((v) => v.watchLater) ?? null);
    api.setVideoState(id, patch).catch(() => undefined);
  };

  return (
    <FlatList
      style={{ backgroundColor: t.bg }}
      contentContainerStyle={styles.list}
      data={videos ?? []}
      keyExtractor={(v) => v.id}
      renderItem={({ item }) => <VideoCard video={item} onChange={change} />}
      ListEmptyComponent={
        videos?.length === 0 ? (
          <Text style={{ color: t.muted, textAlign: 'center', padding: 24 }}>
            Nothing saved. Use “Watch later” on any video.
          </Text>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 12, gap: 18 },
});
