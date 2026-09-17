import 'server-only';

import type { Prisma, prisma } from '@nexora/db';
import type { AuditAction, AuditEntity } from '@nexora/types';
import { logger } from '@nexora/observability';

/**
 * Audit writes, scoped to the customer/location services.
 *
 * Mirrors `apps/cpq/src/lib/audit.ts`'s `recordAudit`: it takes the caller's
 * transaction client rather than the global one, so an audit entry can never
 * be recorded for a change that then rolls back, and a persisted change can
 * never be missing its audit entry.
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
  /**
   * Structured detail for the log and audit trail. Field NAMES only for a
   * "what changed" event — never the values themselves (docs/SECURITY.md).
   */
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

  logger.info('audit', {
    action: input.action,
    entity: input.entity,
    entityId: input.entityId,
    actorId: input.actorId,
  });
}
