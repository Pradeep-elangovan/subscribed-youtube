CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_sub  text UNIQUE NOT NULL,
  email       text NOT NULL,
  name        text,
  picture     text,
  settings    jsonb NOT NULL DEFAULT '{"shortsMode":"tab"}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Channels are shared across users: one poll serves every subscriber.
CREATE TABLE IF NOT EXISTS channels (
  id              text PRIMARY KEY,            -- YouTube channel id (UC...)
  title           text NOT NULL,
  thumbnail       text,
  last_polled_at  timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_id  text NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  group_name  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, channel_id)
);
CREATE INDEX IF NOT EXISTS subscriptions_channel_idx ON subscriptions (channel_id);

CREATE TABLE IF NOT EXISTS videos (
  id            text PRIMARY KEY,              -- YouTube video id
  channel_id    text NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  title         text NOT NULL,
  published_at  timestamptz NOT NULL,
  thumbnail     text,
  is_short      boolean,                       -- NULL = not classified yet
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS videos_channel_published_idx ON videos (channel_id, published_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS videos_unclassified_idx ON videos (created_at) WHERE is_short IS NULL;

CREATE TABLE IF NOT EXISTS watch_state (
  user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_id          text NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  watched           boolean NOT NULL DEFAULT false,
  watch_later       boolean NOT NULL DEFAULT false,
  progress_seconds  integer NOT NULL DEFAULT 0,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, video_id)
);
