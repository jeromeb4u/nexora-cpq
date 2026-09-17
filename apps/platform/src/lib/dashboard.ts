import 'server-only';

import { prisma } from '@nexora/db';
import { type Actor } from '@nexora/auth/session';
import { quoteVisibilityFilter } from '@nexora/auth/scope';
import { Permission, can } from '@nexora/auth/permissions';
import { type Cents, cents } from '@nexora/types';

/**
 * Dashboard metrics.
 *
 * Every figure here is aggregated from the database and scoped to what the
 * signed-in user may actually see (§26) — a sales rep's pipeline is their own
 * pipeline, a manager's is their team's. No placeholder numbers, and no metric
 * that silently counts rows the viewer has no right to.
 */

/** Statuses that represent live commercial opportunity. */
const OPEN_STATUSES = [
  'DRAFT',
  'CONFIGURING',
  'READY_FOR_REVIEW',
  'APPROVAL_REQUIRED',
  'APPROVED',
  'SENT_TO_CUSTOMER',
] as const;

/** Statuses that represent a concluded opportunity, for win-rate. */
const WON_STATUSES = ['ACCEPTED'] as const;
const LOST_STATUSES = ['REJECTED', 'EXPIRED', 'CANCELLED'] as const;

export interface DashboardMetrics {
  readonly activeQuotes: number;
  readonly awaitingApproval: number;
  /** Sum of TCV across open quotes, in cents. */
  readonly pipelineValue: Cents;
  /** Sum of MRR across open quotes, in cents. */
  readonly pipelineMrr: Cents;
  /** 0..1, or null when nothing has concluded yet. */
  readonly winRate: number | null;
  readonly wonCount: number;
  readonly concludedCount: number;
  readonly customerCount: number;
}

export async function getDashboardMetrics(actor: Actor): Promise<DashboardMetrics> {
  const ownerFilter = await quoteVisibilityFilter(actor);

  const [activeQuotes, awaitingApproval, openTotals, wonCount, lostCount, customerCount] =
    await Promise.all([
      prisma.quote.count({
        where: { ...ownerFilter, status: { in: [...OPEN_STATUSES] } },
      }),

      // A rep sees their own escalations; an approver sees the whole queue.
      can(actor.role, Permission.APPROVAL_READ_QUEUE)
        ? prisma.quoteApproval.count({ where: { decision: 'PENDING' } })
        : prisma.quote.count({
            where: { ...ownerFilter, status: 'APPROVAL_REQUIRED' },
          }),

      // Aggregate over the CURRENT version of each open quote. Summing all
      // versions would count superseded revisions and inflate the pipeline.
      prisma.quoteVersion.aggregate({
        where: {
          supersededAt: null,
          quote: { ...ownerFilter, status: { in: [...OPEN_STATUSES] } },
        },
        _sum: { tcvCents: true, mrrCents: true },
      }),

      prisma.quote.count({ where: { ...ownerFilter, status: { in: [...WON_STATUSES] } } }),
      prisma.quote.count({ where: { ...ownerFilter, status: { in: [...LOST_STATUSES] } } }),

      prisma.customer.count(
        can(actor.role, Permission.QUOTE_READ_ALL)
          ? undefined
          : { where: { accountOwnerId: actor.id } },
      ),
    ]);

  const concludedCount = wonCount + lostCount;

  return {
    activeQuotes,
    awaitingApproval,
    pipelineValue: cents(openTotals._sum.tcvCents ?? 0),
    pipelineMrr: cents(openTotals._sum.mrrCents ?? 0),
    winRate: concludedCount === 0 ? null : wonCount / concludedCount,
    wonCount,
    concludedCount,
    customerCount,
  };
}

/** The most recently touched quotes the actor may see. */
export async function getRecentQuotes(actor: Actor, take = 6) {
  const ownerFilter = await quoteVisibilityFilter(actor);

  return prisma.quote.findMany({
    where: ownerFilter,
    orderBy: { updatedAt: 'desc' },
    take,
    select: {
      id: true,
      quoteNumber: true,
      status: true,
      updatedAt: true,
      customer: { select: { companyName: true } },
      owner: { select: { name: true } },
      currentVersion: { select: { mrrCents: true, contractMonths: true, discountBps: true } },
    },
  });
}

/** Recent audit events, for the dashboard activity feed. */
export async function getRecentActivity(actor: Actor, take = 8) {
  const ownerFilter = await quoteVisibilityFilter(actor);

  // Restrict the feed to entities the actor can see. Quote ids are resolved
  // first so the audit query never returns an event about someone else's quote.
  const visibleQuotes = await prisma.quote.findMany({
    where: ownerFilter,
    select: { id: true },
  });
  const visibleIds = visibleQuotes.map((quote) => quote.id);

  return prisma.auditEvent.findMany({
    where: {
      OR: [{ entity: 'QUOTE', entityId: { in: visibleIds } }, { actorId: actor.id }],
    },
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
