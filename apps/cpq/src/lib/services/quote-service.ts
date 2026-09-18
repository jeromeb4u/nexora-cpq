import 'server-only';

import { Prisma, prisma } from '@nexora/db';
import {
  Permission,
  can,
  canDecideApproval,
  canEditQuote,
  canReadQuote,
  type QuoteAccessContext,
} from '@nexora/auth/permissions';
import { teamIdsFor } from '@nexora/auth/scope';
import type { Actor } from '@nexora/auth/session';
import {
  type ConfigurationInput,
  type ContractTerm,
  type QuoteStatus,
  type Role,
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
  canApproveDiscount,
  canTransition,
  evaluateConfiguration,
  evaluateDiscount,
  isEditable,
} from '@nexora/cpq-engine';
import {
  approvalDecisionSchema,
  createQuoteSchema,
  createRevisionSchema,
  quoteStatusTransitionSchema,
  requestApprovalSchema,
  saveConfigurationSchema,
} from '@nexora/validation';
import { AppError, ErrorCode, conflict, forbidden, notFound } from '@nexora/observability';
import {
  type EmailMessage,
  approvalGranted,
  approvalRejected,
  approvalRequested,
  quoteSent,
} from '@nexora/email';

import { loadCatalogue, loadRules } from '../catalogue';
import { type Db, notify, recordAudit } from '../audit';
import { createDocumentToken } from './document-link';
import { type ServiceOutcome, outcome, publicUrl } from './outcome';

/**
 * Quote workflow services.
 *
 * Every function follows the same five steps, in this order:
 *
 *   1. validate       — Zod parse of everything from the client
 *   2. authorize      — permission AND row-level scope, server-side
 *   3. guard          — the state machine and business policy
 *   4. recompute      — pricing and rules from the DATABASE, never the client
 *   5. persist + audit — in one transaction, so neither can exist without the other
 *
 * Authentication happens one layer up: services receive an `Actor` that the
 * caller has already resolved from the session. That split is what makes these
 * functions callable from integration tests with a real database and no HTTP.
 *
 * Step 4 is the one that matters most. The browser sends selections and a
 * requested discount; it does not send prices. A client that posts
 * `discount: 99` reaches the discount engine, which clamps it, and the price is
 * computed from catalogue rows the client never touched (§33).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function describeStatus(status: string): string {
  return status.replace(/_/g, ' ').toLowerCase();
}

async function accessContext(actor: Actor, quoteOwnerId: string): Promise<QuoteAccessContext> {
  return {
    actorId: actor.id,
    actorRole: actor.role,
    quoteOwnerId,
    teamMemberIds: await teamIdsFor(actor),
  };
}

/** Throw a conflict unless every hop in `path` is a permitted transition. */
function assertTransitionPath(
  actor: Actor,
  quote: { readonly status: QuoteStatus; readonly ownerId: string },
  path: readonly QuoteStatus[],
): void {
  let from = quote.status;
  for (const to of path) {
    const result = canTransition({
      from,
      to,
      actorRole: actor.role,
      actorId: actor.id,
      quoteOwnerId: quote.ownerId,
    });
    if (!result.allowed) throw new AppError(ErrorCode.INVALID_TRANSITION, result.reason);
    from = to;
  }
}

/** Load a quote the actor may edit. Invisible quotes report as not-found. */
async function loadEditableQuote(actor: Actor, quoteId: string) {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: {
      currentVersion: { include: { items: true } },
      location: true,
      customer: { select: { id: true, companyName: true } },
    },
  });
  if (!quote) throw notFound('Quote');

  const access = await accessContext(actor, quote.ownerId);
  // Same answer as a missing row, so a probe learns nothing.
  if (!canReadQuote(access)) throw notFound('Quote');
  if (!canEditQuote(access)) throw forbidden('You do not have permission to modify this quote.');

  return quote;
}

/**
 * Close any pending approval on a quote that is leaving the approval desk
 * without a decision, so the queue never shows a request nobody can act on.
 */
