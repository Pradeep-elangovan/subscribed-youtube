// Long-running server entry (local development, Docker, Railway, Fly, a VPS).
// On Vercel the app is served by api/index.js instead.
import { serve } from '@hono/node-server';
import { app } from './app.js';
import { config } from './config.js';
import { pool } from './db.js';
import { startPoller } from './worker/poller.js';

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
