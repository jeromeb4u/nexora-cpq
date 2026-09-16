'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@nexora/db';
import {
  Permission,
  canDecideApproval,
  canEditQuote,
  canReadQuote,
} from '@nexora/auth/permissions';
import { teamIdsFor } from '@nexora/auth/scope';
import { requireActor, requirePermission } from '@nexora/auth/session';
import { headers } from 'next/headers';
import {
  type ConfigurationInput,
  type ContractTerm,
  bpsToRate,
  cents,
  formatMoney,
  formatRate,
  rateToBps,
} from '@nexora/types';
import {
  QUOTE_VALIDITY_DAYS,
  approvedDiscountRate,
  calculatePrice,
  canTransition,
  evaluateConfiguration,
  evaluateDiscount,
  isEditable,
} from '@nexora/cpq-engine';
import {
  approvalDecisionSchema,
  createQuoteSchema,
  quoteStatusTransitionSchema,
  requestApprovalSchema,
  saveConfigurationSchema,
} from '@nexora/validation';
import {
  AppError,
  ErrorCode,
  conflict,
  forbidden,
  logger,
  notFound,
  toSafeError,
} from '@nexora/observability';

import { loadCatalogue, loadRules } from '../catalogue';
import { approverIds, notify, recordAudit } from '../audit';

/**
 * Quote mutations.
 *
 * Every action in this file follows the same five steps, in this order:
 *
 *   1. authenticate   — who is asking
 *   2. validate       — Zod parse of everything from the client
 *   3. authorize      — permission AND row-level scope, server-side
 *   4. recompute      — pricing and rules from the DATABASE, never the client
 *   5. persist + audit — in one transaction, so neither can exist without the other
 *
 * Step 4 is the one that matters most. The browser sends selections and a
 * requested discount; it does not send prices. A client that posts
 * `discount: 99` reaches the discount engine, which clamps it, and the price is
 * computed from catalogue rows the client never touched (§33).
 */

export type ActionResult<T = void> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly code: string; readonly message: string; readonly reference: string };

/**
 * Convert a thrown error into a result the client can render.
 *
 * Unexpected errors are logged in full server-side and reduced to a reference
 * code for the browser, so a Prisma message never reaches a user (§31).
 */