async function withdrawPendingApprovals(tx: Db, actor: Actor, quoteId: string): Promise<void> {
  const pending = await tx.quoteApproval.findMany({
    where: { quoteId, decision: 'PENDING' },
    select: { id: true },
  });

  for (const approval of pending) {
    await tx.quoteApproval.update({
      where: { id: approval.id },
      data: { decision: 'WITHDRAWN', decidedById: actor.id, decidedAt: new Date() },
    });
    await recordAudit(tx, {
      action: 'QUOTE_UPDATED',
      entity: 'QUOTE_APPROVAL',
      entityId: approval.id,
      actorId: actor.id,
      summary: 'Approval request withdrawn',
    });
  }
}

/** Active users who could approve `requestedBps`, excluding the given ids. */
async function eligibleApprovers(tx: Db, requestedBps: number, excludeIds: readonly string[]) {
  const candidates = await tx.user.findMany({
    where: {
      isActive: true,
      role: { in: ['SALES_MANAGER', 'PRICING_ADMIN', 'ADMIN'] },
      id: { notIn: [...excludeIds] },
    },
    select: { id: true, email: true, name: true, role: true },
  });
  return candidates.filter((user) => canApproveDiscount(user.role as Role, requestedBps));
}

/** The person a customer-facing quote is addressed to. */
function customerContact(quote: {
  readonly customer: { readonly companyName: string; readonly email: string };
  readonly location: { readonly contactName: string; readonly contactEmail: string } | null;
}) {
  return quote.location
    ? { name: quote.location.contactName, email: quote.location.contactEmail }
    : { name: quote.customer.companyName, email: quote.customer.email };
}

/* ==========================================================================
 * Create
 * ======================================================================== */

const FIRST_QUOTE_NUMBER = 10_471;
const QUOTE_NUMBER_ATTEMPTS = 3;

export async function createQuote(
  actor: Actor,
  input: unknown,
): Promise<ServiceOutcome<{ quoteId: string; quoteNumber: string }>> {
  const data = createQuoteSchema.parse(input);

  if (!can(actor.role, Permission.QUOTE_CREATE)) {
    throw forbidden('Your role does not permit creating quotes.');
  }

  const customer = await prisma.customer.findUnique({
    where: { id: data.customerId },
    select: { id: true, companyName: true },
  });
  if (!customer) throw notFound('Customer');

  if (data.locationId) {
    // A location id from the client is only a claim. It must belong to this
    // customer, or a quote could be priced against another company's site.
    const location = await prisma.customerLocation.findFirst({
      where: { id: data.locationId, customerId: customer.id },
      select: { id: true },
    });
    if (!location) throw notFound('Location');
  }

  // Quote numbers are sequential and human-facing. The next number is derived
  // from the current maximum; two concurrent creations can pick the same one,
  // in which case the unique constraint rejects the loser and it retries.
  for (let attempt = 1; ; attempt += 1) {
    try {
      const quote = await prisma.$transaction(async (tx) => {
        const latest = await tx.quote.findFirst({
          orderBy: { quoteNumber: 'desc' },
          select: { quoteNumber: true },
        });
        const last = latest ? Number.parseInt(latest.quoteNumber.replace('QT-', ''), 10) : NaN;
        const quoteNumber = `QT-${Number.isFinite(last) ? last + 1 : FIRST_QUOTE_NUMBER}`;

        const created = await tx.quote.create({
          data: {
            quoteNumber,
            status: 'DRAFT',
            title: data.title ?? null,
            customerId: customer.id,
            locationId: data.locationId ?? null,
            ownerId: actor.id,
          },
        });

        await recordAudit(tx, {
          action: 'QUOTE_CREATED',
          entity: 'QUOTE',
          entityId: created.id,
          actorId: actor.id,
          summary: `Created quote ${quoteNumber} for ${customer.companyName}`,
        });

        return created;
      });

      return outcome(
        { quoteId: quote.id, quoteNumber: quote.quoteNumber },
        { revalidate: ['/quotes'] },
      );
    } catch (error) {
      const isNumberCollision =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
      if (!isNumberCollision || attempt >= QUOTE_NUMBER_ATTEMPTS) throw error;
    }
  }
}

