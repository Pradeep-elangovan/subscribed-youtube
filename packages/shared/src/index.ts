// Types shared between the API, the web app and the Android app.

export type ShortsMode = 'tab' | 'hidden' | 'mixed';

export interface UserSettings {
  /** tab = separate Shorts tab, hidden = never show, mixed = inside the main feed */
  shortsMode: ShortsMode;
}

export const DEFAULT_SETTINGS: UserSettings = { shortsMode: 'tab' };

export interface User {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
  settings: UserSettings;
}

export interface Channel {
  id: string;
  title: string;
  thumbnail: string | null;
  group: string | null;
}

export interface FeedVideo {
  id: string;
  title: string;
  publishedAt: string;
  thumbnail: string | null;
  isShort: boolean;
  channelId: string;
  channelTitle: string;
  channelThumbnail: string | null;
  watched: boolean;
  watchLater: boolean;
  progressSeconds: number;
}

export interface FeedPage {
  videos: FeedVideo[];
  /** null means the end of the feed: show the "you're all caught up" state */
  nextCursor: string | null;
}

export interface VideoStatePatch {
  watched?: boolean;
  watchLater?: boolean;
  progressSeconds?: number;
}
