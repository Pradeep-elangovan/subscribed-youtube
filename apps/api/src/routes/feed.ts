import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth, type AppEnv } from '../auth.js';
import { query } from '../db.js';

export const feedRoutes = new Hono<AppEnv>();
feedRoutes.use('*', requireAuth);

const PAGE_SIZE = 30;

const FeedQuery = z.object({
  tab: z.enum(['videos', 'shorts']).default('videos'),
  channel: z.string().optional(),
  group: z.string().optional(),
  q: z.string().trim().min(1).max(100).optional(),
  hideWatched: z.enum(['true', 'false']).default('false'),
  cursor: z.string().optional(),
});

interface Row {
  id: string;
  title: string;
  published_at: Date;
  thumbnail: string | null;
  is_short: boolean | null;
  channel_id: string;
  channel_title: string;
  channel_thumbnail: string | null;
  watched: boolean;
  watch_later: boolean;
  progress_seconds: number;
}

export const toVideo = (r: Row) => ({
  id: r.id,
  title: r.title,
  publishedAt: r.published_at.toISOString(),
  thumbnail: r.thumbnail,
  isShort: r.is_short === true,
  channelId: r.channel_id,
  channelTitle: r.channel_title,
  channelThumbnail: r.channel_thumbnail,
  watched: r.watched,
  watchLater: r.watch_later,
  progressSeconds: r.progress_seconds,
});

export const VIDEO_SELECT = `
  SELECT v.id, v.title, v.published_at, v.thumbnail, v.is_short,
         c.id AS channel_id, c.title AS channel_title, c.thumbnail AS channel_thumbnail,
         COALESCE(w.watched, false) AS watched,
         COALESCE(w.watch_later, false) AS watch_later,
         COALESCE(w.progress_seconds, 0) AS progress_seconds
  FROM subscriptions s
  JOIN videos v ON v.channel_id = s.channel_id
  JOIN channels c ON c.id = v.channel_id
  LEFT JOIN watch_state w ON w.user_id = s.user_id AND w.video_id = v.id`;

/**
 * Chronological feed of videos from the user's subscribed channels only.
 * nextCursor === null means the end: the client shows "you're all caught up".
 */
feedRoutes.get('/feed', async (c) => {
  const parsed = FeedQuery.safeParse(c.req.query());
  if (!parsed.success) return c.json({ error: 'Invalid query' }, 400);
  const f = parsed.data;
  const userId = c.get('userId');

  const [user] = await query<{ settings: { shortsMode?: string } }>(`SELECT settings FROM users WHERE id = $1`, [userId]);
  const shortsMode = user?.settings.shortsMode ?? 'tab';

  const where: string[] = ['s.user_id = $1'];
  const params: unknown[] = [userId];
  const add = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (f.tab === 'shorts') {
    if (shortsMode === 'hidden') return c.json({ videos: [], nextCursor: null });
    where.push('v.is_short = true');
  } else if (shortsMode !== 'mixed') {
    where.push('v.is_short IS NOT TRUE');
  }

  if (f.channel) where.push(`s.channel_id = ${add(f.channel)}`);
  if (f.group) where.push(`s.group_name = ${add(f.group)}`);
  if (f.q) where.push(`v.title ILIKE ${add(`%${f.q.replace(/[\\%_]/g, '\\$&')}%`)}`);
  if (f.hideWatched === 'true') where.push('COALESCE(w.watched, false) = false');

  if (f.cursor) {
    try {
      const { t, id } = JSON.parse(Buffer.from(f.cursor, 'base64url').toString('utf8')) as { t: string; id: string };
      const tp = add(new Date(t));
      const ip = add(id);
      where.push(`(v.published_at, v.id) < (${tp}, ${ip})`);
    } catch {
      return c.json({ error: 'Invalid cursor' }, 400);
    }
  }

  const rows = await query<Row>(
    `${VIDEO_SELECT}
     WHERE ${where.join(' AND ')}
     ORDER BY v.published_at DESC, v.id DESC
     LIMIT ${PAGE_SIZE + 1}`,
    params,
  );

  const page = rows.slice(0, PAGE_SIZE);
  const last = page[page.length - 1];
  const nextCursor =
    rows.length > PAGE_SIZE && last
      ? Buffer.from(JSON.stringify({ t: last.published_at.toISOString(), id: last.id })).toString('base64url')
      : null;

  return c.json({ videos: page.map(toVideo), nextCursor });
});
