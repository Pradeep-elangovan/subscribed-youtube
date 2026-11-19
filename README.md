# Subscribed YouTube

A YouTube-style client that shows videos **only from the channels you subscribe to**. No recommendations, no trending, no algorithmic Shorts: just a chronological feed with a "you're all caught up" ending.

## Layout

```
apps/api          Hono + Postgres API, feed poller          (built)
apps/web          React PWA (Vite)                           (next)
apps/mobile       React Native (Expo) Android app            (after web)
packages/shared   TypeScript types shared by all apps
```

## How it works

- **Feeds** come from each channel's public RSS (`youtube.com/feeds/videos.xml?channel_id=...`), so no YouTube API quota. Channels are shared: 1,000 users subscribed to one channel cost one fetch.
- **Shorts** are detected once per video (a `HEAD` request to `/shorts/<id>`) and cached. Each user chooses `tab` (default), `hidden` or `mixed`.
- **Playback** will use the official YouTube embedded player, which keeps the app within YouTube's terms.
- **Subscriptions** come from a Google Takeout `subscriptions.csv` upload, or from Google sign-in with the `youtube.readonly` scope (the access token is used for one request and never stored).

## Run the API

Requires Node 20.6+ and Docker (or any Postgres 14+).

```bash
docker compose up -d db
cp apps/api/.env.example apps/api/.env   # then fill in JWT_SECRET and GOOGLE_CLIENT_IDS
npm install
npm run api:migrate
npm run api:dev
```

### Google OAuth setup

1. In Google Cloud Console create an OAuth consent screen and two OAuth client IDs: **Web** and **Android**.
2. Put both client IDs in `GOOGLE_CLIENT_IDS` (comma-separated).
3. Auto-sync needs the `https://www.googleapis.com/auth/youtube.readonly` scope. Google requires app verification before the general public can use it; until then, only listed test users can. The Takeout CSV import works for everyone without it.

## API

All routes except `/health` and `/auth/google` need `Authorization: Bearer <token>`.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/auth/google` | `{ idToken }` → `{ token, user }` |
| GET | `/me` | Current user and settings |
| PATCH | `/me/settings` | `{ shortsMode: "tab" \| "hidden" \| "mixed" }` |
| DELETE | `/me` | Delete the account and all its data |
| GET | `/subscriptions` | Your channels |
| POST | `/subscriptions/import-csv` | Body: the Takeout `subscriptions.csv` as `text/csv` |
| POST | `/subscriptions/sync-google` | `{ accessToken }` (YouTube read-only) |
| PATCH | `/subscriptions/:channelId` | `{ group: string \| null }` |
| DELETE | `/subscriptions/:channelId` | Unsubscribe in this app |
| GET | `/feed` | `tab=videos\|shorts`, `channel`, `group`, `q` (search), `hideWatched`, `cursor`. `nextCursor: null` = caught up |
| PUT | `/videos/:id/state` | `{ watched?, watchLater?, progressSeconds? }` |
| GET | `/watch-later` | Saved videos |

## Roadmap

- [x] API: auth, import, feed polling, Shorts detection, watch state, search
- [ ] Web PWA
- [ ] Android app (Expo)
- [ ] Livestream filter (RSS doesn't flag lives; needs a per-video lookup)
- [ ] Rate limiting, notifications, daily digest, keyboard shortcuts
