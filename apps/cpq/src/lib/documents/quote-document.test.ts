import { writeFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { renderToBuffer } from '@react-pdf/renderer';

import { type QuoteDocumentModel, isBindingOffer, pricingIntegrityIssues } from './document-model';
import { QuoteDocument } from './quote-document';

const consistent = {
  contractMonths: 36,
  grossMonthlyCents: 100_000,
  grossSetupCents: 50_000,
  discountMonthlyCents: 18_000,
  mrrCents: 82_000,
  otcCents: 50_000,
  tcvCents: 82_000 * 36 + 50_000,
  items: [
    { monthlyCents: 60_000, setupCents: 50_000 },
    { monthlyCents: 40_000, setupCents: 0 },
  ],
};

describe('pricing integrity', () => {
  it('accepts totals that add up', () => {
    expect(pricingIntegrityIssues(consistent)).toEqual([]);
  });

  it('flags every inconsistency it finds', () => {
    const issues = pricingIntegrityIssues({
      ...consistent,
      mrrCents: 82_001,
      items: [{ monthlyCents: 1, setupCents: 0 }],
    });
    expect(issues).toHaveLength(4);
  });
});

describe('binding offers', () => {
  it('treats only approved, sent and accepted quotes as offers', () => {
    expect(isBindingOffer('APPROVED')).toBe(true);
    expect(isBindingOffer('SENT_TO_CUSTOMER')).toBe(true);
    expect(isBindingOffer('ACCEPTED')).toBe(true);
    expect(isBindingOffer('CONFIGURING')).toBe(false);
    expect(isBindingOffer('APPROVAL_REQUIRED')).toBe(false);
  });
});

describe('quote document', () => {
  const model: QuoteDocumentModel = {
    quoteNumber: 'QT-10482',
    title: 'Enterprise WAN refresh',
    status: 'APPROVED',
    versionNumber: 3,
    issuedAt: new Date('2026-09-16T09:00:00Z'),
    validUntil: new Date('2026-10-16T09:00:00Z'),
    customer: {
      companyName: 'ACME GmbH',
      legalName: 'ACME Industrieanlagen GmbH',
      vatNumber: 'DE811234567',
      email: 'it@acme-gmbh.demo',
      phone: '+49 89 1200 4400',
    },
    site: {
      name: 'Munich HQ',
      addressLines: ['Leopoldstraße 128', '80802 München'],
      contactName: 'Klaus Berger',
      contactEmail: 'k.berger@acme-gmbh.demo',
      contactPhone: null,
    },
    representative: { name: 'John Smith', email: 'sales@nexora.demo' },
    contractMonths: 36,
    effectiveDiscountBps: 1800,
    lines: [
      {
        sku: 'FIB-10G',
        name: 'Business Fibre 10 Gbps',
        quantity: 1,
        unitMonthlyCents: 100_000,
        unitSetupCents: 50_000,
        monthlyCents: 100_000,
        setupCents: 50_000,
      },
    ],
    discounts: [{ label: 'Negotiated discount', rate: 0.18, amountCents: 18_000 }],
    totals: {
      grossMonthlyCents: 100_000,
      discountMonthlyCents: 18_000,
      mrrCents: 82_000,
      otcCents: 50_000,
      tcvCents: 2_002_000,
    },
    approval: {
      kind: 'APPROVED',
      approverName: 'Sarah Klein',
      decidedAt: new Date('2026-09-15T12:00:00Z'),
      discountBps: 1800,
    },
  };

  it('renders a valid PDF', async () => {
    const bytes = await renderToBuffer(QuoteDocument({ model }));

    expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(bytes.length).toBeGreaterThan(2_000);

    // Set PDF_PREVIEW_PATH to write the rendered file somewhere you can open it.
    if (process.env.PDF_PREVIEW_PATH) await writeFile(process.env.PDF_PREVIEW_PATH, bytes);
  }, 30_000);

  it('renders a draft with its watermark and a not-an-offer approval statement', async () => {
    const draft: QuoteDocumentModel = {
      ...model,
      status: 'CONFIGURING',
      validUntil: null,
      approval: { kind: 'NOT_APPROVED' },
    };
    const bytes = await renderToBuffer(QuoteDocument({ model: draft }));

    expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    if (process.env.PDF_PREVIEW_PATH) {
      await writeFile(process.env.PDF_PREVIEW_PATH.replace(/[.]pdf$/, '-draft.pdf'), bytes);
    }
  }, 30_000);
});
