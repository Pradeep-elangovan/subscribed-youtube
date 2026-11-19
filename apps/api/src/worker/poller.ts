import { config } from '../config.js';
import { query, withTransaction } from '../db.js';
import { fetchChannelFeed } from '../lib/rss.js';
import { detectShort } from '../lib/shorts.js';

const CONCURRENCY = 5;

async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++]!;
      await fn(item);
    }
  });
  await Promise.all(workers);
}

async function pollChannel(channelId: string): Promise<void> {
  try {
    const feed = await fetchChannelFeed(channelId);
    await withTransaction(async (client) => {
      for (const e of feed.entries) {
        await client.query(
          `INSERT INTO videos (id, channel_id, title, published_at, thumbnail)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, thumbnail = EXCLUDED.thumbnail`,
          [e.id, channelId, e.title, e.publishedAt, e.thumbnail],
        );
      }
      await client.query(
        `UPDATE channels SET last_polled_at = now(), title = COALESCE($2, title) WHERE id = $1`,
        [channelId, feed.title],
      );
    });
  } catch (err) {
    // Mark it as polled anyway so one broken channel doesn't block the queue.
    await query(`UPDATE channels SET last_polled_at = now() WHERE id = $1`, [channelId]);
    console.warn(`[poller] ${channelId}: ${(err as Error).message}`);
  }
}

/** Polls the given channels right away (used after an import so the feed fills quickly). */
export async function pollChannels(channelIds: string[]): Promise<void> {
  await mapLimit(channelIds, CONCURRENCY, pollChannel);
  await classifyShorts();
}

/** Classifies recent videos whose Short/regular status is still unknown. */
export async function classifyShorts(limit = 300): Promise<void> {
  const pending = await query<{ id: string }>(
    `SELECT id FROM videos
     WHERE is_short IS NULL AND created_at > now() - interval '7 days'
     ORDER BY created_at DESC LIMIT $1`,
    [limit],
  );
  await mapLimit(pending, CONCURRENCY, async ({ id }) => {
    const result = await detectShort(id);
    if (result !== null) await query(`UPDATE videos SET is_short = $2 WHERE id = $1`, [id, result]);
  });
}

/** One polling pass: refresh every subscribed channel that hasn't been polled recently. */
export async function pollOnce(batchSize = 200): Promise<void> {
  const due = await query<{ id: string }>(
    `SELECT c.id FROM channels c
     WHERE EXISTS (SELECT 1 FROM subscriptions s WHERE s.channel_id = c.id)
       AND (c.last_polled_at IS NULL
            OR c.last_polled_at < now() - make_interval(mins => $2))
     ORDER BY c.last_polled_at NULLS FIRST
     LIMIT $1`,
    [batchSize, config.pollIntervalMinutes],
  );
  if (due.length > 0) {
    console.log(`[poller] refreshing ${due.length} channel(s)`);
    await pollChannels(due.map((c) => c.id));
  }
}

export function startPoller(): () => void {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await pollOnce();
    } catch (err) {
      console.error('[poller] pass failed', err);
    } finally {
      running = false;
    }
  };
  void tick();
  const timer = setInterval(tick, 5 * 60_000);
  return () => clearInterval(timer);
}
