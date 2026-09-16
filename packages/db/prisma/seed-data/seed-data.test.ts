import { describe, expect, it } from 'vitest';
import {
  APPROVAL_REASONS,
  AUDIT_ACTIONS,
  AUDIT_ENTITIES,
  CONTRACT_TERMS,
  CUSTOMER_STATUSES,
  INDUSTRIES,
  NOTIFICATION_TYPES,
  PRICING_MODELS,
  PRODUCT_CATEGORIES,
  QUOTE_STATUSES,
  ROLES,
  RULE_TYPES,
  SERVICEABILITIES,
  VALIDATION_SEVERITIES,
} from '@nexora/types';

import * as PrismaEnums from '../../src/generated/prisma/enums';
import { SEED_PRODUCTS } from './catalogue';
import { SEED_RULES } from './rules';

/**
 * Seed data integrity.
 *
 * The seed writes to a database, so it cannot be exercised in a unit test — but
 * almost everything that actually goes wrong with seed data is a static
 * property: a mistyped SKU in a rule, a price ladder that inverts, a contract
 * term the UI cannot offer. All of that is checked here, in CI, before anyone
 * runs `pnpm db:seed`.
 */

const SKUS = new Set(SEED_PRODUCTS.map((product) => product.sku));

/** SKUs that `prisma/seed.ts` references by name in its quote scenarios. */
const SKUS_REQUIRED_BY_SEED_SCRIPT = [
  'FIB-250',
  'FIB-500',
  'FIB-1G',
  'FIB-10G',
  'SDW-ENT',
  'HW-SDWAN-EDGE',
  'SEC-FW',
  'SEC-DDOS',
  'SEC-SIG',
  'SEC-MDR',
  'HW-RTR-ENT',
  'HW-RTR-MGD',
  'SUP-STD',
  'SUP-PREM',
  'SUP-247',
] as const;