/* ==========================================================================
 * Configure and price
 * ======================================================================== */

/**
 * Save a configuration as a new version of the quote.
 *
 * This is what makes pricing server-authoritative. Note what is NOT in the
 * input schema: any price, any total, any line amount. Only product ids,
 * quantities, a term, and a requested discount.
 */
export async function saveConfiguration(
  actor: Actor,
  input: unknown,
): Promise<ServiceOutcome<{ versionId: string; requiresApproval: boolean; mrrCents: number }>> {
  const data = saveConfigurationSchema.parse(input);
  const quote = await loadEditableQuote(actor, data.quoteId);

  if (!isEditable(quote.status)) {
    throw conflict(
      `A quote that is ${describeStatus(quote.status)} cannot be reconfigured. Reopen it or create a revision first.`,
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

  const selectedIds = new Set(data.selections.map((selection) => selection.productId));
  const selectedProducts = catalogue.filter((product) => selectedIds.has(product.id));

  // Price once at list to get a TCV for the value-based approval trigger,
  // then evaluate the discount against that, then price for real.
  const listPrice = calculatePrice({ configuration, catalogue, approvedManualRate: 0 });
  const discountRequest = {
    requestedBps: data.requestedDiscountBps,
    role: actor.role,
    selectedProducts,
    tcv: listPrice.tcv,
  };
  const discount = evaluateDiscount(discountRequest);
  // The CLAMPED rate, never the raw requested one — and that is also what is
  // stored, so a version can never record a discount nobody could grant.
  const manualRate = approvedDiscountRate(discountRequest);
  const storedDiscountBps = rateToBps(manualRate);
  const price = calculatePrice({ configuration, catalogue, approvedManualRate: manualRate });

  const previousDiscountBps = quote.currentVersion?.discountBps ?? 0;
  // Saving a rejected quote is the start of its revision.
  const nextStatus: QuoteStatus =
    quote.status === 'DRAFT' || quote.status === 'REJECTED' ? 'CONFIGURING' : quote.status;
  if (nextStatus !== quote.status) assertTransitionPath(actor, quote, [nextStatus]);

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
        discountBps: storedDiscountBps,
        discountReason: data.discountReason ?? null,
        grossMonthlyCents: price.grossMonthly,
        grossSetupCents: price.grossSetup,
        discountMonthlyCents: price.discountMonthly,
        mrrCents: price.mrr,
        otcCents: price.otc,
        tcvCents: price.tcv,
        effectiveDiscountBps: rateToBps(price.effectiveDiscountRate),
        createdById: actor.id,
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
      data: { currentVersionId: created.id, status: nextStatus },
    });

    await recordAudit(tx, {
      action: 'QUOTE_VERSION_CREATED',
      entity: 'QUOTE_VERSION',
      entityId: created.id,
      actorId: actor.id,
      summary: `Saved version ${created.versionNumber} — ${formatMoney(price.mrr)} per month`,
      metadata: { versionNumber: created.versionNumber, mrrCents: price.mrr },
    });

    if (nextStatus !== quote.status) {
      await recordAudit(tx, {
        action: 'QUOTE_STATUS_CHANGED',
        entity: 'QUOTE',
        entityId: quote.id,
        actorId: actor.id,
        summary: `Status changed ${describeStatus(quote.status)} → ${describeStatus(nextStatus)}`,
        metadata: { from: quote.status, to: nextStatus },
      });
    }

    if (previousDiscountBps !== storedDiscountBps) {
      await recordAudit(tx, {
        action: 'DISCOUNT_CHANGED',
        entity: 'QUOTE',
        entityId: quote.id,
        actorId: actor.id,
        summary: `Discount changed ${formatRate(bpsToRate(previousDiscountBps))} → ${formatRate(
          bpsToRate(storedDiscountBps),
        )}`,
        metadata: { fromBps: previousDiscountBps, toBps: storedDiscountBps },
      });
    }

    return created;
  });

  return outcome(
    { versionId: version.id, requiresApproval: discount.requiresApproval, mrrCents: price.mrr },
    { revalidate: [`/quotes/${quote.id}`, '/quotes'] },
  );
}

