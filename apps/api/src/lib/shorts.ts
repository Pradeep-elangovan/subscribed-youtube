/**
 * RSS feeds don't say whether a video is a Short. YouTube serves
 * /shorts/<id> directly for real Shorts and redirects regular videos
 * to /watch, so a HEAD request without following redirects tells them apart.
 *
 * Returns null when the answer is unknown (network error, rate limit) so the
 * caller can retry later instead of caching a wrong value.
 */
export async function detectShort(videoId: string): Promise<boolean | null> {
  try {
    const res = await fetch(`https://www.youtube.com/shorts/${encodeURIComponent(videoId)}`, {
      method: 'HEAD',
      redirect: 'manual',
      signal: AbortSignal.timeout(8_000),
    });
    if (res.status === 200) return true;
    if (res.status >= 300 && res.status < 400) return false;
    return null;
  } catch {
    return null;
  }
}