describe('seed catalogue', () => {
  it('defines a catalogue of a realistic size', () => {
    expect(SEED_PRODUCTS.length).toBeGreaterThanOrEqual(30);
  });

  it('has no duplicate SKUs', () => {
    expect(SKUS.size).toBe(SEED_PRODUCTS.length);
  });

  it('contains every SKU the seed script references', () => {
    const missing = SKUS_REQUIRED_BY_SEED_SCRIPT.filter((sku) => !SKUS.has(sku));
    expect(missing).toEqual([]);
  });

  it('covers every product category', () => {
    const covered = new Set(SEED_PRODUCTS.map((product) => product.category));
    expect([...covered].sort()).toEqual([...PRODUCT_CATEGORIES].sort());
  });

  it('only assigns bandwidth to connectivity products', () => {
    for (const product of SEED_PRODUCTS) {
      if (product.category === 'CONNECTIVITY') continue;
      expect(product.bandwidthMbps, `${product.sku} should not carry bandwidth`).toBeNull();
    }
  });

  /*
   * Connectivity is not a single price ladder. It holds three service classes
   * that price on different bases, and conflating them would assert something
   * commercially false:
   *   FIB-*        — the contended dedicated-fibre ladder
   *   CONN-BACKUP  — best-effort wireless failover, cheaper than any fibre tier
   *   CONN-ETH-DED — an uncontended Ethernet line, dearer than shared fibre
   *                  at the same headline speed
   * Each is asserted on its own terms.
   */
  it('prices the fibre ladder monotonically in bandwidth', () => {
    const ladder = SEED_PRODUCTS.filter((product) => product.sku.startsWith('FIB-')).sort(
      (a, b) => (a.bandwidthMbps ?? 0) - (b.bandwidthMbps ?? 0),
    );

    expect(ladder.length).toBeGreaterThanOrEqual(5);

    for (let i = 1; i < ladder.length; i += 1) {
      const previous = ladder[i - 1];
      const current = ladder[i];
      if (!previous || !current) continue;
      expect(
        current.monthlyPriceCents,
        `${current.sku} must cost more than ${previous.sku}`,
      ).toBeGreaterThan(previous.monthlyPriceCents);
    }
  });

  it('prices the fibre ladder sub-linearly, as bandwidth actually sells', () => {
    // 10× the bandwidth must not cost 10× the money, or the tiering is fiction.
    const oneGig = SEED_PRODUCTS.find((product) => product.sku === 'FIB-1G');
    const tenGig = SEED_PRODUCTS.find((product) => product.sku === 'FIB-10G');
    expect(oneGig && tenGig).toBeTruthy();
    if (!oneGig || !tenGig) return;

    const priceRatio = tenGig.monthlyPriceCents / oneGig.monthlyPriceCents;
    expect(priceRatio).toBeGreaterThan(1);
    expect(priceRatio).toBeLessThan(5);
  });

  it('prices best-effort wireless backup below every fibre tier', () => {
    const backup = SEED_PRODUCTS.find((product) => product.sku === 'CONN-BACKUP');
    const cheapestFibre = Math.min(
      ...SEED_PRODUCTS.filter((product) => product.sku.startsWith('FIB-')).map(
        (product) => product.monthlyPriceCents,
      ),
    );

    expect(backup?.monthlyPriceCents).toBeLessThan(cheapestFibre);
  });

  it('prices an uncontended dedicated line above shared fibre at the same speed', () => {
    const dedicated = SEED_PRODUCTS.find((product) => product.sku === 'CONN-ETH-DED');
    const sharedAtSameSpeed = SEED_PRODUCTS.find(
      (product) =>
        product.sku.startsWith('FIB-') && product.bandwidthMbps === dedicated?.bandwidthMbps,
    );

    expect(dedicated && sharedAtSameSpeed).toBeTruthy();
    if (!dedicated || !sharedAtSameSpeed) return;
    expect(dedicated.monthlyPriceCents).toBeGreaterThan(sharedAtSameSpeed.monthlyPriceCents);
  });

  it('only uses contract terms the application can offer', () => {
    for (const product of SEED_PRODUCTS) {
      expect(
        CONTRACT_TERMS as readonly number[],
        `${product.sku} has an unsellable minimum term`,
      ).toContain(product.minContractMonths);
    }
  });

  it('keeps every discount ceiling within policy', () => {
    for (const product of SEED_PRODUCTS) {
      expect(product.maxDiscountBps, product.sku).toBeGreaterThan(0);
      expect(product.maxDiscountBps, product.sku).toBeLessThanOrEqual(3_500);
      expect(Number.isInteger(product.maxDiscountBps), product.sku).toBe(true);
    }
  });

  it('stores every price as a non-negative whole number of cents', () => {
    for (const product of SEED_PRODUCTS) {
      expect(Number.isInteger(product.monthlyPriceCents), product.sku).toBe(true);
      expect(Number.isInteger(product.setupPriceCents), product.sku).toBe(true);
      expect(product.monthlyPriceCents, product.sku).toBeGreaterThanOrEqual(0);
      expect(product.setupPriceCents, product.sku).toBeGreaterThanOrEqual(0);
    }
  });

  it('gives every product a genuinely informative description', () => {
    for (const product of SEED_PRODUCTS) {
      expect(product.description.length, product.sku).toBeGreaterThan(30);
      expect(product.description, product.sku).not.toBe(product.name);
    }
  });

  it('includes exactly one withdrawn product so that code path has data', () => {
    const withdrawn = SEED_PRODUCTS.filter((product) => !product.isActive);
    expect(withdrawn).toHaveLength(1);
    expect(withdrawn[0]?.sku).toBe('SEC-LEGACY');
  });

  it('sells the 10 Gbps tier on a term the seeded quote can use', () => {
    // prisma/seed.ts sells FIB-10G on 36 months; a higher minimum would make
    // the flagship quote invalid.
    const tenGig = SEED_PRODUCTS.find((product) => product.sku === 'FIB-10G');
    expect(tenGig?.minContractMonths).toBeLessThanOrEqual(36);
  });
});

