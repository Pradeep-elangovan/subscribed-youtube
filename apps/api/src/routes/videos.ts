import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth, type AppEnv } from '../auth.js';
import { query } from '../db.js';
import { VIDEO_SELECT, toVideo } from './feed.js';

export const videoRoutes = new Hono<AppEnv>();
videoRoutes.use('*', requireAuth);

const StatePatch = z
  .object({
    watched: z.boolean(),
    watchLater: z.boolean(),
    progressSeconds: z.number().int().min(0).max(86_400),
  })
  .partial();

// Update watched / watch-later / progress for one video. Only videos from the
// user's own subscriptions can be touched.
videoRoutes.put('/videos/:id/state', async (c) => {
  const body = StatePatch.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: 'Invalid body' }, 400);
  const { watched, watchLater, progressSeconds } = body.data;
  const userId = c.get('userId');
  const videoId = c.req.param('id');

  const rows = await query(
    `INSERT INTO watch_state (user_id, video_id, watched, watch_later, progress_seconds)
     SELECT $1::uuid, v.id, COALESCE($3::boolean, false), COALESCE($4::boolean, false), COALESCE($5::integer, 0)
     FROM videos v
     JOIN subscriptions s ON s.channel_id = v.channel_id AND s.user_id = $1::uuid
     WHERE v.id = $2
     ON CONFLICT (user_id, video_id) DO UPDATE SET
       watched = COALESCE($3::boolean, watch_state.watched),
       watch_later = COALESCE($4::boolean, watch_state.watch_later),
       progress_seconds = COALESCE($5::integer, watch_state.progress_seconds),
       updated_at = now()
     RETURNING video_id`,
    [userId, videoId, watched ?? null, watchLater ?? null, progressSeconds ?? null],
  );
  if (rows.length === 0) return c.json({ error: 'Video not found in your subscriptions' }, 404);
  return c.body(null, 204);
});

videoRoutes.get('/watch-later', async (c) => {
  const rows = await query(
    `${VIDEO_SELECT}
     WHERE s.user_id = $1 AND w.watch_later = true
     ORDER BY w.updated_at DESC
     LIMIT 200`,
    [c.get('userId')],
  );
  return c.json({ videos: (rows as Parameters<typeof toVideo>[0][]).map(toVideo) });
});
