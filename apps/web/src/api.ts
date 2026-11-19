import type { Channel, FeedPage, FeedVideo, User, UserSettings, VideoStatePatch } from '@subtube/shared';

const BASE: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8787';
const TOKEN_KEY = 'subtube.token';

export const getToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setToken = (token: string | null): void => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable: the session just won't persist */
  }
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (typeof init.body === 'string' && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (res.status === 401 && token) {
    setToken(null);
    window.dispatchEvent(new Event('subtube:unauthorized'));
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(res.status, body?.error ?? `Request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface FeedParams {
  tab?: 'videos' | 'shorts';
  channel?: string;
  group?: string;
  q?: string;
  hideWatched?: boolean;
  cursor?: string;
}

export const api = {
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
    request<void>(`/subscriptions/${encodeURIComponent(channelId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ group }),
    }),
  unsubscribe: (channelId: string) =>
    request<void>(`/subscriptions/${encodeURIComponent(channelId)}`, { method: 'DELETE' }),

  feed: (params: FeedParams) => {
    const qs = new URLSearchParams();
    if (params.tab) qs.set('tab', params.tab);
    if (params.channel) qs.set('channel', params.channel);
    if (params.group) qs.set('group', params.group);
    if (params.q) qs.set('q', params.q);
    if (params.hideWatched) qs.set('hideWatched', 'true');
    if (params.cursor) qs.set('cursor', params.cursor);
    return request<FeedPage>(`/feed?${qs}`);
  },
  video: (id: string) => request<FeedVideo>(`/videos/${encodeURIComponent(id)}`),
  setVideoState: (id: string, patch: VideoStatePatch) =>
    request<void>(`/videos/${encodeURIComponent(id)}/state`, { method: 'PUT', body: JSON.stringify(patch) }),
  watchLater: () => request<{ videos: FeedVideo[] }>('/watch-later').then((r) => r.videos),
};
