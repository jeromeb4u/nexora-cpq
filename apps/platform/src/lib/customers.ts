import 'server-only';

import { prisma } from '@nexora/db';
import type { Prisma } from '@nexora/db';
import { notFound } from '@nexora/observability';
import type { CustomerListQueryInput } from '@nexora/validation';
import type { Role } from '@nexora/types';

/**
 * Roles that may be an account owner. Shared with
 * `lib/services/customer-service.ts`, which enforces the same list
 * server-side when a customer is created or reassigned — this is the single
 * source of truth for both.
 */
export const ASSIGNABLE_OWNER_ROLES: readonly Role[] = ['SALES_REP', 'SALES_MANAGER', 'ADMIN'];

/**
 * Customer queries.
 *
 * Unlike quotes, customer read access is not owner-scoped (§26): every role
 * that holds `CUSTOMER_READ` may see every customer, so these functions take
 * a validated query rather than an `Actor` — the permission gate lives at the
 * page, in `requirePagePermission`.
 */

export interface CustomerListResult {
  readonly rows: Awaited<ReturnType<typeof findCustomers>>;
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly pageCount: number;
}

async function findCustomers(where: Prisma.CustomerWhereInput, query: CustomerListQueryInput) {
  return prisma.customer.findMany({
    where,
    orderBy: buildOrderBy(query),
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
    select: {
      id: true,
      companyName: true,
      industry: true,
      status: true,
      updatedAt: true,
      accountOwner: { select: { id: true, name: true } },
      _count: { select: { locations: true, quotes: true } },
    },
  });
}

/**
 * Translate the validated sort into Prisma ordering. Every branch of
 * `customerSortBySchema` is handled explicitly, `companyName` is the default.
 */
function buildOrderBy(query: CustomerListQueryInput): Prisma.CustomerOrderByWithRelationInput {
  switch (query.sortBy) {
    case 'createdAt':
      return { createdAt: query.sortDir };
    case 'updatedAt':
      return { updatedAt: query.sortDir };
    case 'status':
      return { status: query.sortDir };
    case 'companyName':
    default:
      return { companyName: query.sortDir };
  }
}

function buildWhere(query: CustomerListQueryInput): Prisma.CustomerWhereInput {
  const where: Prisma.CustomerWhereInput = {};

  if (query.search) {
    // Matches how people actually look a customer up: by trading name, legal
    // name, VAT number, or the contact email on file.
    where.OR = [
      { companyName: { contains: query.search, mode: 'insensitive' } },
      { legalName: { contains: query.search, mode: 'insensitive' } },
      { vatNumber: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  if (query.status.length > 0) {
    where.status = { in: query.status };
  }

  if (query.industry.length > 0) {
    where.industry = { in: query.industry };
  }

  if (query.ownerId) {
    where.accountOwnerId = query.ownerId;
  }

  return where;
}

export async function listCustomers(query: CustomerListQueryInput): Promise<CustomerListResult> {
  const where = buildWhere(query);

  const [rows, total] = await Promise.all([
    findCustomers(where, query),
    prisma.customer.count({ where }),
  ]);

  return {
    rows,
    total,
    page: query.page,
    pageSize: query.pageSize,
    pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

/** Distinct account owners among all customers, for the owner filter. */
export async function listCustomerOwners() {
  const customers = await prisma.customer.findMany({
    distinct: ['accountOwnerId'],
    select: { accountOwner: { select: { id: true, name: true } } },
    orderBy: { accountOwner: { name: 'asc' } },
  });

  return customers.map((customer) => customer.accountOwner);
}

/**
 * A single customer with everything the detail page needs: its locations
 * (primary first, then alphabetically) and its quotes (newest first).
 *
 * Throws not-found — same as `getQuoteDetail` — when the id does not resolve.
 */
export async function getCustomerDetail(customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      accountOwner: { select: { id: true, name: true } },
      locations: {
        orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
      },
      quotes: {
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          quoteNumber: true,
          status: true,
          updatedAt: true,
          owner: { select: { id: true, name: true } },
          currentVersion: {
            select: { mrrCents: true, contractMonths: true, discountBps: true },
          },
        },
      },
    },
  });

  if (!customer) throw notFound('Customer');

  return customer;
}

/**
 * Active users eligible to be a customer's account owner, for the "New
 * customer" / "Edit customer" form's owner picker.
 */
export async function listAssignableOwners() {
  return prisma.user.findMany({
    where: { isActive: true, role: { in: [...ASSIGNABLE_OWNER_ROLES] } },
    select: { id: true, name: true, role: true },
    orderBy: { name: 'asc' },
  });
}

/**
 * Audit trail for this customer AND its quotes, newest first.
 *
 * Audit events are keyed by the entity they concern, so an event about
 * "raised quote QT-10482" is stored against the quote's id, not the
 * customer's. Collecting the customer's quote ids first is what makes this
 * complete rather than customer-events-only — querying by customer id alone
 * would silently omit every quote event.
 */
export async function getCustomerActivity(customerId: string, take = 20) {
  const quotes = await prisma.quote.findMany({
    where: { customerId },
    select: { id: true },
  });

  const relatedIds = [customerId, ...quotes.map((quote) => quote.id)];

  return prisma.auditEvent.findMany({
    where: { entityId: { in: relatedIds } },
    orderBy: { createdAt: 'desc' },
    take,
    select: {
      id: true,
      action: true,
      summary: true,
      createdAt: true,
      actor: { select: { name: true } },
    },
  });
}
