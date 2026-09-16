import {
  Badge,
  Card,
  CardHeader,
  CardTitle,
  EmptyState,
  Table,
  TableBody,
  TableCell,
  TableCellNumeric,
  TableHead,
  TableHeader,
  TableRow,
} from '@nexora/ui';
import { bpsToRate, cents, formatMoney, formatRate } from '@nexora/types';
import { cn } from '../cn';
import { RelativeTime } from '../relative-time';

export interface QuoteVersionRow {
  readonly id: string;
  readonly versionNumber: number;
  readonly discountBps: number;
  readonly effectiveDiscountBps: number;
  readonly mrrCents: number;
  readonly tcvCents: number;
  readonly createdBy: { readonly name: string };
  readonly createdAt: Date;
  readonly supersededAt: Date | null;
}

export interface VersionHistoryTableProps {
  readonly versions: readonly QuoteVersionRow[];
  /** Epoch ms captured once by the page, so all timestamps share one instant. */
  readonly now: number;
}

/**
 * Every version this quote has ever had, newest first.
 *
 * Versions are append-only (`supersededAt` is set, never the row deleted), so
 * this table is direct proof that history is never overwritten — the current
 * version is the one row where `supersededAt` is still null.
 */
export function VersionHistoryTable({ versions, now }: VersionHistoryTableProps) {
  if (versions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Version history</CardTitle>
        </CardHeader>
        <EmptyState title="No versions yet" description="A version is created once this quote is configured." />
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Version history</CardTitle>
      </CardHeader>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Version</TableHead>
            <TableHead className="text-right">Requested</TableHead>
            <TableHead className="text-right">Effective</TableHead>
            <TableHead className="text-right">MRR</TableHead>
            <TableHead className="text-right">TCV</TableHead>
            <TableHead>Created by</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {versions.map((version) => {
            const isCurrent = version.supersededAt === null;
            return (
              <TableRow
                key={version.id}
                className={cn(isCurrent && 'bg-[var(--surface-selected)] hover:bg-[var(--surface-selected)]')}
              >
                <TableCell className={cn('font-medium', isCurrent && 'text-[var(--accent-solid)]')}>
                  v{version.versionNumber}
                </TableCell>
                <TableCellNumeric>{formatRate(bpsToRate(version.discountBps))}</TableCellNumeric>
                <TableCellNumeric>{formatRate(bpsToRate(version.effectiveDiscountBps))}</TableCellNumeric>
                <TableCellNumeric>{formatMoney(cents(version.mrrCents))}</TableCellNumeric>
                <TableCellNumeric>{formatMoney(cents(version.tcvCents))}</TableCellNumeric>
                <TableCell className="text-[var(--text-secondary)]">{version.createdBy.name}</TableCell>
                <TableCell className="whitespace-nowrap text-[var(--text-tertiary)]">
                  <RelativeTime date={version.createdAt} now={now} />
                </TableCell>
                <TableCell>
                  {isCurrent ? (
                    <Badge tone="brand">Current</Badge>
                  ) : (
                    <Badge tone="neutral">Superseded</Badge>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
