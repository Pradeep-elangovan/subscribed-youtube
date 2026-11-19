import { ApiError, createApi, type FeedParams } from '@subtube/shared';

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

export { ApiError };
export type { FeedParams };

export const api = createApi({
  baseUrl: BASE,
  getToken,
  onUnauthorized: () => {
    setToken(null);
    window.dispatchEvent(new Event('subtube:unauthorized'));
  },
});
