import * as SecureStore from 'expo-secure-store';
import { createApi } from '@subtube/shared';
import { API_URL } from './config';

const TOKEN_KEY = 'subtube.token';
let cached: string | null | undefined;

export async function getToken(): Promise<string | null> {
  if (cached === undefined) cached = await SecureStore.getItemAsync(TOKEN_KEY);
  return cached ?? null;
}

export async function setToken(token: string | null): Promise<void> {
  cached = token;
  if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

let unauthorizedHandler: () => void = () => {};
export function setUnauthorizedHandler(fn: () => void): void {
  unauthorizedHandler = fn;
}

export const api = createApi({
  baseUrl: API_URL,
  getToken,
  onUnauthorized: () => {
    void setToken(null);
    unauthorizedHandler();
  },
});
