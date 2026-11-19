import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth, type AppEnv } from '../auth.js';
import { query, withTransaction } from '../db.js';
import { parseTakeoutCsv, type ImportedChannel } from '../lib/csv.js';
import { pollChannels } from '../worker/poller.js';

export const subscriptionRoutes = new Hono<AppEnv>();
subscriptionRoutes.use('*', requireAuth);

interface ImportedWithThumb extends ImportedChannel {
  thumbnail?: string | null;
}

async function saveSubscriptions(userId: string, channels: ImportedWithThumb[]): Promise<number> {
  if (channels.length === 0) return 0;
  await withTransaction(async (client) => {
    for (const ch of channels) {
      await client.query(
        `INSERT INTO channels (id, title, thumbnail) VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET thumbnail = COALESCE(EXCLUDED.thumbnail, channels.thumbnail)`,
        [ch.id, ch.title, ch.thumbnail ?? null],
      );
      await client.query(
        `INSERT INTO subscriptions (user_id, channel_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [userId, ch.id],
      );
    }
  });
  // Fill the first channels' feeds now, within a few seconds. Serverless functions are frozen once the
  // response is sent, so background work would be lost. Channels not reached stay "never polled" and the
  // scheduled refresh (/cron/poll, or the built-in poller on a long-running server) picks them up first.
  try {
    await pollChannels(
      channels.slice(0, 40).map((c) => c.id),
      8_000,
    );
  } catch (err) {
    console.error('[import] initial poll failed', err);
  }
  return channels.length;
}

subscriptionRoutes.get('/subscriptions', async (c) => {
  const rows = await query(
    `SELECT c.id, c.title, c.thumbnail, s.group_name AS "group"
     FROM subscriptions s JOIN channels c ON c.id = s.channel_id
     WHERE s.user_id = $1 ORDER BY lower(c.title)`,
    [c.get('userId')],
  );
  return c.json({ channels: rows });
});

// Takeout: Google Takeout > YouTube > subscriptions.csv. Send the file body as text/csv.
subscriptionRoutes.post('/subscriptions/import-csv', async (c) => {
  const text = await c.req.text();
  if (text.length > 2_000_000) return c.json({ error: 'File too large' }, 413);
  let channels: ImportedChannel[];
  try {
    channels = parseTakeoutCsv(text);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
  const imported = await saveSubscriptions(c.get('userId'), channels);
  return c.json({ imported });
});

// Auto-sync: the client signs in with the youtube.readonly scope and passes the access token.
// The token is used for this request only and is never stored.
subscriptionRoutes.post('/subscriptions/sync-google', async (c) => {
  const body = z.object({ accessToken: z.string().min(1) }).safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: 'accessToken is required' }, 400);

  const channels: ImportedWithThumb[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL('https://www.googleapis.com/youtube/v3/subscriptions');
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('mine', 'true');
    url.searchParams.set('maxResults', '50');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const res = await fetch(url, { headers: { Authorization: `Bearer ${body.data.accessToken}` } });
    if (!res.ok) return c.json({ error: `YouTube returned HTTP ${res.status}` }, 502);
    const data = (await res.json()) as {
      nextPageToken?: string;
      items?: { snippet?: { title?: string; resourceId?: { channelId?: string }; thumbnails?: { default?: { url?: string } } } }[];
    };
    for (const item of data.items ?? []) {
      const id = item.snippet?.resourceId?.channelId;
      if (id) {
        channels.push({
          id,
          title: item.snippet?.title ?? id,
          thumbnail: item.snippet?.thumbnails?.default?.url ?? null,
        });
      }
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  const imported = await saveSubscriptions(c.get('userId'), channels);
  return c.json({ imported });
});

subscriptionRoutes.patch('/subscriptions/:channelId', async (c) => {
  const body = z.object({ group: z.string().max(60).nullable() }).safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: 'group must be a string or null' }, 400);
  await query(`UPDATE subscriptions SET group_name = $3 WHERE user_id = $1 AND channel_id = $2`, [
    c.get('userId'),
    c.req.param('channelId'),
    body.data.group,
  ]);
  return c.body(null, 204);
});

subscriptionRoutes.delete('/subscriptions/:channelId', async (c) => {
  await query(`DELETE FROM subscriptions WHERE user_id = $1 AND channel_id = $2`, [
    c.get('userId'),
    c.req.param('channelId'),
  ]);
  return c.body(null, 204);
});