describe('seed rules', () => {
  it('defines a meaningful rule set', () => {
    expect(SEED_RULES.length).toBeGreaterThanOrEqual(14);
  });

  it('has no duplicate keys', () => {
    const keys = new Set(SEED_RULES.map((rule) => rule.key));
    expect(keys.size).toBe(SEED_RULES.length);
  });

  it('resolves every product SKU it references', () => {
    const unresolved: string[] = [];

    for (const rule of SEED_RULES) {
      if (rule.triggerSku && !SKUS.has(rule.triggerSku)) {
        unresolved.push(`${rule.key}: triggerSku ${rule.triggerSku}`);
      }
      if (rule.effectSku && !SKUS.has(rule.effectSku)) {
        unresolved.push(`${rule.key}: effectSku ${rule.effectSku}`);
      }
      for (const sku of rule.targetSkus) {
        if (!SKUS.has(sku)) unresolved.push(`${rule.key}: targetSku ${sku}`);
      }
    }

    expect(unresolved).toEqual([]);
  });

  it('supplies targets for the set-valued effects and only for those', () => {
    for (const rule of SEED_RULES) {
      const isSetValued =
        rule.effectKind === 'REQUIRES_ONE_OF' || rule.effectKind === 'AT_MOST_ONE_OF';

      if (isSetValued) {
        expect(rule.targetSkus.length, `${rule.key} needs targets`).toBeGreaterThanOrEqual(2);
      } else {
        expect(rule.targetSkus, `${rule.key} should not carry targets`).toHaveLength(0);
      }
    }
  });

  it('supplies the threshold each trigger kind needs', () => {
    for (const rule of SEED_RULES) {
      if (rule.triggerKind === 'BANDWIDTH_AT_LEAST' || rule.triggerKind === 'CONTRACT_TERM_AT_LEAST') {
        expect(rule.triggerThreshold, `${rule.key} needs a threshold`).toBeGreaterThan(0);
      }
      if (rule.triggerKind === 'PRODUCT_SELECTED') {
        expect(rule.triggerSku, `${rule.key} needs a trigger product`).not.toBeNull();
      }
      if (rule.triggerKind === 'CATEGORY_SELECTED') {
        expect(rule.triggerCategory, `${rule.key} needs a trigger category`).not.toBeNull();
      }
    }
  });

  it('supplies the payload each effect kind needs', () => {
    for (const rule of SEED_RULES) {
      if (
        rule.effectKind === 'REQUIRES_PRODUCT' ||
        rule.effectKind === 'INCOMPATIBLE_WITH_PRODUCT' ||
        rule.effectKind === 'RECOMMENDS_PRODUCT'
      ) {
        expect(rule.effectSku, `${rule.key} needs an effect product`).not.toBeNull();
      }
      if (rule.effectKind === 'MIN_CONTRACT_MONTHS') {
        expect(rule.effectThreshold, `${rule.key} needs a term`).toBeGreaterThan(0);
      }
      if (rule.effectKind === 'MIN_SERVICEABILITY') {
        expect(rule.effectServiceability, `${rule.key} needs a level`).not.toBeNull();
      }
    }
  });

  it('writes every message as a complete sentence for the configurator', () => {
    for (const rule of SEED_RULES) {
      expect(rule.message.length, rule.key).toBeGreaterThan(20);
      expect(rule.message.trim(), rule.key).toMatch(/[.!]$/);
    }
  });

  it('never makes the Managed Router both required and forbidden at 10 Gbps', () => {
    // The specification's rules are contradictory if the >=1 Gbps requirement
    // is modelled as REQUIRES_PRODUCT on the Managed Router. Guard the fix.
    const gigabitRouterRule = SEED_RULES.find(
      (rule) => rule.triggerKind === 'BANDWIDTH_AT_LEAST' && rule.triggerThreshold === 1_000,
    );

    expect(gigabitRouterRule?.effectKind).toBe('REQUIRES_ONE_OF');
    expect(gigabitRouterRule?.targetSkus).toContain('HW-RTR-ENT');
  });
});

/**
 * Enum drift guard.
 *
 * `packages/types/src/enums.ts` is the declared single source of truth, and the
 * Prisma schema mirrors it by hand. Hand-mirroring drifts, so this test fails
 * the build the moment the two disagree — which is the guarantee the schema
 * header claims.
 */
describe('Prisma enums mirror the canonical domain enums', () => {
  const pairs: readonly [string, readonly string[], Record<string, string>][] = [
    ['Role', ROLES, PrismaEnums.Role],
    ['CustomerStatus', CUSTOMER_STATUSES, PrismaEnums.CustomerStatus],
    ['Industry', INDUSTRIES, PrismaEnums.Industry],
    ['Serviceability', SERVICEABILITIES, PrismaEnums.Serviceability],
    ['ProductCategory', PRODUCT_CATEGORIES, PrismaEnums.ProductCategory],
    ['PricingModel', PRICING_MODELS, PrismaEnums.PricingModel],
    ['RuleType', RULE_TYPES, PrismaEnums.RuleType],
    ['ValidationSeverity', VALIDATION_SEVERITIES, PrismaEnums.ValidationSeverity],
    ['QuoteStatus', QUOTE_STATUSES, PrismaEnums.QuoteStatus],
    ['ApprovalReason', APPROVAL_REASONS, PrismaEnums.ApprovalReason],
    ['AuditAction', AUDIT_ACTIONS, PrismaEnums.AuditAction],
    ['AuditEntity', AUDIT_ENTITIES, PrismaEnums.AuditEntity],
    ['NotificationType', NOTIFICATION_TYPES, PrismaEnums.NotificationType],
  ];

  for (const [name, canonical, prismaEnum] of pairs) {
    it(`${name} matches`, () => {
      expect(Object.values(prismaEnum).sort()).toEqual([...canonical].sort());
    });
  }
});
