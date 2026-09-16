import { Card, CardHeader, CardTitle, EmptyState } from '@nexora/ui';
import { RelativeTime } from '../relative-time';

export interface AuditEventRow {
  readonly id: string;
  readonly summary: string;
  readonly createdAt: Date;
  readonly actor: { readonly name: string } | null;
}

export interface AuditTimelineProps {
  readonly events: readonly AuditEventRow[];
  /** Epoch ms captured once by the page, so all timestamps share one instant. */
  readonly now: number;
}

/** A vertical trail of everything recorded against this quote and its versions/approvals. */
export function AuditTimeline({ events, now }: AuditTimelineProps) {
  if (events.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
        </CardHeader>
        <EmptyState title="No activity recorded" description="Nothing has been logged for this quote yet." />
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity</CardTitle>
      </CardHeader>
      <ul className="flex flex-col gap-0 px-4 py-3">
        {events.map((event, index) => (
          <li key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
            {index < events.length - 1 ? (
              <span
                aria-hidden="true"
                className="absolute left-[5px] top-3 h-full w-px bg-[var(--border-subtle)]"
              />
            ) : null}
            <span
              aria-hidden="true"
              className="relative z-10 mt-1.5 size-[11px] shrink-0 rounded-full border-2 border-[var(--surface-raised)] bg-[var(--accent-solid)]"
            />
            <div className="flex flex-1 flex-col gap-0.5">
              <p className="text-sm text-[var(--text-primary)]">{event.summary}</p>
              <p className="text-2xs text-[var(--text-tertiary)]">
                {event.actor?.name ?? 'System'} · <RelativeTime date={event.createdAt} now={now} />
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