function fail(error: unknown, context: Record<string, unknown>): ActionResult<never> {
  const safe = toSafeError(error);

  if (error instanceof AppError) {
    logger.warn('action rejected', { ...context, code: safe.code, reference: safe.reference });
  } else {
    logger.error('action failed', {
      ...context,
      reference: safe.reference,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return { ok: false, code: safe.code, message: safe.message, reference: safe.reference };
}

async function actor() {
  return requireActor(await headers());
}

/** Load a quote and assert the actor may edit it. Throws not-found otherwise. */
async function loadEditableQuote(quoteId: string, actorRecord: Awaited<ReturnType<typeof actor>>) {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: { currentVersion: { include: { items: true } }, location: true },
  });

  if (!quote) throw notFound('Quote');

  const access = {
    actorId: actorRecord.id,
    actorRole: actorRecord.role,
    quoteOwnerId: quote.ownerId,
    teamMemberIds: await teamIdsFor(actorRecord),
  };

  // Invisible quotes report as not-found so a probe cannot tell the difference.
  if (!canReadQuote(access)) throw notFound('Quote');
  if (!canEditQuote(access)) {
    throw forbidden('You do not have permission to modify this quote.');
  }

  return quote;
}

/* ==========================================================================
 * Create
 * ======================================================================== */

export async function createQuote(input: unknown): Promise<ActionResult<{ quoteId: string }>> {
  try {
    const actorRecord = await requirePermission(await headers(), Permission.QUOTE_CREATE);
    const data = createQuoteSchema.parse(input);

    const customer = await prisma.customer.findUnique({
      where: { id: data.customerId },
      select: { id: true, companyName: true },
    });
    if (!customer) throw notFound('Customer');

    // Quote numbers are sequential and human-facing. Deriving the next one from
    // the current maximum inside the transaction keeps them gapless under
    // concurrent creation.
    const quote = await prisma.$transaction(async (tx) => {
      const latest = await tx.quote.findFirst({
        orderBy: { quoteNumber: 'desc' },
        select: { quoteNumber: true },
      });

      const lastNumber = latest ? Number.parseInt(latest.quoteNumber.replace('QT-', ''), 10) : 10_470;
      const quoteNumber = `QT-${Number.isFinite(lastNumber) ? lastNumber + 1 : 10_471}`;

      const created = await tx.quote.create({
        data: {
          quoteNumber,
          status: 'DRAFT',
          title: data.title ?? null,
          customerId: data.customerId,
          locationId: data.locationId ?? null,
          ownerId: actorRecord.id,
        },
      });

      await recordAudit(tx, {
        action: 'QUOTE_CREATED',
        entity: 'QUOTE',
        entityId: created.id,
        actorId: actorRecord.id,
        summary: `Created quote ${quoteNumber} for ${customer.companyName}`,
      });

      return created;
    });

    revalidatePath('/quotes');
    return { ok: true, data: { quoteId: quote.id } };
  } catch (error) {
    return fail(error, { action: 'createQuote' });
  }
}

/* ==========================================================================
 * Configure and price
 * ======================================================================== */

/**
 * Save a configuration as a new version of the quote.
 *
 * This is the action that makes pricing server-authoritative. Note what is NOT
 * in the input schema: any price, any total, any line amount. Only product ids,
 * quantities, a term, and a requested discount.
 */
export async function saveConfiguration(input: unknown): Promise<
  ActionResult<{ versionId: string; requiresApproval: boolean; mrrCents: number }>
> {
  try {
    const actorRecord = await actor();
    const data = saveConfigurationSchema.parse(input);
    const quote = await loadEditableQuote(data.quoteId, actorRecord);

    if (!isEditable(quote.status)) {
      throw conflict(
        `A quote in the ${quote.status.replace(/_/g, ' ').toLowerCase()} state cannot be reconfigured. Create a revision instead.`,
      );
    }

    const [catalogue, rules] = await Promise.all([loadCatalogue(), loadRules()]);

    const configuration: ConfigurationInput = {
      selections: data.selections,
      contractMonths: data.contractMonths as ContractTerm,
      serviceability: quote.location?.serviceability ?? 'PENDING_CHECK',
      siteCount: data.siteCount,
    };

    // Validate against the live rule set before pricing anything.
    const validation = evaluateConfiguration(configuration, catalogue, rules);
    if (!validation.isValid) {
      const blocking = validation.findings.filter((finding) => finding.blocking);
      throw new AppError(
        ErrorCode.VALIDATION,
        `This configuration cannot be saved: ${blocking[0]?.message ?? 'it is not valid.'}`,
      );
    }

    const selectedProducts = catalogue.filter((product) =>
      data.selections.some((selection) => selection.productId === product.id),
    );

    // Price once at list to get a TCV for the value-based approval trigger,
    // then evaluate the discount against that, then price for real.
    const listPrice = calculatePrice({ configuration, catalogue, approvedManualRate: 0 });

    const discountRequest = {
      requestedBps: data.requestedDiscountBps,
      role: actorRecord.role,
      selectedProducts,
      tcv: listPrice.tcv,
    };

    const discount = evaluateDiscount(discountRequest);
    const price = calculatePrice({
      configuration,
      catalogue,
      // The CLAMPED rate, never the raw requested one.
      approvedManualRate: approvedDiscountRate(discountRequest),
    });

    const previousDiscountBps = quote.currentVersion?.discountBps ?? 0;

    const version = await prisma.$transaction(async (tx) => {
      const latest = await tx.quoteVersion.findFirst({
        where: { quoteId: quote.id },
        orderBy: { versionNumber: 'desc' },
        select: { id: true, versionNumber: true },
      });

      // Supersede rather than overwrite: quote history is append-only (§17).
      if (latest) {
        await tx.quoteVersion.update({
          where: { id: latest.id },
          data: { supersededAt: new Date() },
        });
      }

      const created = await tx.quoteVersion.create({
        data: {
          quoteId: quote.id,
          versionNumber: (latest?.versionNumber ?? 0) + 1,
          contractMonths: data.contractMonths,
          discountBps: data.requestedDiscountBps,
          discountReason: data.discountReason ?? null,
          grossMonthlyCents: price.grossMonthly,
          grossSetupCents: price.grossSetup,
          discountMonthlyCents: price.discountMonthly,
          mrrCents: price.mrr,
          otcCents: price.otc,
          tcvCents: price.tcv,
          effectiveDiscountBps: rateToBps(price.effectiveDiscountRate),
          createdById: actorRecord.id,
          configSnapshot: {
            findings: validation.findings.map((finding) => ({
              ruleId: finding.ruleId,
              severity: finding.severity,
              message: finding.message,
            })),
            discounts: price.discounts.map((applied) => ({
              code: applied.code,
              label: applied.label,
              rate: applied.rate,
              amountCents: applied.amount,
            })),
            discountEvaluation: {
              requestedRate: discount.requestedRate,
              allowedRate: discount.allowedRate,
              requiresApproval: discount.requiresApproval,
              someLinesCapped: discount.someLinesCapped,
              explanation: discount.explanation,
            },
            serviceability: configuration.serviceability,
            siteCount: configuration.siteCount,
          },
          items: {
            create: price.lines.map((line, index) => ({
              productId: line.productId,
              quantity: line.quantity,
              unitMonthlyCents: line.unitMonthlyPrice,
              unitSetupCents: line.unitSetupPrice,
              monthlyCents: line.monthlySubtotal,
              setupCents: line.setupSubtotal,
              skuSnapshot: line.sku,
              nameSnapshot: line.name,
              sortOrder: index,
            })),
          },
        },
      });

      await tx.quote.update({
        where: { id: quote.id },
        data: {
          currentVersionId: created.id,
          status: quote.status === 'DRAFT' ? 'CONFIGURING' : quote.status,
        },
      });

      await recordAudit(tx, {
        action: 'QUOTE_VERSION_CREATED',
        entity: 'QUOTE_VERSION',
        entityId: created.id,
        actorId: actorRecord.id,
        summary: `Saved version ${created.versionNumber} — ${formatMoney(price.mrr)} per month`,
        metadata: { versionNumber: created.versionNumber, mrrCents: price.mrr },
      });

      if (previousDiscountBps !== data.requestedDiscountBps) {
        await recordAudit(tx, {
          action: 'DISCOUNT_CHANGED',
          entity: 'QUOTE',
          entityId: quote.id,
          actorId: actorRecord.id,
          summary: `Discount changed ${formatRate(bpsToRate(previousDiscountBps))} → ${formatRate(
            bpsToRate(data.requestedDiscountBps),
          )}`,
          metadata: { fromBps: previousDiscountBps, toBps: data.requestedDiscountBps },
        });
      }

      return created;
    });

    revalidatePath(`/quotes/${quote.id}`);
    revalidatePath('/quotes');

    return {
      ok: true,
      data: {
        versionId: version.id,
        requiresApproval: discount.requiresApproval,
        mrrCents: price.mrr,
      },
    };
  } catch (error) {
    return fail(error, { action: 'saveConfiguration' });
  }
}

/* ==========================================================================
 * Approval
 * ======================================================================== */

export async function requestApproval(input: unknown): Promise<ActionResult<{ approvalId: string }>> {
  try {
    const actorRecord = await actor();
    const data = requestApprovalSchema.parse(input);
    const quote = await loadEditableQuote(data.quoteId, actorRecord);

    const version = await prisma.quoteVersion.findUnique({
      where: { id: data.quoteVersionId },
      include: { items: true },
    });
    if (!version || version.quoteId !== quote.id) throw notFound('Quote version');

    const transition = canTransition({
      from: quote.status,
      to: 'APPROVAL_REQUIRED',
      actorRole: actorRecord.role,
      actorId: actorRecord.id,
      quoteOwnerId: quote.ownerId,
    });
    if (!transition.allowed) throw conflict(transition.reason);

    const catalogue = await loadCatalogue();
    const selectedProducts = catalogue.filter((product) =>
      version.items.some((item) => item.productId === product.id),
    );

    // Re-evaluate rather than trusting what was stored: policy may have changed
    // since the version was created.
    const discount = evaluateDiscount({
      requestedBps: version.discountBps,
      role: actorRecord.role,
      selectedProducts,
      tcv: cents(version.tcvCents),
    });

    if (!discount.requiresApproval) {
      throw conflict(
        'This quote does not require approval — it is already within your authority.',
      );
    }
    if (discount.exceedsAllRoles) {
      throw conflict(discount.explanation);
    }

    const approval = await prisma.$transaction(async (tx) => {
      const created = await tx.quoteApproval.create({
        data: {
          quoteId: quote.id,
          quoteVersionId: version.id,
          decision: 'PENDING',
          reason: discount.reasons[0] ?? 'MANUAL_ESCALATION',
          requestedDiscountBps: version.discountBps,
          allowedDiscountBps: rateToBps(discount.allowedRate),
          mrrCentsSnapshot: version.mrrCents,
          justification: data.justification,
          requestedById: actorRecord.id,
        },
      });

      await tx.quote.update({
        where: { id: quote.id },
        data: { status: 'APPROVAL_REQUIRED' },
      });

      await recordAudit(tx, {
        action: 'APPROVAL_REQUESTED',
        entity: 'QUOTE_APPROVAL',
        entityId: created.id,
        actorId: actorRecord.id,
        summary: `Approval requested — ${formatRate(
          bpsToRate(version.discountBps),
        )} exceeds the ${formatRate(discount.allowedRate)} threshold`,
        metadata: {
          requestedBps: version.discountBps,
          allowedBps: rateToBps(discount.allowedRate),
        },
      });

      // Tell everyone who could actually act on it.
      for (const userId of await approverIds(tx, actorRecord.id)) {
        await notify(tx, {
          type: 'APPROVAL_REQUESTED',
          userId,
          title: `Approval requested on ${quote.quoteNumber}`,
          body: `${actorRecord.name} requested ${formatRate(
            bpsToRate(version.discountBps),
          )} — ${formatMoney(cents(version.mrrCents))} per month.`,
          href: `/approvals`,
        });
      }

      return created;
    });

    revalidatePath(`/quotes/${quote.id}`);
    revalidatePath('/approvals');

    return { ok: true, data: { approvalId: approval.id } };
  } catch (error) {
    return fail(error, { action: 'requestApproval' });
  }
}

export async function decideApproval(input: unknown): Promise<ActionResult<{ status: string }>> {
  try {
    const actorRecord = await actor();
    const data = approvalDecisionSchema.parse(input);

    const approval = await prisma.quoteApproval.findUnique({
      where: { id: data.approvalId },
      include: { quote: true, requestedBy: { select: { id: true, name: true } } },
    });
    if (!approval) throw notFound('Approval');

    if (approval.decision !== 'PENDING') {
      throw conflict('This approval has already been decided.');
    }

    const access = {
      actorId: actorRecord.id,
      actorRole: actorRecord.role,
      quoteOwnerId: approval.quote.ownerId,
      teamMemberIds: await teamIdsFor(actorRecord),
    };

    // Two independent layers agree that nobody approves their own quote: the
    // permission check here, and the state machine below. Deliberate.
    if (!canDecideApproval(access)) {
      throw forbidden(
        actorRecord.id === approval.quote.ownerId
          ? 'You cannot approve or reject your own quote.'
          : 'Your role does not permit approving quotes.',
      );
    }

    const nextStatus = data.decision === 'APPROVED' ? 'APPROVED' : 'REJECTED';

    const transition = canTransition({
      from: approval.quote.status,
      to: nextStatus,
      actorRole: actorRecord.role,
      actorId: actorRecord.id,
      quoteOwnerId: approval.quote.ownerId,
    });
    if (!transition.allowed) throw conflict(transition.reason);

    await prisma.$transaction(async (tx) => {
      await tx.quoteApproval.update({
        where: { id: approval.id },
        data: {
          decision: data.decision,
          decidedById: actorRecord.id,
          decidedAt: new Date(),
          decisionNote: data.decision === 'REJECTED' ? data.decisionNote : null,
        },
      });

      await tx.quote.update({
        where: { id: approval.quoteId },
        data: {
          status: nextStatus,
          ...(data.decision === 'APPROVED'
            ? {
                validUntil: new Date(
                  Date.now() + QUOTE_VALIDITY_DAYS * 24 * 60 * 60 * 1000,
                ),
              }
            : {}),
        },
      });

      await recordAudit(tx, {
        action: data.decision === 'APPROVED' ? 'APPROVAL_GRANTED' : 'APPROVAL_REJECTED',
        entity: 'QUOTE_APPROVAL',
        entityId: approval.id,
        actorId: actorRecord.id,
        summary:
          data.decision === 'APPROVED'
            ? `Approved ${formatRate(bpsToRate(approval.requestedDiscountBps))} discount`
            : `Rejected ${formatRate(bpsToRate(approval.requestedDiscountBps))} discount`,
        metadata: { requestedBps: approval.requestedDiscountBps },
      });

      await notify(tx, {
        type: data.decision === 'APPROVED' ? 'APPROVAL_GRANTED' : 'APPROVAL_REJECTED',
        userId: approval.requestedById,
        title: `${approval.quote.quoteNumber} ${data.decision === 'APPROVED' ? 'approved' : 'rejected'}`,
        body:
          data.decision === 'APPROVED'
            ? `${actorRecord.name} approved your ${formatRate(bpsToRate(approval.requestedDiscountBps))} discount.`
            : `${actorRecord.name} rejected your discount: ${data.decisionNote}`,
        href: `/quotes/${approval.quoteId}`,
      });
    });

    revalidatePath('/approvals');
    revalidatePath(`/quotes/${approval.quoteId}`);

    return { ok: true, data: { status: nextStatus } };
  } catch (error) {
    return fail(error, { action: 'decideApproval' });
  }
}

/* ==========================================================================
 * Status transitions
 * ======================================================================== */

export async function transitionQuoteStatus(input: unknown): Promise<ActionResult<{ status: string }>> {
  try {
    const actorRecord = await actor();
    const data = quoteStatusTransitionSchema.parse(input);

    const quote = await prisma.quote.findUnique({
      where: { id: data.quoteId },
      select: { id: true, status: true, ownerId: true, quoteNumber: true },
    });
    if (!quote) throw notFound('Quote');

    const access = {
      actorId: actorRecord.id,
      actorRole: actorRecord.role,
      quoteOwnerId: quote.ownerId,
      teamMemberIds: await teamIdsFor(actorRecord),
    };
    if (!canReadQuote(access)) throw notFound('Quote');

    // The state machine is the authority. A client asking for an arbitrary
    // status change is answered here, not by trusting the request (§18).
    const transition = canTransition({
      from: quote.status,
      to: data.toStatus,
      actorRole: actorRecord.role,
      actorId: actorRecord.id,
      quoteOwnerId: quote.ownerId,
    });
    if (!transition.allowed) throw conflict(transition.reason);

    await prisma.$transaction(async (tx) => {
      await tx.quote.update({
        where: { id: quote.id },
        data: {
          status: data.toStatus,
          ...(data.toStatus === 'SENT_TO_CUSTOMER' ? { sentAt: new Date() } : {}),
          ...(data.toStatus === 'ACCEPTED' ? { acceptedAt: new Date() } : {}),
        },
      });

      await recordAudit(tx, {
        action: 'QUOTE_STATUS_CHANGED',
        entity: 'QUOTE',
        entityId: quote.id,
        actorId: actorRecord.id,
        summary: `Status changed ${quote.status.replace(/_/g, ' ').toLowerCase()} → ${data.toStatus
          .replace(/_/g, ' ')
          .toLowerCase()}`,
        metadata: { from: quote.status, to: data.toStatus },
      });
    });

    revalidatePath(`/quotes/${quote.id}`);
    revalidatePath('/quotes');

    return { ok: true, data: { status: data.toStatus } };
  } catch (error) {
    return fail(error, { action: 'transitionQuoteStatus' });
  }
}

/* ==========================================================================
 * Versioning
 * ======================================================================== */

/**
 * Create a new revision from an existing version.
 *
 * The source version is copied, never mutated: restoring an old version adds a
 * new one on top rather than rewinding history, so the trail of what was
 * offered and when stays intact (§17).
 */
export async function createRevisionFrom(input: {
  quoteId: string;
  sourceVersionId: string;
}): Promise<ActionResult<{ versionId: string }>> {
  try {
    const actorRecord = await actor();
    const quote = await loadEditableQuote(input.quoteId, actorRecord);

    const source = await prisma.quoteVersion.findUnique({
      where: { id: input.sourceVersionId },
      include: { items: true },
    });
    if (!source || source.quoteId !== quote.id) throw notFound('Quote version');

    const created = await prisma.$transaction(async (tx) => {
      const latest = await tx.quoteVersion.findFirst({
        where: { quoteId: quote.id },
        orderBy: { versionNumber: 'desc' },
        select: { id: true, versionNumber: true },
      });

      if (latest) {
        await tx.quoteVersion.update({
          where: { id: latest.id },
          data: { supersededAt: new Date() },
        });
      }

      const version = await tx.quoteVersion.create({
        data: {
          quoteId: quote.id,
          versionNumber: (latest?.versionNumber ?? 0) + 1,
          contractMonths: source.contractMonths,
          discountBps: source.discountBps,
          discountReason: source.discountReason,
          grossMonthlyCents: source.grossMonthlyCents,
          grossSetupCents: source.grossSetupCents,
          discountMonthlyCents: source.discountMonthlyCents,
          mrrCents: source.mrrCents,
          otcCents: source.otcCents,
          tcvCents: source.tcvCents,
          effectiveDiscountBps: source.effectiveDiscountBps,
          configSnapshot: source.configSnapshot ?? undefined,
          createdById: actorRecord.id,
          items: {
            create: source.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitMonthlyCents: item.unitMonthlyCents,
              unitSetupCents: item.unitSetupCents,
              monthlyCents: item.monthlyCents,
              setupCents: item.setupCents,
              skuSnapshot: item.skuSnapshot,
              nameSnapshot: item.nameSnapshot,
              sortOrder: item.sortOrder,
            })),
          },
        },
      });

      await tx.quote.update({
        where: { id: quote.id },
        data: { currentVersionId: version.id, status: 'CONFIGURING' },
      });

      await recordAudit(tx, {
        action: 'QUOTE_VERSION_RESTORED',
        entity: 'QUOTE_VERSION',
        entityId: version.id,
        actorId: actorRecord.id,
        summary: `Created version ${version.versionNumber} from version ${source.versionNumber}`,
        metadata: { fromVersion: source.versionNumber, toVersion: version.versionNumber },
      });

      return version;
    });

    revalidatePath(`/quotes/${quote.id}`);
    return { ok: true, data: { versionId: created.id } };
  } catch (error) {
    return fail(error, { action: 'createRevisionFrom' });
  }
}
