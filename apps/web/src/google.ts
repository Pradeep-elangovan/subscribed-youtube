// Thin wrapper around Google Identity Services (https://accounts.google.com/gsi/client).

const CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';
const YOUTUBE_SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';

// The GIS script has no bundled types; only the parts used here are described loosely.
/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    google?: any;
  }
}

let loader: Promise<void> | null = null;

function loadGoogle(): Promise<void> {
  if (window.google?.accounts) return Promise.resolve();
  loader ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loader = null;
      reject(new Error('Could not load Google sign-in'));
    };
    document.head.appendChild(script);
  });
  return loader;
}

export const googleConfigured = CLIENT_ID !== '';

/** Renders the official "Sign in with Google" button; calls back with a Google ID token. */
export async function renderSignInButton(el: HTMLElement, onIdToken: (idToken: string) => void): Promise<void> {
  await loadGoogle();
  window.google.accounts.id.initialize({
    client_id: CLIENT_ID,
    callback: (response: { credential: string }) => onIdToken(response.credential),
  });
  window.google.accounts.id.renderButton(el, { theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with' });
}

/** Asks for read-only access to the user's YouTube subscriptions. The token is used once by the API. */
export async function requestYouTubeAccessToken(): Promise<string> {
  await loadGoogle();
  return new Promise<string>((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: YOUTUBE_SCOPE,
      callback: (response: { access_token?: string; error?: string }) =>
        response.access_token ? resolve(response.access_token) : reject(new Error(response.error ?? 'Access denied')),
      error_callback: (err: { type?: string }) => reject(new Error(err.type ?? 'Access denied')),
    });
    client.requestAccessToken();
  });
}
