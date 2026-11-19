import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth, signSession, verifyGoogleIdToken, type AppEnv } from '../auth.js';
import { query } from '../db.js';

export const authRoutes = new Hono<AppEnv>();

const SettingsSchema = z.object({ shortsMode: z.enum(['tab', 'hidden', 'mixed']) }).partial();

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
  settings: Record<string, unknown>;
}

const toUser = (u: UserRow) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  picture: u.picture,
  settings: { shortsMode: 'tab', ...u.settings },
});

// Exchange a Google ID token for a session token.
authRoutes.post('/auth/google', async (c) => {
  const body = z.object({ idToken: z.string().min(1) }).safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: 'idToken is required' }, 400);

  let profile;
  try {
    profile = await verifyGoogleIdToken(body.data.idToken);
  } catch {
    return c.json({ error: 'Google sign-in could not be verified' }, 401);
  }

  const [user] = await query<UserRow>(
    `INSERT INTO users (google_sub, email, name, picture)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (google_sub) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name, picture = EXCLUDED.picture
     RETURNING id, email, name, picture, settings`,
    [profile.sub, profile.email, profile.name, profile.picture],
  );
  return c.json({ token: await signSession(user!.id), user: toUser(user!) });
});

authRoutes.get('/me', requireAuth, async (c) => {
  const [user] = await query<UserRow>(
    `SELECT id, email, name, picture, settings FROM users WHERE id = $1`,
    [c.get('userId')],
  );
  if (!user) return c.json({ error: 'User not found' }, 404);
  return c.json(toUser(user));
});

authRoutes.patch('/me/settings', requireAuth, async (c) => {
  const body = SettingsSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: 'Invalid settings' }, 400);
  const [user] = await query<UserRow>(
    `UPDATE users SET settings = settings || $2::jsonb WHERE id = $1
     RETURNING id, email, name, picture, settings`,
    [c.get('userId'), JSON.stringify(body.data)],
  );
  return c.json(toUser(user!));
});

// Account deletion: removes the user and, via cascades, their subscriptions and watch state.
authRoutes.delete('/me', requireAuth, async (c) => {
  await query(`DELETE FROM users WHERE id = $1`, [c.get('userId')]);
  return c.body(null, 204);
});
