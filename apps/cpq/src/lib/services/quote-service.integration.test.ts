import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@nexora/db';
import type { Actor } from '@nexora/auth/session';
import { type ErrorCode, isAppError } from '@nexora/observability';
import { EmailTemplateId } from '@nexora/email';

import {
  USERS,
  acmeMunich,
  actorFor,
  bundleSelections,
  foreignLocation,
} from '@/test/fixtures';
import { verifyDocumentToken } from './document-link';
import {
  createQuote,
  createRevisionFrom,
  decideApproval,
  requestApproval,
  saveConfiguration,
  transitionQuoteStatus,
} from './quote-service';

/**
 * The quote workflow, end to end at the service layer, against real PostgreSQL.
 *
 * These are the rules a unit test of the engine cannot prove: that the server
 * ignores prices from the client, that authorization is enforced on rows the
 * actor does not own, that history is append-only, and that the state machine
 * holds when driven through the same code the server actions call.
 */

async function expectAppError(promise: Promise<unknown>, code: ErrorCode) {
  const error = await promise.then(
    () => null,
    (thrown: unknown) => thrown,
  );
  expect(isAppError(error), `expected an AppError ${code}, got ${String(error)}`).toBe(true);
  if (isAppError(error)) expect(error.code).toBe(code);
}

let rep: Actor;
let otherRep: Actor;
let manager: Actor;

