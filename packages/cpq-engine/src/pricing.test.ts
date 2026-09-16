import { describe, expect, it } from 'vitest';
import { type ConfigurationInput, cents, Serviceability } from '@nexora/types';

import { buildPriceLines, calculatePrice, emptyPriceBreakdown, totalContractValue } from './pricing';
import {
  FIB_1G,
  FIB_100,
  MANAGED_FIREWALL,
  MANAGED_ROUTER,
  PREMIUM_SUPPORT,
  SDWAN_EDGE,
  CATALOGUE,
} from './__fixtures__/catalogue';

function configuration(overrides: Partial<ConfigurationInput> = {}): ConfigurationInput {
  return {
    selections: [],
    contractMonths: 36,
    serviceability: Serviceability.AVAILABLE,
    siteCount: 1,
    ...overrides,
  };
}

describe('pricing engine', () => {
  describe('line construction', () => {
    it('prices a FLAT product once regardless of requested quantity', () => {
      const lines = buildPriceLines(
        configuration({ selections: [{ productId: MANAGED_FIREWALL.id, quantity: 7 }] }),
        CATALOGUE,
      );

      expect(lines).toHaveLength(1);
      expect(lines[0]?.quantity).toBe(1);
      expect(lines[0]?.monthlySubtotal).toBe(MANAGED_FIREWALL.monthlyPrice);
    });

    it('multiplies a PER_UNIT product by the requested quantity', () => {
      const lines = buildPriceLines(
        configuration({ selections: [{ productId: MANAGED_ROUTER.id, quantity: 3 }] }),
        CATALOGUE,
      );

      // 3 × €85.00 = €255.00, and 3 × €300.00 setup = €900.00
      expect(lines[0]?.quantity).toBe(3);
      expect(lines[0]?.monthlySubtotal).toBe(cents(25_500));
      expect(lines[0]?.setupSubtotal).toBe(cents(90_000));
    });

    it('bills a PER_SITE product once per location, ignoring requested quantity', () => {
      const lines = buildPriceLines(
        configuration({
          selections: [{ productId: SDWAN_EDGE.id, quantity: 1 }],
          siteCount: 4,
        }),
        CATALOGUE,
      );

      // 4 sites × €120.00
      expect(lines[0]?.quantity).toBe(4);
      expect(lines[0]?.monthlySubtotal).toBe(cents(48_000));
    });

    it('refuses to invent a price for a product missing from the catalogue', () => {
      const lines = buildPriceLines(
        configuration({ selections: [{ productId: 'p_does_not_exist', quantity: 1 }] }),
        CATALOGUE,
      );

      expect(lines).toHaveLength(0);
    });

    it('orders lines by catalogue position so quote documents are stable', () => {
      const lines = buildPriceLines(
        configuration({
          selections: [
            { productId: PREMIUM_SUPPORT.id, quantity: 1 },
            { productId: FIB_100.id, quantity: 1 },
            { productId: MANAGED_FIREWALL.id, quantity: 1 },
          ],
        }),
        CATALOGUE,
      );

      expect(lines.map((line) => line.sku)).toEqual(['FIB-100', 'SEC-FW', 'SUP-PREM']);
    });
  });

  describe('totals', () => {
    it('computes a known configuration exactly', () => {
      // Fiber 1 Gbps (€899.00 / €1,500.00 setup)
      // + Managed Firewall (€320.00 / €250.00 setup)
      // + Premium Support (€249.00 / no setup)
      // 36-month term earns the automatic 5% term discount.
      const result = calculatePrice({
        configuration: configuration({
          contractMonths: 36,
          selections: [
            { productId: FIB_1G.id, quantity: 1 },
            { productId: MANAGED_FIREWALL.id, quantity: 1 },
            { productId: PREMIUM_SUPPORT.id, quantity: 1 },
          ],
        }),
        catalogue: CATALOGUE,
        approvedManualRate: 0,
      });

      expect(result.grossMonthly).toBe(cents(146_800)); // 89 900 + 32 000 + 24 900
      expect(result.grossSetup).toBe(cents(175_000)); // 150 000 + 25 000 + 0
      expect(result.discountMonthly).toBe(cents(7_340)); // 5% of 146 800
      expect(result.mrr).toBe(cents(139_460));
      expect(result.otc).toBe(cents(175_000));
      expect(result.tcv).toBe(cents(5_195_560)); // 139 460 × 36 + 175 000
    });

    it('is deterministic — identical inputs produce identical output', () => {
      const input = {
        configuration: configuration({
          selections: [
            { productId: FIB_1G.id, quantity: 1 },
            { productId: MANAGED_ROUTER.id, quantity: 2 },
          ],
        }),
        catalogue: CATALOGUE,
        approvedManualRate: 0.12,
      };

      expect(calculatePrice(input)).toEqual(calculatePrice(input));
    });

    it('applies the manual discount on top of the automatic term discount', () => {
      const result = calculatePrice({
        configuration: configuration({
          contractMonths: 36,
          selections: [{ productId: FIB_100.id, quantity: 1 }],
        }),
        catalogue: CATALOGUE,
        approvedManualRate: 0.1,
      });

      // gross 29 900; term 5% -> 1 495; manual 10% -> 2 990; total 4 485
      expect(result.discounts.map((discount) => discount.code)).toEqual(['TERM_36', 'MANUAL']);
      expect(result.discountMonthly).toBe(cents(4_485));
      expect(result.mrr).toBe(cents(25_415));
    });

    it('grants no automatic discount on a 12-month term', () => {
      const result = calculatePrice({
        configuration: configuration({
          contractMonths: 12,
          selections: [{ productId: FIB_100.id, quantity: 1 }],
        }),
        catalogue: CATALOGUE,
        approvedManualRate: 0,
      });

      expect(result.discounts).toHaveLength(0);
      expect(result.mrr).toBe(result.grossMonthly);
    });

    it('clamps an absurd rate to each product’s own ceiling', () => {
      const result = calculatePrice({
        configuration: configuration({
          contractMonths: 60,
          selections: [{ productId: FIB_100.id, quantity: 1 }],
        }),
        catalogue: CATALOGUE,
        // The per-line ceiling, not the caller, is what protects the total.
        approvedManualRate: 5,
      });

      // FIB-100 caps at 20%; 60 months contributes 8% automatically.
      expect(result.lines[0]?.appliedDiscountRate).toBeCloseTo(0.2, 5);
      expect(result.lines[0]?.discountCapped).toBe(true);
      expect(result.discountMonthly).toBe(cents(5_980)); // 20% of 29 900
      expect(result.mrr).toBe(cents(23_920));
      expect(result.mrr).toBeGreaterThan(0);
    });

    /*
     * Regression: discount ceilings are PER LINE, not per bundle.
     *
     * An earlier version capped the whole quote at the tightest product ceiling
     * in it. That made any bundle containing hardware effectively
     * undiscountable, and — the symptom that exposed it — produced byte
     * identical totals for two different requested discounts.
     */
    it('caps only the line whose product is restricted', () => {
      const result = calculatePrice({
        configuration: configuration({
          contractMonths: 24, // 2% automatic, keeps the arithmetic legible
          selections: [
            { productId: FIB_1G.id, quantity: 1 }, // ceiling 20%
            { productId: MANAGED_ROUTER.id, quantity: 1 }, // ceiling 10%
          ],
        }),
        catalogue: CATALOGUE,
        approvedManualRate: 0.18,
      });

      const fibre = result.lines.find((line) => line.productId === FIB_1G.id);
      const router = result.lines.find((line) => line.productId === MANAGED_ROUTER.id);

      // 2% term + 18% negotiated = 20%, exactly at the fibre ceiling.
      expect(fibre?.appliedDiscountRate).toBeCloseTo(0.2, 5);
      expect(fibre?.discountCapped).toBe(false);

      // The router is held at its own 10% ceiling, not dragged to it by others.
      expect(router?.appliedDiscountRate).toBeCloseTo(0.1, 5);
      expect(router?.discountCapped).toBe(true);
    });

    it('produces different totals for different requested discounts', () => {
      // The symptom that exposed the per-bundle capping bug: two clearly
      // different negotiated rates must not price identically.
      const config = configuration({
        contractMonths: 36,
        selections: [
          { productId: FIB_1G.id, quantity: 1 },
          { productId: MANAGED_ROUTER.id, quantity: 1 },
        ],
      });

      const at12 = calculatePrice({
        configuration: config,
        catalogue: CATALOGUE,
        approvedManualRate: 0.12,
      });
      const at18 = calculatePrice({
        configuration: config,
        catalogue: CATALOGUE,
        approvedManualRate: 0.18,
      });

      expect(at18.mrr).toBeLessThan(at12.mrr);
    });

    it('does not discount one-time setup charges', () => {
      const result = calculatePrice({
        configuration: configuration({
          contractMonths: 60,
          selections: [{ productId: FIB_1G.id, quantity: 1 }],
        }),
        catalogue: CATALOGUE,
        approvedManualRate: 0.2,
      });

      expect(result.otc).toBe(result.grossSetup);
      expect(result.otc).toBe(FIB_1G.setupPrice);
    });

    it('keeps the discount breakdown consistent with the total', () => {
      const result = calculatePrice({
        configuration: configuration({
          contractMonths: 48,
          selections: [
            { productId: FIB_1G.id, quantity: 1 },
            { productId: MANAGED_FIREWALL.id, quantity: 1 },
          ],
        }),
        catalogue: CATALOGUE,
        approvedManualRate: 0.07,
      });

      const summed = result.discounts.reduce((total, discount) => total + discount.amount, 0);
      expect(summed).toBe(result.discountMonthly);
      expect(result.grossMonthly - result.discountMonthly).toBe(result.mrr);
    });

    it('reports an effective rate consistent with the amounts', () => {
      const result = calculatePrice({
        configuration: configuration({
          contractMonths: 36,
          selections: [{ productId: FIB_100.id, quantity: 1 }],
        }),
        catalogue: CATALOGUE,
        approvedManualRate: 0.15,
      });

      expect(result.effectiveDiscountRate).toBeCloseTo(0.2, 5);
    });

    it('produces a zero breakdown for an empty configuration', () => {
      const result = calculatePrice({
        configuration: configuration(),
        catalogue: CATALOGUE,
        approvedManualRate: 0.3,
      });

      expect(result.grossMonthly).toBe(cents(0));
      expect(result.mrr).toBe(cents(0));
      expect(result.tcv).toBe(cents(0));
      expect(result.lines).toHaveLength(0);
    });
  });

  describe('total contract value', () => {
    it('is MRR × term plus one-time charges', () => {
      expect(totalContractValue(cents(100_000), 36, cents(250_000))).toBe(cents(3_850_000));
    });

    it('rejects a non-positive or fractional term', () => {
      expect(() => totalContractValue(cents(1_000), 0, cents(0))).toThrow(RangeError);
      expect(() => totalContractValue(cents(1_000), -12, cents(0))).toThrow(RangeError);
      expect(() => totalContractValue(cents(1_000), 12.5, cents(0))).toThrow(RangeError);
    });
  });

  it('exposes an empty breakdown helper that agrees with the engine', () => {
    const empty = emptyPriceBreakdown(36);
    const computed = calculatePrice({
      configuration: configuration(),
      catalogue: CATALOGUE,
      approvedManualRate: 0,
    });

    expect(empty.mrr).toBe(computed.mrr);
    expect(empty.tcv).toBe(computed.tcv);
    expect(empty.contractMonths).toBe(36);
  });
});
