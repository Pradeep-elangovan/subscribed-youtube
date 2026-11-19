import { useEffect, useRef } from 'react';
import type { VideoStatePatch } from '@subtube/shared';

// Official YouTube IFrame Player API. rel=0 limits end-of-video suggestions to the same channel.
/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiReady: Promise<void> | null = null;

function loadIframeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  apiReady ??= new Promise<void>((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(script);
  });
  return apiReady;
}

interface Props {
  videoId: string;
  startSeconds: number;
  onState: (patch: VideoStatePatch) => void;
}

export function Player({ videoId, startSeconds, onState }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const onStateRef = useRef(onState);
  onStateRef.current = onState;

  useEffect(() => {
    let player: any;
    let timer: number | undefined;
    let cancelled = false;

    const saveProgress = () => {
      const seconds = Math.floor(player?.getCurrentTime?.() ?? 0);
      if (seconds > 0) onStateRef.current({ progressSeconds: seconds });
    };

    void loadIframeApi().then(() => {
      if (cancelled || !host.current) return;
      const mount = document.createElement('div');
      host.current.appendChild(mount);
      player = new window.YT.Player(mount, {
        host: 'https://www.youtube-nocookie.com',
        videoId,
        playerVars: { rel: 0, playsinline: 1, autoplay: 1, start: startSeconds },
        events: {
          onStateChange: (e: { data: number }) => {
            window.clearInterval(timer);
            if (e.data === 1) timer = window.setInterval(saveProgress, 15_000); // playing
            if (e.data === 2) saveProgress(); // paused
            if (e.data === 0) onStateRef.current({ watched: true, progressSeconds: 0 }); // ended
          },
        },
      });
    });

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      try {
        saveProgress();
        player?.destroy?.();
      } catch {
        /* player already gone */
      }
    };
    // Only restart the player when the video itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  return <div className="player" ref={host} />;
}
