import type { QuoteStatus } from '@nexora/types';

/**
 * The data a quote document is rendered from.
 *
 * Deliberately a plain, serialisable shape with no Prisma types in it: the
 * renderer should not know where the numbers came from, and tests can build
 * one by hand.
 */
export interface QuoteDocumentModel {
  readonly quoteNumber: string;
  readonly title: string | null;
  readonly status: QuoteStatus;
  readonly versionNumber: number;
  readonly issuedAt: Date;
  readonly validUntil: Date | null;

  readonly customer: {
    readonly companyName: string;
    readonly legalName: string;
    readonly vatNumber: string;
    readonly email: string;
    readonly phone: string;
  };

  /** The installation site, when the quote is for one. */
  readonly site: {
    readonly name: string;
    readonly addressLines: readonly string[];
    readonly contactName: string;
    readonly contactEmail: string;
    readonly contactPhone: string | null;
  } | null;

  readonly representative: { readonly name: string; readonly email: string };

  readonly contractMonths: number;
  readonly effectiveDiscountBps: number;

  readonly lines: readonly {
    readonly sku: string;
    readonly name: string;
    readonly quantity: number;
    readonly unitMonthlyCents: number;
    readonly unitSetupCents: number;
    readonly monthlyCents: number;
    readonly setupCents: number;
  }[];

  /** Discounts as applied at save time: term-based and negotiated, with amounts. */
  readonly discounts: readonly {
    readonly label: string;
    readonly rate: number;
    readonly amountCents: number;
  }[];

  readonly totals: {
    readonly grossMonthlyCents: number;
    readonly discountMonthlyCents: number;
    readonly mrrCents: number;
    readonly otcCents: number;
    readonly tcvCents: number;
  };

  readonly approval:
    | {
        readonly kind: 'APPROVED';
        readonly approverName: string;
        readonly decidedAt: Date;
        readonly discountBps: number;
      }
    | { readonly kind: 'WITHIN_AUTHORITY' }
    | { readonly kind: 'PENDING' }
    | { readonly kind: 'NOT_APPROVED' };
}

/** Statuses in which the document is a binding commercial offer. */
const OFFER_STATUSES: readonly QuoteStatus[] = ['APPROVED', 'SENT_TO_CUSTOMER', 'ACCEPTED'];

export function isBindingOffer(status: QuoteStatus): boolean {
  return OFFER_STATUSES.includes(status);
}

export interface StoredPricing {
  readonly contractMonths: number;
  readonly grossMonthlyCents: number;
  readonly grossSetupCents: number;
  readonly discountMonthlyCents: number;
  readonly mrrCents: number;
  readonly otcCents: number;
  readonly tcvCents: number;
  readonly items: readonly { readonly monthlyCents: number; readonly setupCents: number }[];
}

/**
 * Re-derive a version's totals from its own line items and compare.
 *
 * A document is a commercial promise. Before one is produced, the stored
 * figures are checked against the arithmetic they must satisfy, so a row that
 * was edited by hand, or written by a buggy migration, fails loudly instead of
 * going out to a customer with totals that do not add up.
 */
export function pricingIntegrityIssues(version: StoredPricing): string[] {
  const issues: string[] = [];
  const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

  const lineMonthly = sum(version.items.map((item) => item.monthlyCents));
  const lineSetup = sum(version.items.map((item) => item.setupCents));

  if (lineMonthly !== version.grossMonthlyCents) {
    issues.push(
      `line monthly subtotals (${lineMonthly}) do not equal gross monthly (${version.grossMonthlyCents})`,
    );
  }
  if (lineSetup !== version.grossSetupCents) {
    issues.push(
      `line setup subtotals (${lineSetup}) do not equal gross setup (${version.grossSetupCents})`,
    );
  }
  if (version.grossMonthlyCents - version.discountMonthlyCents !== version.mrrCents) {
    issues.push('gross monthly minus discount does not equal MRR');
  }
  if (version.otcCents !== version.grossSetupCents) {
    issues.push('one-time charges do not equal gross setup');
  }
  if (version.mrrCents * version.contractMonths + version.otcCents !== version.tcvCents) {
    issues.push('MRR × term + one-time charges does not equal TCV');
  }

  return issues;
}
