const UNITS: readonly {
  readonly limit: number;
  readonly unit: Intl.RelativeTimeFormatUnit;
  readonly ms: number;
}[] = [
  { limit: 60_000, unit: 'second', ms: 1_000 },
  { limit: 3_600_000, unit: 'minute', ms: 60_000 },
  { limit: 86_400_000, unit: 'hour', ms: 3_600_000 },
  { limit: 2_592_000_000, unit: 'day', ms: 86_400_000 },
  { limit: 31_536_000_000, unit: 'month', ms: 2_592_000_000 },
  { limit: Number.POSITIVE_INFINITY, unit: 'year', ms: 31_536_000_000 },
];

export interface RelativeTimeProps {
  readonly date: Date;
  /**
   * The instant to measure against, as epoch milliseconds.
   *
   * Required rather than defaulted to `Date.now()`, for two reasons. It keeps
   * the component pure — calling `Date.now()` during render produces a value
   * that changes on every re-render and differs between the server and client
   * pass, which is a hydration mismatch waiting to happen. And it makes every
   * timestamp on a page relative to ONE instant, so a table of twenty rows
   * cannot show times measured from twenty slightly different "nows".
   *
   * Pages capture it once: `const now = Date.now()`.
   */
  readonly now: number;
}

/**
 * A timestamp rendered as "3 hours ago", with the absolute time available on
 * hover and to assistive technology through the `<time>` element.
 */
export function RelativeTime({ date, now }: RelativeTimeProps) {
  const deltaMs = date.getTime() - now;
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
