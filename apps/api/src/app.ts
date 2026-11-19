import { timingSafeEqual } from 'node:crypto';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { config } from './config.js';
import { ensureSchema } from './db.js';
import { authRoutes } from './routes/auth.js';
import { feedRoutes } from './routes/feed.js';
import { subscriptionRoutes } from './routes/subscriptions.js';
import { videoRoutes } from './routes/videos.js';
import { pollOnce } from './worker/poller.js';

// The Hono app, with no server attached. src/index.ts serves it on a normal server;
// api/index.js serves it as a Vercel function.
export const app = new Hono();

app.use('*', cors({ origin: config.corsOrigins, allowHeaders: ['Authorization', 'Content-Type'] }));

app.get('/health', (c) => c.json({ ok: true }));

// Create the tables on the first request after a cold start (a no-op afterwards).
if (config.autoMigrate) {
  app.use('*', async (_c, next) => {
    await ensureSchema();
    await next();
  });
}

function secretMatches(header: string | undefined): boolean {
  if (!config.cronSecret || !header?.startsWith('Bearer ')) return false;
  const given = Buffer.from(header.slice(7));
  const expected = Buffer.from(config.cronSecret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// Called on a schedule (Vercel Cron sends "Authorization: Bearer $CRON_SECRET" automatically;
// an outside scheduler such as cron-job.org can send the same header). Does a time-boxed refresh.
app.get('/cron/poll', async (c) => {
  if (!config.cronSecret) return c.json({ error: 'CRON_SECRET is not set' }, 503);
  if (!secretMatches(c.req.header('Authorization'))) return c.json({ error: 'Unauthorized' }, 401);
  const { due } = await pollOnce({ batchSize: 150, budgetMs: 40_000 });
  return c.json({ ok: true, due });
});

app.route('/', authRoutes);
app.route('/', subscriptionRoutes);
app.route('/', feedRoutes);
app.route('/', videoRoutes);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Internal server error' }, 500);
});
