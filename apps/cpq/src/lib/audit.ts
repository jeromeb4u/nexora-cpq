import 'server-only';

import type { Prisma, prisma } from '@nexora/db';
import type { AuditAction, AuditEntity, NotificationType } from '@nexora/types';
import type { Actor } from '@nexora/auth/next';
import { logger } from '@nexora/observability';

/**
 * Audit and notification writes.
 *
 * Two rules this module exists to enforce:
 *
 *  1. **Audit writes participate in the caller's transaction.** An audit entry
 *     recorded for a change that then rolled back is a lie, and a change
 *     recorded with no audit entry is a gap. Both are avoided by taking the
 *     transaction client as a parameter rather than reaching for the global one.
 *
 *  2. **Metadata never carries anything the actor could not already see.**
 *     The audit trail is visible in the UI, so it is not a safe place to stash
 *     internal detail (docs/SECURITY.md).
 */

/** Either the base client or a transaction client. */
export type Db = Prisma.TransactionClient | typeof prisma;

export interface AuditInput {
  readonly action: AuditAction;
  readonly entity: AuditEntity;
  readonly entityId: string;
  readonly actorId: string | null;
  /** One human-readable sentence, shown verbatim in the activity feed. */
  readonly summary: string;
  readonly metadata?: Prisma.InputJsonValue;
}

export async function recordAudit(db: Db, input: AuditInput): Promise<void> {
  await db.auditEvent.create({
    data: {
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      actorId: input.actorId,
      summary: input.summary,
      ...(input.metadata === undefined ? {} : { metadata: input.metadata }),
    },
  });

  // Also emit a structured log line. The audit table is the user-facing record;
  // the log is the operational one, and they serve different readers.
  logger.info('audit', {
    action: input.action,
    entity: input.entity,
    entityId: input.entityId,
    actorId: input.actorId,
  });
}

export interface NotificationInput {
  readonly type: NotificationType;
  readonly userId: string;
  readonly title: string;
  readonly body: string;
  readonly href?: string;
}

export async function notify(db: Db, input: NotificationInput): Promise<void> {
  await db.notification.create({
    data: {
      type: input.type,
      userId: input.userId,
      title: input.title,
      body: input.body,
      href: input.href ?? null,
    },
  });
}

/** Everyone who can decide approvals, for fan-out when one is requested. */
export async function approverIds(db: Db, excludeUserId: string): Promise<string[]> {
  const approvers = await db.user.findMany({
    where: {
      isActive: true,
      role: { in: ['SALES_MANAGER', 'PRICING_ADMIN', 'ADMIN'] },
      id: { not: excludeUserId },
    },
    select: { id: true },
  });
  return approvers.map((approver) => approver.id);
}

/** Convenience for the common "actor did X to quote Y" shape. */
export function quoteAudit(
  actor: Actor,
  quoteId: string,
  action: AuditAction,
  summary: string,
  metadata?: Prisma.InputJsonValue,
): AuditInput {
  return {
    action,
    entity: 'QUOTE',
    entityId: quoteId,
    actorId: actor.id,
    summary,
    ...(metadata === undefined ? {} : { metadata }),
  };
}
