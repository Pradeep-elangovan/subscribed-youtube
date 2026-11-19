import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { config } from './config.js';
import { pool } from './db.js';
import { authRoutes } from './routes/auth.js';
import { feedRoutes } from './routes/feed.js';
import { subscriptionRoutes } from './routes/subscriptions.js';
import { videoRoutes } from './routes/videos.js';
import { startPoller } from './worker/poller.js';

const app = new Hono();

app.use('*', cors({ origin: config.corsOrigins, allowHeaders: ['Authorization', 'Content-Type'] }));
app.get('/health', (c) => c.json({ ok: true }));
app.route('/', authRoutes);
app.route('/', subscriptionRoutes);
app.route('/', feedRoutes);
app.route('/', videoRoutes);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Internal server error' }, 500);
});

const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`API listening on http://localhost:${info.port}`);
});

const stopPoller = config.runPoller ? startPoller() : () => {};

async function shutdown() {
  stopPoller();
  server.close();
  await pool.end();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
