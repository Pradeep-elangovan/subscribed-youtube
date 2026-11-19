import { useCallback, useEffect, useRef, useState } from 'react';
import type { FeedVideo, VideoStatePatch } from '@subtube/shared';
import { api, type FeedParams } from './api';

/** Cursor-paged feed. `done` becomes true when the server reports there is nothing older. */
export function useFeed(params: FeedParams) {
  const [videos, setVideos] = useState<FeedVideo[]>([]);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generation = useRef(0);
  const cursor = useRef<string | null>(null);
  const busy = useRef(false);
  const finished = useRef(false);

  const key = JSON.stringify(params);

  const loadMore = useCallback(async () => {
    if (busy.current || finished.current) return;
    busy.current = true;
    setLoading(true);
    setError(null);
    const gen = generation.current;
    try {
      const page = await api.feed({ ...params, cursor: cursor.current ?? undefined });
      if (gen !== generation.current) return;
      setVideos((prev) => [...prev, ...page.videos]);
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
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Start over whenever the filters change.
  useEffect(() => {
    generation.current++;
    cursor.current = null;
    busy.current = false;
    finished.current = false;
    setVideos([]);
    setDone(false);
    setError(null);
    void loadMore();
  }, [loadMore]);

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

  return { videos, done, loading, error, loadMore, updateVideo };
}
