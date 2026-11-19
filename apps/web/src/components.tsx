import { useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { FeedVideo, VideoStatePatch } from '@subtube/shared';
import type { FeedParams } from './api';
import { useFeed } from './useFeed';

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

export function timeAgo(iso: string): string {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['week', 604_800],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ];
  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return 'just now';
}

export function VideoCard({
  video,
  onChange,
}: {
  video: FeedVideo;
  onChange: (id: string, patch: VideoStatePatch) => void;
}) {
  const thumb = video.thumbnail ?? `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`;
  return (
    <article className={`card${video.watched ? ' watched' : ''}${video.isShort ? ' short' : ''}`}>
      <Link to={`/watch/${video.id}`} className="thumb">
        <img src={thumb} alt="" loading="lazy" />
        {video.watched && <span className="badge">Watched</span>}
      </Link>
      <div className="meta">
        <Link to={`/watch/${video.id}`} className="title">
          {video.title}
        </Link>
        <div className="sub">
          <Link to={`/channel/${video.channelId}`}>{video.channelTitle}</Link>
          <span> · {timeAgo(video.publishedAt)}</span>
        </div>
        <div className="actions">
          <button
            className="link"
            onClick={() => onChange(video.id, { watchLater: !video.watchLater })}
            aria-pressed={video.watchLater}
          >
            {video.watchLater ? 'Saved ✓' : 'Watch later'}
          </button>
          <button className="link" onClick={() => onChange(video.id, { watched: !video.watched })}>
            {video.watched ? 'Mark unwatched' : 'Mark watched'}
          </button>
        </div>
      </div>
    </article>
  );
}

/** Infinite list of videos. Shows "you're all caught up" when the feed ends. */
export function FeedList({ params, empty }: { params: FeedParams; empty: ReactNode }) {
  const { videos, done, loading, error, loadMore, updateVideo } = useFeed(params);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) void loadMore();
    }, { rootMargin: '400px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  const isShorts = params.tab === 'shorts';
  return (
    <>
      <div className={isShorts ? 'grid shorts-grid' : 'grid'}>
        {videos.map((v) => (
          <VideoCard key={v.id} video={v} onChange={updateVideo} />
        ))}
      </div>
      <div ref={sentinel} />
      {loading && <p className="note">Loading…</p>}
      {error && (
        <p className="note error">
          {error} <button className="link" onClick={() => void loadMore()}>Retry</button>
        </p>
      )}
      {done && videos.length === 0 && <div className="note">{empty}</div>}
      {done && videos.length > 0 && <p className="caught-up">You’re all caught up ✓</p>}
    </>
  );
}