/* ==========================================================================
 * Approval
 * ======================================================================== */

export async function requestApproval(
  actor: Actor,
  input: unknown,
): Promise<ServiceOutcome<{ approvalId: string }>> {
  const data = requestApprovalSchema.parse(input);
  const quote = await loadEditableQuote(actor, data.quoteId);

  // Approval is always for the version on screen. If autosave or another tab
  // has created a newer one, approving the old figures would be meaningless.
  if (quote.currentVersionId !== data.quoteVersionId || !quote.currentVersion) {
    throw conflict('This quote has changed since it was opened. Reload it and try again.');
  }
  const version = quote.currentVersion;
  if (version.items.length === 0) {
    throw conflict('Add at least one product before requesting approval.');
  }

  // Submitting straight from configuration passes through review implicitly.
  const path: QuoteStatus[] =
    quote.status === 'CONFIGURING'
      ? ['READY_FOR_REVIEW', 'APPROVAL_REQUIRED']
      : ['APPROVAL_REQUIRED'];
  assertTransitionPath(actor, quote, path);

  const catalogue = await loadCatalogue();
  const productIds = new Set(version.items.map((item) => item.productId));

  // Re-evaluate rather than trusting what was stored: policy may have changed
  // since the version was created.
  const discount = evaluateDiscount({
    requestedBps: version.discountBps,
    role: actor.role,
    selectedProducts: catalogue.filter((product) => productIds.has(product.id)),
    tcv: cents(version.tcvCents),
  });

  if (discount.exceedsAllRoles) throw conflict(discount.explanation);
  if (!discount.requiresApproval) {
    throw conflict('This quote does not need approval — it is already within your authority.');
  }

  const requestedRate = formatRate(bpsToRate(version.discountBps));

  const { approval, approvers } = await prisma.$transaction(async (tx) => {
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
        requestedById: actor.id,
      },
    });

    await tx.quote.update({ where: { id: quote.id }, data: { status: 'APPROVAL_REQUIRED' } });

    await recordAudit(tx, {
      action: 'APPROVAL_REQUESTED',
      entity: 'QUOTE_APPROVAL',
      entityId: created.id,
      actorId: actor.id,
      summary: discount.withinAuthority
        ? `Approval requested — contract value exceeds the review threshold`
        : `Approval requested — ${requestedRate} exceeds the ${formatRate(discount.allowedRate)} threshold`,
      metadata: {
        requestedBps: version.discountBps,
        allowedBps: rateToBps(discount.allowedRate),
        versionNumber: version.versionNumber,
      },
    });

    // Only people who could actually approve this discount are told about it.
    const eligible = await eligibleApprovers(tx, version.discountBps, [actor.id, quote.ownerId]);
    for (const user of eligible) {
      await notify(tx, {
        type: 'APPROVAL_REQUESTED',
        userId: user.id,
        title: `Approval requested on ${quote.quoteNumber}`,
        body: `${actor.name} requested ${requestedRate} — ${formatMoney(cents(version.mrrCents))} per month.`,
        href: '/approvals',
      });
    }

    return { approval: created, approvers: eligible };
  });

  const emails: EmailMessage[] = approvers.map((user) =>
    approvalRequested({
      to: user.email,
      quoteNumber: quote.quoteNumber,
      customerName: quote.customer.companyName,
      requesterName: actor.name,
      requestedRate: bpsToRate(version.discountBps),
      allowedRate: discount.allowedRate,
      mrr: cents(version.mrrCents),
      tcv: cents(version.tcvCents),
      justification: data.justification,
      url: publicUrl('/approvals'),
    }),
  );

  return outcome(
    { approvalId: approval.id },
    { emails, revalidate: [`/quotes/${quote.id}`, '/quotes', '/approvals'] },
  );
}

