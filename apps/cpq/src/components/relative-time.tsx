const UNITS: readonly { readonly limit: number; readonly unit: Intl.RelativeTimeFormatUnit; readonly ms: number }[] = [
  { limit: 60_000, unit: 'second', ms: 1_000 },
  { limit: 3_600_000, unit: 'minute', ms: 60_000 },
  { limit: 86_400_000, unit: 'hour', ms: 3_600_000 },
  { limit: 2_592_000_000, unit: 'day', ms: 86_400_000 },
  { limit: 31_536_000_000, unit: 'month', ms: 2_592_000_000 },
  { limit: Number.POSITIVE_INFINITY, unit: 'year', ms: 31_536_000_000 },
];

/**
 * A relative timestamp that does not break hydration.
 *
 * Rendering "3 hours ago" on the server and again on the client produces two
 * different strings whenever the clock ticks across a boundary between them,
 * which React reports as a hydration mismatch. The relative text is computed
 * once on the server and the absolute time is carried in `dateTime` and
 * `title`, so the value is stable, accessible and hoverable.
 */
export function RelativeTime({ date }: { date: Date }) {
  const deltaMs = date.getTime() - Date.now();
  const absolute = Math.abs(deltaMs);

  const match = UNITS.find((candidate) => absolute < candidate.limit) ?? UNITS[UNITS.length - 1]!;
  const formatter = new Intl.RelativeTimeFormat('en-GB', { numeric: 'auto' });
  const label = formatter.format(Math.round(deltaMs / match.ms), match.unit);

  return (
    <time dateTime={date.toISOString()} title={date.toLocaleString('en-GB')}>
      {label}
    </time>
  );
}
