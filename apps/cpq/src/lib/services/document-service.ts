import 'server-only';

import { createHash } from 'node:crypto';
import { renderToBuffer } from '@react-pdf/renderer';
import { prisma } from '@nexora/db';
import { canReadQuote } from '@nexora/auth/permissions';
import { teamIdsFor } from '@nexora/auth/scope';
import type { Actor } from '@nexora/auth/session';
import type { ContractTerm, QuoteStatus } from '@nexora/types';
import { evaluateConfiguration, isEditable } from '@nexora/cpq-engine';
import { AppError, ErrorCode, logger, notFound } from '@nexora/observability';

import { loadCatalogue, loadRules } from '../catalogue';
import { recordAudit } from '../audit';
import {
  type QuoteDocumentModel,
  isBindingOffer,
  pricingIntegrityIssues,
} from '../documents/document-model';
import { QuoteDocument } from '../documents/quote-document';
import { verifyDocumentToken } from './document-link';

/**
 * Quote document generation.
 *
 * Five steps, each doing real work, which is why the progress stream exists at
 * all: the pricing integrity check, re-validation against the current rule set
 * and PDF layout together take long enough on a cold serverless function that
 * a silent spinner reads as broken.
 */

export const DOCUMENT_STEPS = [
  { id: 'prepare', label: 'Preparing quote' },
  { id: 'pricing', label: 'Calculating pricing' },
  { id: 'validate', label: 'Validating configuration' },
  { id: 'render', label: 'Generating document' },
  { id: 'finalize', label: 'Finalizing quote' },
] as const;

export type DocumentStepId = (typeof DOCUMENT_STEPS)[number]['id'];

export type DocumentAccess =
  | { readonly kind: 'actor'; readonly actor: Actor; readonly versionId?: string }
  /** A customer following the signed link from their quote email. */
  | { readonly kind: 'token'; readonly token: string };

export interface GeneratedDocument {
  readonly fileName: string;
  readonly bytes: Buffer;
  readonly sha256: string;
  readonly quoteNumber: string;
  readonly versionNumber: number;
}

type StepListener = (step: DocumentStepId) => void;

interface SnapshotDiscount {
  readonly label: string;
  readonly rate: number;
  readonly amountCents: number;
}

/** Read discounts from a version's frozen snapshot, tolerating older shapes. */
function snapshotDiscounts(snapshot: unknown): SnapshotDiscount[] {
  if (typeof snapshot !== 'object' || snapshot === null) return [];
  const discounts = (snapshot as { discounts?: unknown }).discounts;
  if (!Array.isArray(discounts)) return [];

  return discounts.flatMap((entry: unknown) => {
    if (typeof entry !== 'object' || entry === null) return [];
    const { label, rate, amountCents } = entry as Record<string, unknown>;
    return typeof label === 'string' && typeof rate === 'number' && typeof amountCents === 'number'
      ? [{ label, rate, amountCents }]
      : [];
  });
}

function snapshotSiteCount(snapshot: unknown): number {
  if (typeof snapshot !== 'object' || snapshot === null) return 1;
  const value = (snapshot as { siteCount?: unknown }).siteCount;
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : 1;
}

/** Resolve which quote version the caller may render. */
async function resolveVersion(access: DocumentAccess, quoteId: string) {
  if (access.kind === 'token') {
    const claims = verifyDocumentToken(access.token);
    // A bad, expired or mismatched token is indistinguishable from a missing quote.
    if (!claims || claims.quoteId !== quoteId) throw notFound('Quote document');
    return { versionId: claims.versionId, actorId: null };
  }

  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    select: { ownerId: true, currentVersionId: true },
  });
  if (!quote) throw notFound('Quote');

  const visible = canReadQuote({
    actorId: access.actor.id,
    actorRole: access.actor.role,
    quoteOwnerId: quote.ownerId,
    teamMemberIds: await teamIdsFor(access.actor),
  });
  if (!visible) throw notFound('Quote');

  const versionId = access.versionId ?? quote.currentVersionId;
  if (!versionId) {
    throw new AppError(
      ErrorCode.CONFLICT,
      'Configure and save the quote before generating a document.',
    );
  }
  return { versionId, actorId: access.actor.id };
}