beforeAll(async () => {
  [rep, otherRep, manager] = await Promise.all([
    actorFor(USERS.rep),
    actorFor(USERS.otherRep),
    actorFor(USERS.manager),
  ]);
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** A fresh ACME quote owned by the rep, configured at `discountBps`. */
async function configuredQuote(discountBps: number) {
  const { customer, location } = await acmeMunich();
  const created = await createQuote(rep, {
    customerId: customer.id,
    locationId: location.id,
    title: `Integration ${discountBps}bps`,
  });
  const saved = await saveConfiguration(rep, {
    quoteId: created.data.quoteId,
    selections: await bundleSelections(),
    contractMonths: 36,
    siteCount: 1,
    requestedDiscountBps: discountBps,
    discountReason: discountBps > 0 ? 'Competitive tender against the incumbent carrier.' : undefined,
  });
  return { quoteId: created.data.quoteId, versionId: saved.data.versionId, saved };
}

describe('creating quotes', () => {
  it('rejects a location that belongs to a different customer', async () => {
    const { customer } = await acmeMunich();
    const location = await foreignLocation(customer.id);

    await expectAppError(
      createQuote(rep, { customerId: customer.id, locationId: location.id }),
      'NOT_FOUND',
    );
  });

  it('assigns sequential quote numbers and audits the creation', async () => {
    const { customer } = await acmeMunich();
    const first = await createQuote(rep, { customerId: customer.id });
    const second = await createQuote(rep, { customerId: customer.id });

    const number = (value: string) => Number.parseInt(value.replace('QT-', ''), 10);
    expect(number(second.data.quoteNumber)).toBe(number(first.data.quoteNumber) + 1);

    const audit = await prisma.auditEvent.findFirst({
      where: { entityId: first.data.quoteId, action: 'QUOTE_CREATED' },
    });
    expect(audit?.actorId).toBe(rep.id);
  });
});

describe('server-authoritative pricing', () => {
  it('ignores any price sent by the client and recomputes from the catalogue', async () => {
    const { quoteId, saved } = await configuredQuote(800);

    const tampered = await saveConfiguration(rep, {
      quoteId,
      selections: await bundleSelections(),
      contractMonths: 36,
      siteCount: 1,
      requestedDiscountBps: 800,
      discountReason: 'Competitive tender against the incumbent carrier.',
      // Not part of the schema: stripped by Zod before anything reads it.
      mrrCents: 1,
      tcvCents: 1,
    });

    expect(tampered.data.mrrCents).toBe(saved.data.mrrCents);
    expect(tampered.data.mrrCents).toBeGreaterThan(100_000);
  });

  it('stores a discount beyond every role’s authority clamped to the absolute maximum', async () => {
    const { versionId } = await configuredQuote(9_900);
    const version = await prisma.quoteVersion.findUniqueOrThrow({ where: { id: versionId } });

    expect(version.discountBps).toBe(3_500);
  });

  it('lowers MRR as the discount rises', async () => {
    const low = await configuredQuote(800);
    const high = await configuredQuote(1_800);

    expect(high.saved.data.mrrCents).toBeLessThan(low.saved.data.mrrCents);
    expect(high.saved.data.requiresApproval).toBe(true);
    expect(low.saved.data.requiresApproval).toBe(false);
  });
});

describe('authorization', () => {
  it('hides another rep’s quote as not-found rather than forbidden', async () => {
    const { quoteId, versionId } = await configuredQuote(0);

    await expectAppError(
      transitionQuoteStatus(otherRep, { quoteId, toStatus: 'CANCELLED' }),
      'NOT_FOUND',
    );
    await expectAppError(
      createRevisionFrom(otherRep, { quoteId, sourceVersionId: versionId }),
      'NOT_FOUND',
    );
  });

  it('refuses a transition the state machine does not allow', async () => {
    const { quoteId } = await configuredQuote(0);

    await expectAppError(
      transitionQuoteStatus(rep, { quoteId, toStatus: 'SENT_TO_CUSTOMER' }),
      'INVALID_TRANSITION',
    );
  });

  it('refuses to approve a quote in review when its discount needs escalation', async () => {
    const { quoteId } = await configuredQuote(1_800);
    await transitionQuoteStatus(rep, { quoteId, toStatus: 'READY_FOR_REVIEW' });

    await expectAppError(
      transitionQuoteStatus(manager, { quoteId, toStatus: 'APPROVED' }),
      'CONFLICT',
    );
  });
});

describe('approval workflow', () => {
  it('runs request → approve → send, emailing each party once', async () => {
    const { quoteId, versionId } = await configuredQuote(1_800);

    await expectAppError(
      requestApproval(rep, { quoteId, quoteVersionId: 'c' + 'x'.repeat(24), justification: 'Stale version id here.' }),
      'CONFLICT',
    );

    const requested = await requestApproval(rep, {
      quoteId,
      quoteVersionId: versionId,
      justification: 'Three-year commitment with a competing offer on the table.',
    });

    const afterRequest = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId } });
    expect(afterRequest.status).toBe('APPROVAL_REQUIRED');
    expect(requested.emails.map((email) => email.to)).toContain(USERS.manager);
    expect(requested.emails.map((email) => email.to)).not.toContain(USERS.rep);
    expect(requested.emails.every((email) => email.template === EmailTemplateId.APPROVAL_REQUESTED)).toBe(true);

    await expectAppError(
      decideApproval(rep, { approvalId: requested.data.approvalId, decision: 'APPROVED' }),
      'FORBIDDEN',
    );

    const decided = await decideApproval(manager, {
      approvalId: requested.data.approvalId,
      decision: 'APPROVED',
    });
    expect(decided.data.status).toBe('APPROVED');
    expect(decided.emails).toHaveLength(1);
    expect(decided.emails[0]?.to).toBe(USERS.rep);

    const approved = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId } });
    expect(approved.validUntil).not.toBeNull();

    await expectAppError(
      decideApproval(manager, { approvalId: requested.data.approvalId, decision: 'APPROVED' }),
      'CONFLICT',
    );

    const sent = await transitionQuoteStatus(rep, { quoteId, toStatus: 'SENT_TO_CUSTOMER' });
    expect(sent.emails).toHaveLength(1);
    const email = sent.emails[0];
    expect(email?.template).toBe(EmailTemplateId.QUOTE_SENT);

    const { location } = await acmeMunich();
    expect(email?.to).toBe(location.contactEmail);

    const link = /\/quotes\/[^/]+\/document\?token=([^\s"<]+)/.exec(email?.text ?? '');
    expect(link).not.toBeNull();
    const claims = verifyDocumentToken(decodeURIComponent(link?.[1] ?? ''));
    expect(claims).toMatchObject({ quoteId, versionId });

    const audit = await prisma.auditEvent.findFirst({ where: { entityId: quoteId, action: 'QUOTE_SENT' } });
    expect(audit).not.toBeNull();
  });

  it('lets a manager reject but not approve a discount above their authority', async () => {
    const { quoteId, versionId } = await configuredQuote(2_600);
    const requested = await requestApproval(rep, {
      quoteId,
      quoteVersionId: versionId,
      justification: 'Strategic logo; board-level relationship with the customer.',
    });

    // Only approvers who can grant 26% are notified.
    expect(requested.emails.map((email) => email.to)).not.toContain(USERS.manager);
    expect(requested.emails.map((email) => email.to)).toContain(USERS.pricingAdmin);

    await expectAppError(
      decideApproval(manager, { approvalId: requested.data.approvalId, decision: 'APPROVED' }),
      'FORBIDDEN',
    );

    const rejected = await decideApproval(manager, {
      approvalId: requested.data.approvalId,
      decision: 'REJECTED',
      decisionNote: 'Margin falls below the floor for this segment.',
    });
    expect(rejected.data.status).toBe('REJECTED');
    expect(rejected.emails[0]?.template).toBe(EmailTemplateId.APPROVAL_REJECTED);

    // Saving a new configuration is how a rejected quote is revised.
    const revised = await saveConfiguration(rep, {
      quoteId,
      selections: await bundleSelections(),
      contractMonths: 36,
      siteCount: 1,
      requestedDiscountBps: 1_500,
      discountReason: 'Reduced following pricing feedback.',
    });
    const quote = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId } });
    expect(quote.status).toBe('CONFIGURING');
    expect(quote.currentVersionId).toBe(revised.data.versionId);
  });

  it('withdraws a pending approval when the quote is pulled back', async () => {
    const { quoteId, versionId } = await configuredQuote(1_800);
    const requested = await requestApproval(rep, {
      quoteId,
      quoteVersionId: versionId,
      justification: 'Needs sign-off before the customer meeting.',
    });

    await transitionQuoteStatus(rep, { quoteId, toStatus: 'CONFIGURING' });

    const approval = await prisma.quoteApproval.findUniqueOrThrow({
      where: { id: requested.data.approvalId },
    });
    expect(approval.decision).toBe('WITHDRAWN');
  });
});

