import 'server-only';

import { prisma } from '@nexora/db';
import type { Prisma } from '@nexora/db';
import type { Actor } from '@nexora/auth/next';
import { quoteVisibilityFilter, teamIdsFor } from '@nexora/auth/scope';
import { canEditQuote, canReadQuote } from '@nexora/auth/permissions';
import { notFound } from '@nexora/observability';
import type { QuoteListQueryInput } from '@nexora/validation';

/**
 * Quote queries.
 *
 * Every function here starts from `quoteVisibilityFilter(actor)`, so scope is
 * part of the WHERE clause rather than a check applied to rows that have
 * already been fetched. A quote the actor may not see does not appear, is not
 * counted, and reports as not-found rather than forbidden — a probe cannot
 * distinguish "exists but denied" from "does not exist" (docs/SECURITY.md).
 */

export interface QuoteListResult {
  readonly rows: Awaited<ReturnType<typeof findQuotes>>;
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly pageCount: number;
}

async function findQuotes(where: Prisma.QuoteWhereInput, query: QuoteListQueryInput) {
  return prisma.quote.findMany({
    where,
    orderBy: buildOrderBy(query),
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
    select: {
      id: true,
      quoteNumber: true,
      status: true,
      title: true,
      updatedAt: true,
      customer: { select: { id: true, companyName: true } },
      owner: { select: { id: true, name: true } },
      currentVersion: {
        select: {
          mrrCents: true,
          tcvCents: true,
          contractMonths: true,
          discountBps: true,
          versionNumber: true,
        },
      },
    },
  });
}

/**
 * Translate the validated sort into Prisma ordering.
 *
 * `mrrCents` lives on the related version, so it cannot be ordered as a plain
 * column. Ordering through the relation keeps sorting server-side rather than
 * pulling every row into memory to sort it.
 */
function buildOrderBy(query: QuoteListQueryInput): Prisma.QuoteOrderByWithRelationInput {
  switch (query.sortBy) {
    case 'quoteNumber':
      return { quoteNumber: query.sortDir };
    case 'status':
      return { status: query.sortDir };
    case 'mrrCents':
      return { currentVersion: { mrrCents: query.sortDir } };
    case 'updatedAt':
    default:
      return { updatedAt: query.sortDir };
  }
}

function buildWhere(
  ownerFilter: Awaited<ReturnType<typeof quoteVisibilityFilter>>,
  query: QuoteListQueryInput,
): Prisma.QuoteWhereInput {
  const where: Prisma.QuoteWhereInput = { ...ownerFilter };

  if (query.search) {
    // Matching the quote number, the title and the customer name covers how
    // people actually search: by reference, by deal name, or by who it is for.
    where.OR = [
      { quoteNumber: { contains: query.search, mode: 'insensitive' } },
      { title: { contains: query.search, mode: 'insensitive' } },
      { customer: { companyName: { contains: query.search, mode: 'insensitive' } } },
    ];
  }

  if (query.status.length > 0) {
    where.status = { in: query.status };
  }

  // An explicit owner filter NARROWS the visible set; it can never widen it,
  // because ownerFilter is spread first and this only adds a constraint when
  // it is compatible.
  if (query.ownerId) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      { ownerId: query.ownerId },
    ];
  }

  if (query.customerId) {
    where.customerId = query.customerId;
  }

  if (query.updatedAfter || query.updatedBefore) {
    where.updatedAt = {
      ...(query.updatedAfter ? { gte: new Date(query.updatedAfter) } : {}),
      ...(query.updatedBefore ? { lte: new Date(query.updatedBefore) } : {}),
    };
  }

  return where;
}

export async function listQuotes(
  actor: Actor,
  query: QuoteListQueryInput,
): Promise<QuoteListResult> {
  const ownerFilter = await quoteVisibilityFilter(actor);
  const where = buildWhere(ownerFilter, query);

  const [rows, total] = await Promise.all([
    findQuotes(where, query),
    prisma.quote.count({ where }),
  ]);

  return {
    rows,
    total,
    page: query.page,
    pageSize: query.pageSize,
    pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

/** Distinct owners among quotes this actor can see, for the owner filter. */
export async function listVisibleOwners(actor: Actor) {
  const ownerFilter = await quoteVisibilityFilter(actor);

  const quotes = await prisma.quote.findMany({
    where: ownerFilter,
    distinct: ['ownerId'],
    select: { owner: { select: { id: true, name: true } } },
    orderBy: { owner: { name: 'asc' } },
  });

  return quotes.map((quote) => quote.owner);
}

/**
 * A single quote with everything the detail page needs.
 *
 * Throws not-found — never forbidden — when the actor may not see it.
 */
export async function getQuoteDetail(actor: Actor, quoteId: string) {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: {
      customer: true,
      location: true,
      owner: { select: { id: true, name: true, email: true, role: true } },
      currentVersion: {
        include: {
          items: { orderBy: { sortOrder: 'asc' } },
          createdBy: { select: { name: true } },
        },
      },
      versions: {
        orderBy: { versionNumber: 'desc' },
        select: {
          id: true,
          versionNumber: true,
          mrrCents: true,
          otcCents: true,
          tcvCents: true,
          discountBps: true,
          effectiveDiscountBps: true,
          contractMonths: true,
          createdAt: true,
          supersededAt: true,
          createdBy: { select: { name: true } },
        },
      },
      approvals: {
        orderBy: { createdAt: 'desc' },
        include: {
          requestedBy: { select: { name: true } },
          decidedBy: { select: { name: true } },
        },
      },
    },
  });

  if (!quote) throw notFound('Quote');

  const teamMemberIds = await teamIdsFor(actor);
  const access = {
    actorId: actor.id,
    actorRole: actor.role,
    quoteOwnerId: quote.ownerId,
    teamMemberIds,
  };

  // Same message either way: an unauthorized probe learns nothing.
  if (!canReadQuote(access)) throw notFound('Quote');

  return { quote, canEdit: canEditQuote(access) };
}

/**
 * Audit trail for one quote, newest first.
 *
 * Events are recorded against the entity they concern, so an approval event is
 * keyed by the APPROVAL's id, not the quote's. Collecting the related ids first
 * is what makes the trail complete rather than quote-events-only.
 */
export async function getQuoteAudit(quoteId: string, take = 50) {
  const [versions, approvals] = await Promise.all([
    prisma.quoteVersion.findMany({ where: { quoteId }, select: { id: true } }),
    prisma.quoteApproval.findMany({ where: { quoteId }, select: { id: true } }),
  ]);

  const relatedIds = [
    quoteId,
    ...versions.map((version) => version.id),
    ...approvals.map((approval) => approval.id),
  ];

  return prisma.auditEvent.findMany({
    where: { entityId: { in: relatedIds } },
    orderBy: { createdAt: 'desc' },
    take,
    select: {
      id: true,
      action: true,
      summary: true,
      createdAt: true,
      metadata: true,
      actor: { select: { name: true } },
    },
  });
}
