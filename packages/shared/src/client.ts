// Platform-agnostic API client used by both the web app and the Android app.
// Each app supplies its own base URL and token storage.

import type { Channel, FeedPage, FeedVideo, User, UserSettings, VideoStatePatch } from './index';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export interface FeedParams {
  tab?: 'videos' | 'shorts';
  channel?: string;
  group?: string;
  q?: string;
  hideWatched?: boolean;
  cursor?: string;
}

export interface ApiOptions {
  baseUrl: string;
  /** Sync on web (localStorage), async on Android (SecureStore). */
  getToken: () => string | null | Promise<string | null>;
  /** Called when the server rejects a token that was sent (expired or revoked). */
  onUnauthorized?: () => void;
}

interface RequestOptions {
  method?: string;
  body?: string;
  headers?: Record<string, string>;
}

export function createApi(opts: ApiOptions) {
  async function request<T>(path: string, init: RequestOptions = {}): Promise<T> {
    const token = await opts.getToken();
    const headers: Record<string, string> = { ...init.headers };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (typeof init.body === 'string' && !headers['Content-Type']) headers['Content-Type'] = 'application/json';

    const res = await fetch(`${opts.baseUrl}${path}`, { method: init.method, body: init.body, headers });
    if (res.status === 401 && token) opts.onUnauthorized?.();
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new ApiError(res.status, body?.error ?? `Request failed (${res.status})`);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  const enc = encodeURIComponent;

  return {
    loginWithGoogle: (idToken: string) =>
      request<{ token: string; user: User }>('/auth/google', { method: 'POST', body: JSON.stringify({ idToken }) }),
    me: () => request<User>('/me'),
    updateSettings: (patch: Partial<UserSettings>) =>
      request<User>('/me/settings', { method: 'PATCH', body: JSON.stringify(patch) }),
    deleteAccount: () => request<void>('/me', { method: 'DELETE' }),

    channels: () => request<{ channels: Channel[] }>('/subscriptions').then((r) => r.channels),
    importCsv: (csv: string) =>
      request<{ imported: number }>('/subscriptions/import-csv', {
        method: 'POST',
        body: csv,
        headers: { 'Content-Type': 'text/csv' },
      }),
    syncGoogle: (accessToken: string) =>
      request<{ imported: number }>('/subscriptions/sync-google', {
        method: 'POST',
        body: JSON.stringify({ accessToken }),
      }),
    setGroup: (channelId: string, group: string | null) =>
      request<void>(`/subscriptions/${enc(channelId)}`, { method: 'PATCH', body: JSON.stringify({ group }) }),
    unsubscribe: (channelId: string) => request<void>(`/subscriptions/${enc(channelId)}`, { method: 'DELETE' }),

    feed: (params: FeedParams) => {
      const qs: string[] = [];
      if (params.tab) qs.push(`tab=${enc(params.tab)}`);
      if (params.channel) qs.push(`channel=${enc(params.channel)}`);
      if (params.group) qs.push(`group=${enc(params.group)}`);
      if (params.q) qs.push(`q=${enc(params.q)}`);
      if (params.hideWatched) qs.push('hideWatched=true');
      if (params.cursor) qs.push(`cursor=${enc(params.cursor)}`);
      return request<FeedPage>(`/feed?${qs.join('&')}`);
    },
    video: (id: string) => request<FeedVideo>(`/videos/${enc(id)}`),
    setVideoState: (id: string, patch: VideoStatePatch) =>
      request<void>(`/videos/${enc(id)}/state`, { method: 'PUT', body: JSON.stringify(patch) }),
    watchLater: () => request<{ videos: FeedVideo[] }>('/watch-later').then((r) => r.videos),
  };
}

export type Api = ReturnType<typeof createApi>;
