import 'server-only';

import { prisma } from '@nexora/db';
import type { Actor } from '@nexora/auth/next';

/**
 * Approval queue queries.
 *
 * The queue is deliberately NOT scoped by quote ownership: an approver's job is
 * to see escalations from across the business, and the permission to reach this
 * page (`APPROVAL_READ_QUEUE`) is what gates access. What IS filtered out is the
 * approver's own quotes — they could never act on those, so showing them would
 * only be noise (and the action would refuse anyway).
 */

export async function listPendingApprovals(actor: Actor) {
  return prisma.quoteApproval.findMany({
    where: {
      decision: 'PENDING',
      // Nobody approves their own quote; keep them out of the queue entirely.
      quote: { ownerId: { not: actor.id }, status: 'APPROVAL_REQUIRED' },
    },
    orderBy: { createdAt: 'asc' }, // oldest first: a queue, not a feed
    include: {
      requestedBy: { select: { id: true, name: true, role: true } },
      quote: {
        select: {
          id: true,
          quoteNumber: true,
          status: true,
          customer: { select: { companyName: true } },
          location: { select: { name: true } },
        },
      },
      quoteVersion: {
        select: {
          id: true,
          versionNumber: true,
          mrrCents: true,
          otcCents: true,
          tcvCents: true,
          contractMonths: true,
          discountBps: true,
          effectiveDiscountBps: true,
          items: {
            orderBy: { sortOrder: 'asc' },
            select: {
              id: true,
              skuSnapshot: true,
              nameSnapshot: true,
              quantity: true,
              monthlyCents: true,
            },
          },
        },
      },
    },
  });
}

/** Recently decided approvals, so the page shows outcomes as well as work. */
export async function listRecentDecisions(take = 10) {
  return prisma.quoteApproval.findMany({
    where: { decision: { in: ['APPROVED', 'REJECTED'] } },
    orderBy: { decidedAt: 'desc' },
    take,
    include: {
      requestedBy: { select: { name: true } },
      decidedBy: { select: { name: true } },
      quote: {
        select: { id: true, quoteNumber: true, customer: { select: { companyName: true } } },
      },
    },
  });
}
