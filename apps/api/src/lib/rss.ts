import { XMLParser } from 'fast-xml-parser';

export interface FeedEntry {
  id: string;
  title: string;
  publishedAt: Date;
  thumbnail: string | null;
}

export interface ChannelFeed {
  title: string | null;
  entries: FeedEntry[];
}

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

const asArray = <T>(value: T | T[] | undefined): T[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

/** Fetches a channel's public RSS feed (latest ~15 uploads). No API key or quota needed. */
export async function fetchChannelFeed(channelId: string): Promise<ChannelFeed> {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Feed ${channelId} returned HTTP ${res.status}`);

  const doc = parser.parse(await res.text());
  const feed = doc?.feed;
  if (!feed) throw new Error(`Feed ${channelId} had no <feed> element`);

  const entries: FeedEntry[] = [];
  for (const entry of asArray<any>(feed.entry)) {
    const id = entry['yt:videoId'];
    const published = new Date(entry.published);
    if (!id || Number.isNaN(published.getTime())) continue;
    entries.push({
      id: String(id),
      title: String(entry.title ?? ''),
      publishedAt: published,
      thumbnail: entry['media:group']?.['media:thumbnail']?.['@_url'] ?? null,
    });
  }
  return { title: feed.title ? String(feed.title) : null, entries };
}
