function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name}`);
  return value;
}

function list(name: string): string[] {
  return (process.env[name] ?? '')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

export const config = {
  port: Number(process.env.PORT ?? 8787),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  googleClientIds: list('GOOGLE_CLIENT_IDS'),
  corsOrigins: list('CORS_ORIGINS'),
  /** Long-running server only: poll feeds in the background. Not used on Vercel (see /cron/poll). */
  runPoller: process.env.RUN_POLLER !== 'false',
  pollIntervalMinutes: Number(process.env.POLL_INTERVAL_MINUTES ?? 20),
  /** Create tables automatically on first request. Set AUTO_MIGRATE=false to manage the schema yourself. */
  autoMigrate: process.env.AUTO_MIGRATE !== 'false',
  /** Shared secret for GET /cron/poll. If empty, that endpoint is disabled. */
  cronSecret: process.env.CRON_SECRET ?? '',
};
