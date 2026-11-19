import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { GOOGLE_WEB_CLIENT_ID } from './config';

const YOUTUBE_SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';

export const googleConfigured = GOOGLE_WEB_CLIENT_ID !== '';

let configured = false;
function ensureConfigured(): void {
  if (configured) return;
  // The web client ID makes Google issue ID tokens the API can verify (audience = web client).
  GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
  configured = true;
}

const isCancel = (err: unknown): boolean => (err as { code?: string } | null)?.code === statusCodes.SIGN_IN_CANCELLED;

/** Native Google sign-in. Returns an ID token, or null if the person closed the dialog. */
export async function signInWithGoogle(): Promise<string | null> {
  ensureConfigured();
  try {
    await GoogleSignin.hasPlayServices();
    // The response shape differs between library versions, so read both.
    const res = (await GoogleSignin.signIn()) as {
      type?: string;
      data?: { idToken?: string | null };
      idToken?: string | null;
    };
    if (res.type === 'cancelled') return null;
    const idToken = res.data?.idToken ?? res.idToken;
    if (!idToken) throw new Error('Google did not return an ID token');
    return idToken;
  } catch (err) {
    if (isCancel(err)) return null;
    throw err;
  }
}

/** Asks for read-only access to the person's YouTube subscriptions. The API uses the token once and never stores it. */
export async function requestYouTubeAccessToken(): Promise<string> {
  ensureConfigured();
  await GoogleSignin.addScopes({ scopes: [YOUTUBE_SCOPE] });
  const { accessToken } = await GoogleSignin.getTokens();
  return accessToken;
}

export async function googleSignOut(): Promise<void> {
  try {
    ensureConfigured();
    await GoogleSignin.signOut();
  } catch {
    /* nothing to sign out of */
  }
}
