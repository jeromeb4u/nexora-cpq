import {
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
import { add, cents, formatMoney, type Cents } from '@nexora/types';

export interface LineItem {
  readonly id: string;
  readonly skuSnapshot: string;
  readonly nameSnapshot: string;
  readonly quantity: number;
  readonly unitMonthlyCents: number;
  readonly monthlyCents: number;
  readonly unitSetupCents: number;
  readonly setupCents: number;
}

export interface LineItemsTableProps {
  readonly items: readonly LineItem[];
}

/**
 * The priced lines exactly as they were snapshotted onto this version.
 *
 * `QuoteItem` has no per-line discount column — the version's blended
 * discount is not attributable back to individual lines — so this table
 * shows only fields the schema actually stores, rather than deriving a
 * per-line discount that cannot be proven correct.
 */
export function LineItemsTable({ items }: LineItemsTableProps) {
  if (items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Line items</CardTitle>
        </CardHeader>
        <EmptyState title="No line items" description="This version has no priced products." />
      </Card>
    );
  }

  const totalMonthly = add(...items.map((item): Cents => cents(item.monthlyCents)));
  const totalSetup = add(...items.map((item): Cents => cents(item.setupCents)));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Line items</CardTitle>
      </CardHeader>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>SKU</TableHead>
            <TableHead>Product</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Unit / mo</TableHead>
            <TableHead className="text-right">Subtotal / mo</TableHead>
            <TableHead className="text-right">Unit setup</TableHead>
            <TableHead className="text-right">Setup</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-mono text-xs text-[var(--text-secondary)]">
                {item.skuSnapshot}
              </TableCell>
              <TableCell>{item.nameSnapshot}</TableCell>
              <TableCellNumeric>{item.quantity}</TableCellNumeric>
              <TableCellNumeric>{formatMoney(cents(item.unitMonthlyCents))}</TableCellNumeric>
              <TableCellNumeric>{formatMoney(cents(item.monthlyCents))}</TableCellNumeric>
              <TableCellNumeric>{formatMoney(cents(item.unitSetupCents))}</TableCellNumeric>
              <TableCellNumeric>{formatMoney(cents(item.setupCents))}</TableCellNumeric>
            </TableRow>
          ))}
        </TableBody>
        <tfoot>
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={4} className="text-right text-xs font-semibold text-[var(--text-secondary)]">
              Total
            </TableCell>
            <TableCellNumeric className="font-semibold">{formatMoney(totalMonthly)}</TableCellNumeric>
            <TableCell />
            <TableCellNumeric className="font-semibold">{formatMoney(totalSetup)}</TableCellNumeric>
          </TableRow>
        </tfoot>
      </Table>
    </Card>
  );
}
