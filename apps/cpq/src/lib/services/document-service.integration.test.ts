import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@nexora/db';
import type { Actor } from '@nexora/auth/session';
import { isAppError } from '@nexora/observability';

import { USERS, acmeMunich, actorFor, bundleSelections } from '@/test/fixtures';
import { createDocumentToken } from './document-link';
import { DOCUMENT_STEPS, generateQuoteDocument } from './document-service';
import { createQuote, saveConfiguration } from './quote-service';

let rep: Actor;
let otherRep: Actor;
let quoteId: string;
let versionId: string;

beforeAll(async () => {
  [rep, otherRep] = await Promise.all([actorFor(USERS.rep), actorFor(USERS.otherRep)]);
  const { customer, location } = await acmeMunich();
  const created = await createQuote(rep, { customerId: customer.id, locationId: location.id });
  const saved = await saveConfiguration(rep, {
    quoteId: created.data.quoteId,
    selections: await bundleSelections(),
    contractMonths: 36,
    siteCount: 1,
    requestedDiscountBps: 500,
    discountReason: 'Multi-site roll-out planned next year.',
  });
  quoteId = created.data.quoteId;
  versionId = saved.data.versionId;
});

afterAll(async () => {
  await prisma.$disconnect();
});

const inAnHour = () => Math.floor(Date.now() / 1000) + 3600;

describe('quote document generation', () => {
  it('reports every step in order and produces an audited PDF', async () => {
    const steps: string[] = [];
    const document = await generateQuoteDocument({ kind: 'actor', actor: rep }, quoteId, (step) =>
      steps.push(step),
    );

    expect(steps).toEqual(DOCUMENT_STEPS.map((step) => step.id));
    expect(document.bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(document.fileName).toMatch(/^QT-\d+-v1\.pdf$/);

    const audit = await prisma.auditEvent.findFirst({
      where: { entityId: versionId, action: 'QUOTE_DOCUMENT_GENERATED' },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit?.actorId).toBe(rep.id);
    expect(audit?.metadata).toMatchObject({ sha256: document.sha256, via: 'actor' });
  });

  it('hides the document from a user who cannot read the quote', async () => {
    const error = await generateQuoteDocument({ kind: 'actor', actor: otherRep }, quoteId).catch(
      (thrown: unknown) => thrown,
    );
    expect(isAppError(error, 'NOT_FOUND')).toBe(true);
  });

  it('serves a signed customer link without a session', async () => {
    const token = createDocumentToken({ quoteId, versionId, exp: inAnHour() });
    const document = await generateQuoteDocument({ kind: 'token', token }, quoteId);

    expect(document.versionNumber).toBe(1);
  });

  it('refuses a token for one quote used against another', async () => {
    const { customer } = await acmeMunich();
    const other = await createQuote(rep, { customerId: customer.id });
    const token = createDocumentToken({ quoteId, versionId, exp: inAnHour() });

    const error = await generateQuoteDocument({ kind: 'token', token }, other.data.quoteId).catch(
      (thrown: unknown) => thrown,
    );
    expect(isAppError(error, 'NOT_FOUND')).toBe(true);
  });

  it('refuses an expired token', async () => {
    const token = createDocumentToken({
      quoteId,
      versionId,
      exp: Math.floor(Date.now() / 1000) - 1,
    });
    const error = await generateQuoteDocument({ kind: 'token', token }, quoteId).catch(
      (thrown: unknown) => thrown,
    );
    expect(isAppError(error, 'NOT_FOUND')).toBe(true);
  });
});