export async function decideApproval(
  actor: Actor,
  input: unknown,
): Promise<ServiceOutcome<{ status: QuoteStatus }>> {
  const data = approvalDecisionSchema.parse(input);

  const approval = await prisma.quoteApproval.findUnique({
    where: { id: data.approvalId },
    include: {
      quote: { include: { customer: { select: { companyName: true } } } },
      requestedBy: { select: { id: true, name: true, email: true } },
    },
  });
  if (!approval) throw notFound('Approval');

  const access = await accessContext(actor, approval.quote.ownerId);

  // Two independent layers agree that nobody approves their own quote: the
  // permission check here, and the state machine below. Deliberate.
  if (!canDecideApproval(access)) {
    throw forbidden(
      actor.id === approval.quote.ownerId
        ? 'You cannot approve or reject your own quote.'
        : 'Your role does not permit approving quotes.',
    );
  }

  if (approval.decision !== 'PENDING') {
    throw conflict('This approval has already been decided.');
  }
  if (approval.quote.currentVersionId !== approval.quoteVersionId) {
    throw conflict('The quote has been revised since approval was requested.');
  }

  const requestedRate = formatRate(bpsToRate(approval.requestedDiscountBps));

  // Holding an approver role is not the same as having authority for THIS
  // discount. A manager may reject a 30% request but not approve it.
  if (
    data.decision === 'APPROVED' &&
    !canApproveDiscount(actor.role, approval.requestedDiscountBps)
  ) {
    throw forbidden(
      `${requestedRate} is above your approval authority. A Pricing Administrator must approve it.`,
    );
  }

  const nextStatus: QuoteStatus = data.decision === 'APPROVED' ? 'APPROVED' : 'REJECTED';
  assertTransitionPath(actor, approval.quote, [nextStatus]);

  const decisionNote = data.decision === 'REJECTED' ? data.decisionNote : null;

  await prisma.$transaction(async (tx) => {
    // Conditional update: if two approvers click at once, only one decision
    // lands; the other sees zero rows and is told it was already decided.
    const updated = await tx.quoteApproval.updateMany({
      where: { id: approval.id, decision: 'PENDING' },
      data: {
        decision: data.decision,
        decidedById: actor.id,
        decidedAt: new Date(),
        decisionNote,
      },
    });
    if (updated.count === 0) throw conflict('This approval has already been decided.');

    await tx.quote.update({
      where: { id: approval.quoteId },
      data: {
        status: nextStatus,
        ...(nextStatus === 'APPROVED'
          ? { validUntil: new Date(Date.now() + QUOTE_VALIDITY_DAYS * DAY_MS) }
          : {}),
      },
    });

    await recordAudit(tx, {
      action: nextStatus === 'APPROVED' ? 'APPROVAL_GRANTED' : 'APPROVAL_REJECTED',
      entity: 'QUOTE_APPROVAL',
      entityId: approval.id,
      actorId: actor.id,
      summary:
        nextStatus === 'APPROVED'
          ? `Approved ${requestedRate} discount`
          : `Rejected ${requestedRate} discount`,
      metadata: { requestedBps: approval.requestedDiscountBps },
    });

    await notify(tx, {
      type: nextStatus === 'APPROVED' ? 'APPROVAL_GRANTED' : 'APPROVAL_REJECTED',
      userId: approval.requestedById,
      title: `${approval.quote.quoteNumber} ${nextStatus === 'APPROVED' ? 'approved' : 'rejected'}`,
      body:
        nextStatus === 'APPROVED'
          ? `${actor.name} approved your ${requestedRate} discount.`
          : `${actor.name} rejected your discount: ${decisionNote ?? ''}`,
      href: `/quotes/${approval.quoteId}`,
    });
  });

  const emailInput = {
    to: approval.requestedBy.email,
    quoteNumber: approval.quote.quoteNumber,
    customerName: approval.quote.customer.companyName,
    approverName: actor.name,
    rate: bpsToRate(approval.requestedDiscountBps),
    note: decisionNote,
    url: publicUrl(`/quotes/${approval.quoteId}`),
  };

  return outcome(
    { status: nextStatus },
    {
      emails: [
        nextStatus === 'APPROVED' ? approvalGranted(emailInput) : approvalRejected(emailInput),
      ],
      revalidate: ['/approvals', '/quotes', `/quotes/${approval.quoteId}`],
    },
  );
}