export async function generateQuoteDocument(
  access: DocumentAccess,
  quoteId: string,
  onStep: StepListener = () => undefined,
): Promise<GeneratedDocument> {
  /* 1. Prepare ----------------------------------------------------------- */
  onStep('prepare');
  const { versionId, actorId } = await resolveVersion(access, quoteId);

  const version = await prisma.quoteVersion.findUnique({
    where: { id: versionId },
    include: {
      items: { orderBy: { sortOrder: 'asc' } },
      quote: {
        include: {
          customer: true,
          location: true,
          owner: { select: { name: true, email: true } },
        },
      },
      approvals: {
        where: { decision: 'APPROVED' },
        orderBy: { decidedAt: 'desc' },
        take: 1,
        include: { decidedBy: { select: { name: true } } },
      },
    },
  });
  // The version must belong to the quote in the URL — a version id from
  // another quote is not a way to read that quote.
  if (!version || version.quoteId !== quoteId) throw notFound('Quote version');
  if (version.items.length === 0) {
    throw new AppError(ErrorCode.CONFLICT, 'This version has no products to put in a document.');
  }

  const { quote } = version;

  /* 2. Pricing ----------------------------------------------------------- */
  onStep('pricing');
  const issues = pricingIntegrityIssues(version);
  if (issues.length > 0) {
    logger.error('quote document pricing integrity failure', { quoteId, versionId, issues });
    throw new AppError(
      ErrorCode.CONFLICT,
      'The stored pricing for this version failed an integrity check, so no document was produced.',
    );
  }

  /* 3. Validate ---------------------------------------------------------- */
  onStep('validate');
  const [catalogue, rules] = await Promise.all([loadCatalogue(), loadRules()]);
  const validation = evaluateConfiguration(
    {
      selections: version.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
      contractMonths: version.contractMonths as ContractTerm,
      serviceability: quote.location?.serviceability ?? 'PENDING_CHECK',
      siteCount: snapshotSiteCount(version.configSnapshot),
    },
    catalogue,
    rules,
  );
  const blocking = validation.findings.filter((finding) => finding.blocking);
  if (blocking.length > 0) {
    // A quote still being worked on must be valid today. One already approved
    // or sent is a record of what was offered, and stays reproducible even if
    // the rules or catalogue have moved on since.
    if (isEditable(quote.status as QuoteStatus)) {
      throw new AppError(
        ErrorCode.VALIDATION,
        `The configuration is not valid: ${blocking[0]?.message ?? 'resolve the listed errors first.'}`,
      );
    }
    logger.warn('document generated for a version that no longer validates', {
      quoteId,
      versionId,
      findings: blocking.map((finding) => finding.ruleId),
    });
  }

  /* 4. Render ------------------------------------------------------------ */
  onStep('render');
  const status = quote.status as QuoteStatus;
  const approvedBy = version.approvals[0];

  const model: QuoteDocumentModel = {
    quoteNumber: quote.quoteNumber,
    title: quote.title,
    status,
    versionNumber: version.versionNumber,
    issuedAt: quote.sentAt ?? new Date(),
    validUntil: quote.validUntil,
    customer: {
      companyName: quote.customer.companyName,
      legalName: quote.customer.legalName,
      vatNumber: quote.customer.vatNumber,
      email: quote.customer.email,
      phone: quote.customer.phone,
    },
    site: quote.location
      ? {
          name: quote.location.name,
          addressLines: [
            quote.location.addressLine1,
            ...(quote.location.addressLine2 ? [quote.location.addressLine2] : []),
            `${quote.location.postalCode} ${quote.location.city}`,
          ],
          contactName: quote.location.contactName,
          contactEmail: quote.location.contactEmail,
          contactPhone: quote.location.contactPhone,
        }
      : null,
    representative: { name: quote.owner.name, email: quote.owner.email },
    contractMonths: version.contractMonths,
    effectiveDiscountBps: version.effectiveDiscountBps,
    lines: version.items.map((item) => ({
      sku: item.skuSnapshot,
      name: item.nameSnapshot,
      quantity: item.quantity,
      unitMonthlyCents: item.unitMonthlyCents,
      unitSetupCents: item.unitSetupCents,
      monthlyCents: item.monthlyCents,
      setupCents: item.setupCents,
    })),
    discounts: snapshotDiscounts(version.configSnapshot),
    totals: {
      grossMonthlyCents: version.grossMonthlyCents,
      discountMonthlyCents: version.discountMonthlyCents,
      mrrCents: version.mrrCents,
      otcCents: version.otcCents,
      tcvCents: version.tcvCents,
    },
    approval:
      approvedBy?.decidedAt && approvedBy.decidedBy
        ? {
            kind: 'APPROVED',
            approverName: approvedBy.decidedBy.name,
            decidedAt: approvedBy.decidedAt,
            discountBps: approvedBy.requestedDiscountBps,
          }
        : status === 'APPROVAL_REQUIRED'
          ? { kind: 'PENDING' }
          : isBindingOffer(status)
            ? { kind: 'WITHIN_AUTHORITY' }
            : { kind: 'NOT_APPROVED' },
  };

  // QuoteDocument is a plain function component with no hooks, so calling it
  // yields the <Document> element renderToBuffer expects.
  const bytes = await renderToBuffer(QuoteDocument({ model }));

  /* 5. Finalize ---------------------------------------------------------- */
  onStep('finalize');
  const sha256 = createHash('sha256').update(bytes).digest('hex');

  await recordAudit(prisma, {
    action: 'QUOTE_DOCUMENT_GENERATED',
    entity: 'QUOTE_VERSION',
    entityId: version.id,
    actorId,
    summary:
      access.kind === 'token'
        ? `Customer opened the quote document for version ${version.versionNumber}`
        : `Generated quote document for version ${version.versionNumber}`,
    metadata: {
      versionNumber: version.versionNumber,
      sha256,
      bytes: bytes.length,
      via: access.kind,
    },
  });

  return {
    fileName: `${quote.quoteNumber}-v${version.versionNumber}.pdf`,
    bytes,
    sha256,
    quoteNumber: quote.quoteNumber,
    versionNumber: version.versionNumber,
  };
}
