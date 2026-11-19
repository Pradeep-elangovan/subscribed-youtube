import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Channel, FeedVideo, ShortsMode } from '@subtube/shared';
import { api } from './api';
import { useAuth } from './auth';
import { FeedList, VideoCard, timeAgo } from './components';
import { googleConfigured, renderSignInButton, requestYouTubeAccessToken } from './google';
import { Player } from './Player';

/* ------------------------------ Login ------------------------------ */

export function LoginPage() {
  const { signIn } = useAuth();
  const button = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!googleConfigured || !button.current) return;
    renderSignInButton(button.current, (idToken) => {
      signIn(idToken).catch((e: Error) => setError(e.message));
    }).catch((e: Error) => setError(e.message));
  }, [signIn]);

  return (
    <main className="login">
      <h1>Subscribed</h1>
      <p>Only the videos from channels you subscribe to. No recommendations, nothing else.</p>
      {googleConfigured ? (
        <div ref={button} />
      ) : (
        <p className="note error">Set VITE_GOOGLE_CLIENT_ID in apps/web/.env to enable sign-in.</p>
      )}
      {error && <p className="note error">{error}</p>}
    </main>
  );
}

/* ------------------------------- Feed ------------------------------ */

export function FeedPage() {
  const { user } = useAuth();
  const shortsMode = user?.settings.shortsMode ?? 'tab';
  const [tab, setTab] = useState<'videos' | 'shorts'>('videos');
  const [group, setGroup] = useState('');
  const [hideWatched, setHideWatched] = useState(false);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [channels, setChannels] = useState<Channel[] | null>(null);

  useEffect(() => {
    api.channels().then(setChannels).catch(() => setChannels([]));
  }, []);

  // Wait for the user to stop typing before searching.
  useEffect(() => {
    const t = window.setTimeout(() => setQ(search.trim()), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  const groups = [...new Set((channels ?? []).map((c) => c.group).filter((g): g is string => !!g))].sort();
  const showShortsTab = shortsMode !== 'hidden';
  const activeTab = showShortsTab ? tab : 'videos';

  if (channels && channels.length === 0) {
    return (
      <main className="page">
        <div className="note">
          <h2>Add your subscriptions to get started</h2>
          <p>
            Import them from Google or a Takeout file on the <Link to="/channels">Channels</Link> page.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      {showShortsTab && (
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={activeTab === 'videos'} onClick={() => setTab('videos')}>
            Videos
          </button>
          <button role="tab" aria-selected={activeTab === 'shorts'} onClick={() => setTab('shorts')}>
            Shorts
          </button>
        </div>
      )}
      <div className="filters">
        <input
          type="search"
          placeholder="Search your subscriptions"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {groups.length > 0 && (
          <select value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Channel group">
            <option value="">All groups</option>
            {groups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        )}
        <label className="check">
          <input type="checkbox" checked={hideWatched} onChange={(e) => setHideWatched(e.target.checked)} /> Hide
          watched
        </label>
      </div>
      <FeedList
        params={{ tab: activeTab, group: group || undefined, q: q || undefined, hideWatched }}
        empty={q ? `Nothing matches “${q}”.` : 'Nothing here yet. New uploads appear within a few minutes.'}
      />
    </main>
  );
}

/* ----------------------------- Channel ----------------------------- */

export function ChannelPage() {
  const { id = '' } = useParams();
  const [channel, setChannel] = useState<Channel | null | undefined>(undefined);

  useEffect(() => {
    api
      .channels()
      .then((list) => setChannel(list.find((c) => c.id === id) ?? null))
      .catch(() => setChannel(null));
  }, [id]);

  return (
    <main className="page">
      <h2>{channel?.title ?? 'Channel'}</h2>
      {channel === null ? (
        <p className="note">You’re not subscribed to this channel.</p>
      ) : (
        <FeedList params={{ tab: 'videos', channel: id }} empty="No videos from this channel yet." />
      )}
    </main>
  );
}

/* ---------------------------- Channels ----------------------------- */

export function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => api.channels().then(setChannels).catch((e: Error) => setMessage(e.message));
  useEffect(() => {
    void refresh();
  }, []);

  const run = async (fn: () => Promise<{ imported: number }>) => {
    setBusy(true);
    setMessage(null);
    try {
      const { imported } = await fn();
      setMessage(`Imported ${imported} channel${imported === 1 ? '' : 's'}. Videos appear as they load.`);
      await refresh();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) await run(async () => api.importCsv(await file.text()));
  };

  const setGroup = (channel: Channel, value: string) => {
    const group = value.trim() || null;
    if (group === channel.group) return;
    setChannels((list) => list?.map((c) => (c.id === channel.id ? { ...c, group } : c)) ?? null);
    api.setGroup(channel.id, group).catch((err: Error) => setMessage(err.message));
  };

  const remove = (channel: Channel) => {
    if (!window.confirm(`Remove ${channel.title} from this app? Your YouTube subscription is not affected.`)) return;
    setChannels((list) => list?.filter((c) => c.id !== channel.id) ?? null);
    api.unsubscribe(channel.id).catch((err: Error) => setMessage(err.message));
  };

  return (
    <main className="page">
      <h2>Channels</h2>
      <section className="panel">
        <h3>Import subscriptions</h3>
        <div className="row">
          <button disabled={busy || !googleConfigured} onClick={() => void run(async () => api.syncGoogle(await requestYouTubeAccessToken()))}>
            Sync from Google
          </button>
          <label className={`button${busy ? ' disabled' : ''}`}>
            Upload Takeout CSV
            <input type="file" accept=".csv,text/csv" hidden disabled={busy} onChange={(e) => void onFile(e)} />
          </label>
        </div>
        <p className="hint">
          Takeout: takeout.google.com → select only YouTube → Subscriptions → upload <code>subscriptions.csv</code>.
        </p>
        {message && <p className="note">{message}</p>}
      </section>

      {channels?.length === 0 && <p className="note">No channels yet.</p>}
      <ul className="channel-list">
        {channels?.map((c) => (
          <li key={c.id}>
            <Link to={`/channel/${c.id}`} className="channel-name">
              {c.title}
            </Link>
            <input
              className="group-input"
              defaultValue={c.group ?? ''}
              placeholder="Group"
              maxLength={60}
              aria-label={`Group for ${c.title}`}
              onBlur={(e) => setGroup(c, e.target.value)}
            />
            <button className="link" onClick={() => remove(c)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}

/* ----------------------------- Watch ------------------------------- */

export function WatchPage() {
  const { id = '' } = useParams();
  const [video, setVideo] = useState<FeedVideo | null | undefined>(undefined);

  useEffect(() => {
    setVideo(undefined);
    api
      .video(id)
      .then(setVideo)
      .catch(() => setVideo(null));
  }, [id]);

  if (video === undefined) return <main className="page"><p className="note">Loading…</p></main>;
  if (video === null) return <main className="page"><p className="note">This video isn’t from one of your subscriptions.</p></main>;

  const update = (patch: Parameters<typeof api.setVideoState>[1]) => {
    setVideo((v) => (v ? { ...v, ...patch } : v));
    api.setVideoState(video.id, patch).catch(() => undefined);
  };

  return (
    <main className="page watch">
      <Player
        key={video.id}
        videoId={video.id}
        startSeconds={video.watched ? 0 : video.progressSeconds}
        onState={update}
      />
      <h2>{video.title}</h2>
      <div className="sub">
        <Link to={`/channel/${video.channelId}`}>{video.channelTitle}</Link>
        <span> · {timeAgo(video.publishedAt)}</span>
      </div>
      <div className="actions">
        <button onClick={() => update({ watchLater: !video.watchLater })}>
          {video.watchLater ? 'Saved ✓' : 'Watch later'}
        </button>
        <button onClick={() => update({ watched: !video.watched })}>
          {video.watched ? 'Mark unwatched' : 'Mark watched'}
        </button>
      </div>
    </main>
  );
}

/* --------------------------- Watch later --------------------------- */

export function WatchLaterPage() {
  const [videos, setVideos] = useState<FeedVideo[] | null>(null);

  useEffect(() => {
    api.watchLater().then(setVideos).catch(() => setVideos([]));
  }, []);

  const change = (id: string, patch: Parameters<typeof api.setVideoState>[1]) => {
    // Un-saving removes the video from this list right away.
    setVideos((list) =>
      list
        ?.map((v) => (v.id === id ? { ...v, ...patch } : v))
        .filter((v) => v.watchLater) ?? null,
    );
    api.setVideoState(id, patch).catch(() => undefined);
  };

  return (
    <main className="page">
      <h2>Watch later</h2>
      {videos?.length === 0 && <p className="note">Nothing saved. Use “Watch later” on any video.</p>}
      <div className="grid">
        {videos?.map((v) => (
          <VideoCard key={v.id} video={v} onChange={change} />
        ))}
      </div>
    </main>
  );
}

/* ----------------------------- Settings ---------------------------- */

const SHORTS_OPTIONS: { value: ShortsMode; label: string; help: string }[] = [
  { value: 'tab', label: 'Separate tab', help: 'Shorts live in their own tab, out of your main feed.' },
  { value: 'mixed', label: 'Mixed in', help: 'Shorts appear in the main feed alongside videos.' },
  { value: 'hidden', label: 'Hidden', help: 'Never show Shorts.' },
];

export function SettingsPage() {
  const { user, setUser, signOut } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  if (!user) return null;

  const choose = async (shortsMode: ShortsMode) => {
    setError(null);
    try {
      setUser(await api.updateSettings({ shortsMode }));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const deleteAccount = async () => {
    if (!window.confirm('Delete your account and all your data? This cannot be undone.')) return;
    try {
      await api.deleteAccount();
      signOut();
      navigate('/');
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <main className="page">
      <h2>Settings</h2>
      <section className="panel">
        <h3>Shorts</h3>
        {SHORTS_OPTIONS.map((o) => (
          <label key={o.value} className="radio">
            <input
              type="radio"
              name="shorts"
              checked={user.settings.shortsMode === o.value}
              onChange={() => void choose(o.value)}
            />
            <span>
              <strong>{o.label}</strong>
              <br />
              <span className="hint">{o.help}</span>
            </span>
          </label>
        ))}
      </section>
      <section className="panel">
        <h3>Account</h3>
        <p className="hint">Signed in as {user.email}</p>
        <div className="row">
          <button onClick={signOut}>Sign out</button>
          <button className="danger" onClick={() => void deleteAccount()}>
            Delete account
          </button>
        </div>
      </section>
      {error && <p className="note error">{error}</p>}
    </main>
  );
}
