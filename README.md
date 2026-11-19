# Subscribed YouTube

A YouTube-style client that shows videos **only from the channels you subscribe to**. No recommendations, no trending, no algorithmic Shorts: just a chronological feed with a "you're all caught up" ending.

## Layout

```
apps/api          Hono + Postgres API, feed poller          (built)
apps/web          React PWA (Vite)                           (built)
apps/mobile       React Native (Expo) Android app            (built)
packages/shared   Types and the API client shared by web and Android
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

## Run the web app

```bash
cp apps/web/.env.example apps/web/.env   # set VITE_GOOGLE_CLIENT_ID (the Web client ID)
npm run web:dev                          # http://localhost:5173
```

In Google Cloud Console, add `http://localhost:5173` as an authorised JavaScript origin on the Web client, and add the same origin to the API's `CORS_ORIGINS`. In production the app is installable as a PWA.

## Run the Android app

The app uses native Google sign-in, so it needs a development build (it does not run in Expo Go). You need the Android SDK or an EAS account.

```bash
cp apps/mobile/.env.example apps/mobile/.env   # API URL + the Web client ID
npm install
npx expo install --fix --cwd apps/mobile       # aligns native package versions with your Expo SDK
cd apps/mobile
npx expo run:android                           # local build on an emulator or device
# or: eas build --profile development --platform android
npx expo start --dev-client
```

- From the emulator the API on your computer is `http://10.0.2.2:8787`. On a real phone use your computer's LAN IP or a deployed https URL. Plain http is only allowed in non-production builds.
- Android sign-in also needs an **Android** OAuth client in Google Cloud (package `com.subscribedyoutube.app` plus your signing certificate's SHA-1). The app itself only needs the **Web** client ID, which must also be in the API's `GOOGLE_CLIENT_IDS`.
- Get the debug SHA-1 with `cd apps/mobile/android && ./gradlew signingReport`, or `eas credentials` for EAS builds.

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
| GET | `/videos/:id` | One video from your subscriptions |
| GET | `/watch-later` | Saved videos |

## Roadmap

- [x] API: auth, import, feed polling, Shorts detection, watch state, search
- [x] Web PWA: sign-in, feed + Shorts tab, search, groups, channels/import, watch page, watch later, settings
- [x] Android app (Expo): same features as web, native Google sign-in
- [ ] Livestream filter (RSS doesn't flag lives; needs a per-video lookup)
- [ ] Rate limiting, notifications, daily digest, keyboard shortcuts