describe('versioning', () => {
  it('creates a revision without modifying the version it copies', async () => {
    const { quoteId, versionId } = await configuredQuote(800);
    const second = await saveConfiguration(rep, {
      quoteId,
      selections: await bundleSelections(),
      contractMonths: 60,
      siteCount: 1,
      requestedDiscountBps: 500,
      discountReason: 'Longer term, smaller headline discount.',
    });

    const before = await prisma.quoteVersion.findUniqueOrThrow({
      where: { id: versionId },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });

    const revision = await createRevisionFrom(rep, { quoteId, sourceVersionId: versionId });

    const after = await prisma.quoteVersion.findUniqueOrThrow({
      where: { id: versionId },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    expect(after).toEqual(before);

    const copy = await prisma.quoteVersion.findUniqueOrThrow({ where: { id: revision.data.versionId } });
    expect(copy.versionNumber).toBe(3);
    expect(copy.mrrCents).toBe(before.mrrCents);
    expect(copy.contractMonths).toBe(before.contractMonths);

    const superseded = await prisma.quoteVersion.findUniqueOrThrow({ where: { id: second.data.versionId } });
    expect(superseded.supersededAt).not.toBeNull();

    const quote = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId } });
    expect(quote.currentVersionId).toBe(revision.data.versionId);
  });
});
