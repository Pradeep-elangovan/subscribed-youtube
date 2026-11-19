// Hermes has no Intl.RelativeTimeFormat, so this is a small hand-written version.
export function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  const steps: [string, number][] = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['week', 604_800],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ];
  for (const [unit, size] of steps) {
    const n = Math.floor(seconds / size);
    if (n >= 1) return `${n} ${unit}${n === 1 ? '' : 's'} ago`;
  }
  return 'just now';
}
