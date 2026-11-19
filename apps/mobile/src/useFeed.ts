import { useCallback, useEffect, useRef, useState } from 'react';
import type { FeedParams, FeedVideo, VideoStatePatch } from '@subtube/shared';
import { api } from './api';

/** Cursor-paged feed. `done` becomes true when the server reports there is nothing older. */
export function useFeed(params: FeedParams) {
  const [videos, setVideos] = useState<FeedVideo[]>([]);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const generation = useRef(0);
  const cursor = useRef<string | null>(null);
  const busy = useRef(false);
  const finished = useRef(false);

  const paramsKey = JSON.stringify(params);
  const lastParamsKey = useRef(paramsKey);
  const key = `${paramsKey}#${nonce}`;

  const loadMore = useCallback(async () => {
    if (busy.current || finished.current) return;
    busy.current = true;
    setLoading(true);
    setError(null);
    const gen = generation.current;
    try {
      const page = await api.feed({ ...params, cursor: cursor.current ?? undefined });
      if (gen !== generation.current) return;
      setVideos((prev) => (cursor.current === null ? page.videos : [...prev, ...page.videos]));
      cursor.current = page.nextCursor;
      if (page.nextCursor === null) {
        finished.current = true;
        setDone(true);
      }
    } catch (err) {
      if (gen === generation.current) setError((err as Error).message);
    } finally {
      if (gen === generation.current) {
        busy.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Start over whenever the filters change or the person pulls to refresh.
  // The old list stays on screen during a refresh and is replaced when the first page arrives.
  useEffect(() => {
    generation.current++;
    cursor.current = null;
    busy.current = false;
    finished.current = false;
    if (lastParamsKey.current !== paramsKey) {
      lastParamsKey.current = paramsKey;
      setVideos([]); // different filters: don't show the old results while loading
    }
    setDone(false);
    setError(null);
    void loadMore();
  }, [loadMore]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setNonce((n) => n + 1);
  }, []);

  /** Optimistically update one video, then tell the server. Rolls back on failure. */
  const updateVideo = useCallback((id: string, patch: VideoStatePatch) => {
    let previous: FeedVideo | undefined;
    setVideos((prev) =>
      prev.map((v) => {
        if (v.id !== id) return v;
        previous = v;
        return { ...v, ...patch };
      }),
    );
    api.setVideoState(id, patch).catch(() => {
      if (previous) setVideos((prev) => prev.map((v) => (v.id === id ? previous! : v)));
    });
  }, []);

  return { videos, done, loading, refreshing, error, loadMore, refresh, updateVideo };
}