/* ==========================================================================
 * Status transitions
 * ======================================================================== */

/**
 * Targets that have their own service because they carry more than a status:
 * an approval record, a justification, a decision note.
 */
const DEDICATED_TRANSITIONS: Partial<Record<QuoteStatus, string>> = {
  APPROVAL_REQUIRED: 'Use "Send for approval" so the request reaches an approver.',
  REJECTED: 'Rejections are recorded from the approval queue.',
};

export async function transitionQuoteStatus(
  actor: Actor,
  input: unknown,
): Promise<ServiceOutcome<{ status: QuoteStatus }>> {
  const data = quoteStatusTransitionSchema.parse(input);

  const quote = await prisma.quote.findUnique({
    where: { id: data.quoteId },
    include: {
      owner: { select: { id: true, name: true, role: true } },
      customer: { select: { companyName: true, email: true } },
      location: { select: { contactName: true, contactEmail: true } },
      currentVersion: { include: { items: { select: { productId: true } } } },
    },
  });
  if (!quote) throw notFound('Quote');

  const access = await accessContext(actor, quote.ownerId);
  if (!canReadQuote(access)) throw notFound('Quote');

  const to = data.toStatus;
  const dedicated = DEDICATED_TRANSITIONS[to];
  if (dedicated) throw conflict(dedicated);

  const isReviewApproval = to === 'APPROVED';
  if (isReviewApproval) {
    if (quote.status === 'APPROVAL_REQUIRED') {
      throw conflict(
        'This quote has a pending approval request. Decide it from the approval queue.',
      );
    }
    if (!canDecideApproval(access)) {
      throw forbidden(
        actor.id === quote.ownerId
          ? 'You cannot approve your own quote.'
          : 'Your role does not permit approving quotes.',
      );
    }
  } else if (!canEditQuote(access)) {
    throw forbidden('You do not have permission to modify this quote.');
  }

  // The state machine is the authority. A client asking for an arbitrary
  // status change is answered here, not by trusting the request (§18).
  assertTransitionPath(actor, quote, [to]);

  const version = quote.currentVersion;
  const needsPricedVersion =
    to === 'READY_FOR_REVIEW' || to === 'APPROVED' || to === 'SENT_TO_CUSTOMER';
  if (needsPricedVersion && (!version || version.items.length === 0)) {
    throw conflict('Configure and save at least one product first.');
  }

  if (isReviewApproval && version) {
    // Signing off review is not a way around escalation: if the owner could
    // not grant this discount alone, it needs a formal approval request.
    const catalogue = await loadCatalogue();
    const productIds = new Set(version.items.map((item) => item.productId));
    const evaluation = evaluateDiscount({
      requestedBps: version.discountBps,
      role: quote.owner.role as Role,
      selectedProducts: catalogue.filter((product) => productIds.has(product.id)),
      tcv: cents(version.tcvCents),
    });
    if (evaluation.requiresApproval || evaluation.exceedsAllRoles) {
      throw conflict(
        'This quote exceeds its owner’s authority and needs a formal approval request.',
      );
    }
  }

  if (to === 'SENT_TO_CUSTOMER' && quote.validUntil && quote.validUntil.getTime() < Date.now()) {
    throw conflict('The approval validity period has lapsed. Mark the quote expired or revise it.');
  }

  const now = new Date();
  const validUntil =
    to === 'APPROVED' ? new Date(now.getTime() + QUOTE_VALIDITY_DAYS * DAY_MS) : quote.validUntil;

  await prisma.$transaction(async (tx) => {
    if (quote.status === 'APPROVAL_REQUIRED') {
      await withdrawPendingApprovals(tx, actor, quote.id);
    }

    await tx.quote.update({
      where: { id: quote.id },
      data: {
        status: to,
        ...(to === 'APPROVED' ? { validUntil } : {}),
        ...(to === 'SENT_TO_CUSTOMER' ? { sentAt: now } : {}),
        ...(to === 'ACCEPTED' ? { acceptedAt: now } : {}),
      },
    });

    await recordAudit(tx, {
      action: to === 'SENT_TO_CUSTOMER' ? 'QUOTE_SENT' : 'QUOTE_STATUS_CHANGED',
      entity: 'QUOTE',
      entityId: quote.id,
      actorId: actor.id,
      summary: `Status changed ${describeStatus(quote.status)} → ${describeStatus(to)}${
        data.note ? ` — ${data.note}` : ''
      }`,
      metadata: { from: quote.status, to, ...(data.note ? { note: data.note } : {}) },
    });

    if (to === 'ACCEPTED' && actor.id !== quote.ownerId) {
      await notify(tx, {
        type: 'QUOTE_ACCEPTED',
        userId: quote.ownerId,
        title: `${quote.quoteNumber} accepted`,
        body: `${quote.customer.companyName} accepted the quote.`,
        href: `/quotes/${quote.id}`,
      });
    }
  });

  const emails: EmailMessage[] = [];
  if (to === 'SENT_TO_CUSTOMER' && version) {
    const contact = customerContact(quote);
    const expiry = validUntil ?? new Date(now.getTime() + QUOTE_VALIDITY_DAYS * DAY_MS);
    const token = createDocumentToken({
      quoteId: quote.id,
      versionId: version.id,
      exp: Math.floor(expiry.getTime() / 1000),
    });

    emails.push(
      quoteSent({
        to: contact.email,
        contactName: contact.name,
        customerName: quote.customer.companyName,
        quoteNumber: quote.quoteNumber,
        mrr: cents(version.mrrCents),
        otc: cents(version.otcCents),
        tcv: cents(version.tcvCents),
        contractMonths: version.contractMonths,
        validUntil,
        representativeName: quote.owner.name,
        documentUrl: publicUrl(`/quotes/${quote.id}/document?token=${encodeURIComponent(token)}`),
      }),
    );
  }

  return outcome(
    { status: to },
    { emails, revalidate: [`/quotes/${quote.id}`, '/quotes', '/approvals'] },
  );
}

