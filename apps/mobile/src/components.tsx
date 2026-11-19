import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import type { FeedParams, FeedVideo, VideoStatePatch } from '@subtube/shared';
import type { RootStackParamList } from './navigation';
import { useTheme } from './theme';
import { timeAgo } from './time';
import { useFeed } from './useFeed';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function VideoCard({
  video,
  onChange,
  short = false,
}: {
  video: FeedVideo;
  onChange: (id: string, patch: VideoStatePatch) => void;
  short?: boolean;
}) {
  const t = useTheme();
  const navigation = useNavigation<Nav>();
  const uri = video.thumbnail ?? `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`;

  return (
    <View style={[styles.card, short && styles.shortCard, video.watched && { opacity: 0.6 }]}>
      <Pressable onPress={() => navigation.navigate('Watch', { id: video.id })}>
        <Image
          source={{ uri }}
          style={[styles.thumb, { backgroundColor: t.border }, short && styles.shortThumb]}
          resizeMode="cover"
        />
        {video.watched && (
          <Text style={styles.badge} accessibilityLabel="Watched">
            Watched
          </Text>
        )}
      </Pressable>
      <View style={styles.meta}>
        <Text style={[styles.title, { color: t.text }]} numberOfLines={2}>
          {video.title}
        </Text>
        <Text
          style={{ color: t.muted, fontSize: 13 }}
          numberOfLines={1}
          onPress={() => navigation.navigate('Channel', { id: video.channelId, title: video.channelTitle })}
        >
          {video.channelTitle} · {timeAgo(video.publishedAt)}
        </Text>
        <View style={styles.actions}>
          <Text style={{ color: t.muted, fontSize: 13 }} onPress={() => onChange(video.id, { watchLater: !video.watchLater })}>
            {video.watchLater ? 'Saved ✓' : 'Watch later'}
          </Text>
          <Text style={{ color: t.muted, fontSize: 13 }} onPress={() => onChange(video.id, { watched: !video.watched })}>
            {video.watched ? 'Unwatched' : 'Watched'}
          </Text>
        </View>
      </View>
    </View>
  );
}

/** Infinite list of videos with pull-to-refresh. Shows "you're all caught up" when the feed ends. */
export function FeedList({ params, empty, short = false }: { params: FeedParams; empty: string; short?: boolean }) {
  const t = useTheme();
  const { videos, done, loading, refreshing, error, loadMore, refresh, updateVideo } = useFeed(params);

  return (
    <FlatList
      key={short ? 'shorts' : 'videos'}
      data={videos}
      numColumns={short ? 2 : 1}
      keyExtractor={(v) => v.id}
      renderItem={({ item }) => <VideoCard video={item} onChange={updateVideo} short={short} />}
      columnWrapperStyle={short ? styles.row : undefined}
      onEndReached={() => void loadMore()}
      onEndReachedThreshold={0.6}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={t.muted} />}
      ListFooterComponent={
        <View style={styles.footer}>
          {loading && !refreshing && <ActivityIndicator color={t.muted} />}
          {error && (
            <Text style={{ color: t.accent, textAlign: 'center' }} onPress={() => void loadMore()}>
              {error}. Tap to retry.
            </Text>
          )}
          {done && videos.length === 0 && <Text style={{ color: t.muted, textAlign: 'center' }}>{empty}</Text>}
          {done && videos.length > 0 && (
            <Text style={{ color: t.muted, textAlign: 'center' }}>You’re all caught up ✓</Text>
          )}
        </View>
      }
      contentContainerStyle={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 12, gap: 18 },
  row: { gap: 12 },
  card: { width: '100%' },
  shortCard: { flex: 1 },
  thumb: { width: '100%', aspectRatio: 16 / 9, borderRadius: 12 },
  shortThumb: { aspectRatio: 9 / 16 },
  badge: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.75)',
    color: '#fff',
    fontSize: 12,
  },
  meta: { paddingTop: 8, gap: 2 },
  title: { fontWeight: '600', fontSize: 15 },
  actions: { flexDirection: 'row', gap: 16, marginTop: 4 },
  footer: { paddingVertical: 24, gap: 8 },
});
