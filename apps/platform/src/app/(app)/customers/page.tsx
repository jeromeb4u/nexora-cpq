import type { Metadata } from 'next';
import Link from 'next/link';
import { Button, EmptyState, PageHeader } from '@nexora/ui';
import { Permission, can } from '@nexora/auth/permissions';
import { customerListQuerySchema } from '@nexora/validation';

import { requirePagePermission } from '@/lib/session';
import { requestInstant } from '@/lib/now';
import { listCustomerOwners, listCustomers } from '@/lib/customers';
import { CustomerFilters } from '@/components/customers/customer-filters';
import { CustomerTable } from '@/components/customers/customer-table';

export const metadata: Metadata = { title: 'Customers' };

/**
 * The customer list.
 *
 * Filters live entirely in the URL, mirroring `apps/cpq/src/app/(app)/quotes/page.tsx`:
 * a filtered view is a link that can be bookmarked, shared with a colleague,
 * or reloaded without losing state. Unparseable parameters fall back to
 * defaults instead of erroring — a stale or hand-edited URL should show the
 * default list, not a crash.
 */
export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requirePagePermission(Permission.CUSTOMER_READ);
  const canCreateCustomer = can(actor.role, Permission.CUSTOMER_CREATE);
  const raw = await searchParams;

  const parsed = customerListQuerySchema.safeParse(raw);
  const query = parsed.success ? parsed.data : customerListQuerySchema.parse({});

  const now = requestInstant();

  const [result, owners] = await Promise.all([listCustomers(query), listCustomerOwners()]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Customers"
        description={
          result.total === 1 ? '1 customer' : `${result.total.toLocaleString('en-GB')} customers`
        }
        actions={
          canCreateCustomer ? (
            <Button asChild>
              <Link href="/customers/new">New customer</Link>
            </Button>
          ) : undefined
        }
      />

      <CustomerFilters owners={owners} />

      {result.total === 0 ? (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-10">
          <EmptyState
            title="No customers match these filters"
            description="Try clearing the search or widening the status filter."
            action={
              <Button asChild variant="secondary">
                <Link href="/customers">Clear filters</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <CustomerTable
          rows={result.rows}
          page={result.page}
          pageCount={result.pageCount}
          total={result.total}
          pageSize={result.pageSize}
          sortBy={query.sortBy}
          sortDir={query.sortDir}
          now={now}
        />
      )}
    </div>
  );
}