/* ==========================================================================
 * Versioning
 * ======================================================================== */

/**
 * Create a new revision from an existing version.
 *
 * The source version is copied, never mutated: restoring an old version adds a
 * new one on top rather than rewinding history, so the trail of what was
 * offered and when stays intact (§17). The copy re-enters configuration, so any
 * approval has to be obtained again for the figures it carries.
 */
export async function createRevisionFrom(
  actor: Actor,
  input: unknown,
): Promise<ServiceOutcome<{ versionId: string; versionNumber: number }>> {
  const data = createRevisionSchema.parse(input);
  const quote = await loadEditableQuote(actor, data.quoteId);

  const source = await prisma.quoteVersion.findUnique({
    where: { id: data.sourceVersionId },
    include: { items: true },
  });
  if (!source || source.quoteId !== quote.id) throw notFound('Quote version');

  if (quote.status !== 'CONFIGURING') assertTransitionPath(actor, quote, ['CONFIGURING']);

  const created = await prisma.$transaction(async (tx) => {
    if (quote.status === 'APPROVAL_REQUIRED') {
      await withdrawPendingApprovals(tx, actor, quote.id);
    }

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
        configSnapshot: source.configSnapshot ?? Prisma.JsonNull,
        createdById: actor.id,
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
      data: { currentVersionId: version.id, status: 'CONFIGURING', validUntil: null },
    });

    await recordAudit(tx, {
      action: 'QUOTE_VERSION_RESTORED',
      entity: 'QUOTE_VERSION',
      entityId: version.id,
      actorId: actor.id,
      summary: `Created version ${version.versionNumber} from version ${source.versionNumber}`,
      metadata: { fromVersion: source.versionNumber, toVersion: version.versionNumber },
    });

    return version;
  });

  return outcome(
    { versionId: created.id, versionNumber: created.versionNumber },
    { revalidate: [`/quotes/${quote.id}`, '/quotes', '/approvals'] },
  );
}
