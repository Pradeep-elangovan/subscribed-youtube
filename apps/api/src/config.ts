function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name}`);
  return value;
}

function list(name: string): string[] {
  return (process.env[name] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export const config = {
  port: Number(process.env.PORT ?? 8787),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  googleClientIds: list('GOOGLE_CLIENT_IDS'),
  corsOrigins: list('CORS_ORIGINS'),
  runPoller: process.env.RUN_POLLER !== 'false',
  pollIntervalMinutes: Number(process.env.POLL_INTERVAL_MINUTES ?? 20),
};
