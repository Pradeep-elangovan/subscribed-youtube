import { OAuth2Client } from 'google-auth-library';
import { SignJWT, jwtVerify } from 'jose';
import type { MiddlewareHandler } from 'hono';
import { config } from './config.js';

export type AppEnv = { Variables: { userId: string } };

const secret = new TextEncoder().encode(config.jwtSecret);
const googleClient = new OAuth2Client();

export interface GoogleProfile {
  sub: string;
  email: string;
  name: string | null;
  picture: string | null;
}

/** Verifies a Google ID token (from web or Android sign-in) and returns the profile. */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile> {
  if (config.googleClientIds.length === 0) throw new Error('GOOGLE_CLIENT_IDS is not configured');
  const ticket = await googleClient.verifyIdToken({ idToken, audience: config.googleClientIds });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) throw new Error('Google token has no subject or email');
  return {
    sub: payload.sub,
    email: payload.email,
    name: payload.name ?? null,
    picture: payload.picture ?? null,
  };
}

export async function signSession(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret);
}

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) return c.json({ error: 'Missing bearer token' }, 401);
  try {
    const { payload } = await jwtVerify(header.slice(7), secret, { algorithms: ['HS256'] });
    if (!payload.sub) throw new Error('no subject');
    c.set('userId', payload.sub);
  } catch {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
  await next();
};
