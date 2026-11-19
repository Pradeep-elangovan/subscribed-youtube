import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import YoutubePlayer, { type YoutubeIframeRef } from 'react-native-youtube-iframe';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import type { FeedVideo, VideoStatePatch } from '@subtube/shared';
import { api } from '../api';
import type { RootStackParamList } from '../navigation';
import { useTheme } from '../theme';
import { timeAgo } from '../time';

// rel=0 limits end-of-video suggestions to the same channel. It is not in the library's
// typed params in every version, so it is passed through a loosely typed object.
const playerParams = (start: number) => ({ start, modestbranding: true, rel: false }) as Record<string, unknown>;

export function WatchScreen({ route }: NativeStackScreenProps<RootStackParamList, 'Watch'>) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { id } = route.params;

  const [video, setVideo] = useState<FeedVideo | null | undefined>(undefined);
  const [playing, setPlaying] = useState(true);
  const player = useRef<YoutubeIframeRef>(null);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    setVideo(undefined);
    api
      .video(id)
      .then(setVideo)
      .catch(() => setVideo(null));
  }, [id]);

  const update = useCallback(
    (patch: VideoStatePatch) => {
      setVideo((v) => (v ? { ...v, ...patch } : v));
      api.setVideoState(id, patch).catch(() => undefined);
    },
    [id],
  );

  const saveProgress = useCallback(async () => {
    const seconds = Math.floor((await player.current?.getCurrentTime()) ?? 0);
    if (seconds > 0) api.setVideoState(id, { progressSeconds: seconds }).catch(() => undefined);
  }, [id]);

  // Save progress when leaving the screen.
  useEffect(
    () => () => {
      clearInterval(timer.current);
      void saveProgress();
    },
    [saveProgress],
  );

  const onChangeState = (state: string) => {
    clearInterval(timer.current);
    if (state === 'playing') timer.current = setInterval(() => void saveProgress(), 15_000);
    if (state === 'paused') void saveProgress();
    if (state === 'ended') {
      setPlaying(false);
      update({ watched: true, progressSeconds: 0 });
    }
  };

  if (video === undefined) return <View style={[styles.fill, { backgroundColor: t.bg }]} />;
  if (video === null) {
    return (
      <View style={[styles.fill, styles.center, { backgroundColor: t.bg }]}>
        <Text style={{ color: t.muted }}>This video isn’t from one of your subscriptions.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={{ paddingBottom: 32 }}>
      <YoutubePlayer
        ref={player}
        height={Math.round((width * 9) / 16)}
        width={width}
        videoId={video.id}
        play={playing}
        onChangeState={onChangeState}
        initialPlayerParams={playerParams(video.watched ? 0 : video.progressSeconds)}
      />
      <View style={styles.body}>
        <Text style={[styles.title, { color: t.text }]}>{video.title}</Text>
        <Text
          style={{ color: t.muted }}
          onPress={() => navigation.navigate('Channel', { id: video.channelId, title: video.channelTitle })}
        >
          {video.channelTitle} · {timeAgo(video.publishedAt)}
        </Text>
        <View style={styles.row}>
          <Text style={[styles.action, { color: t.text, borderColor: t.border }]} onPress={() => update({ watchLater: !video.watchLater })}>
            {video.watchLater ? 'Saved ✓' : 'Watch later'}
          </Text>
          <Text style={[styles.action, { color: t.text, borderColor: t.border }]} onPress={() => update({ watched: !video.watched })}>
            {video.watched ? 'Mark unwatched' : 'Mark watched'}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center', padding: 32 },
  body: { padding: 16, gap: 8 },
  title: { fontSize: 18, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 10, marginTop: 8 },
  action: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, overflow: 'hidden' },
});
