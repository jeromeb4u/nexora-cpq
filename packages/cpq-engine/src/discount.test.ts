import { describe, expect, it } from 'vitest';
import { type ProductSnapshot, ApprovalReason, cents, Role } from '@nexora/types';

import { approvedDiscountRate, evaluateDiscount, isDiscountBlocked } from './discount';
import { TCV_APPROVAL_THRESHOLD_CENTS } from './policy';
import {
  FIB_1G,
  MANAGED_FIREWALL,
  MANAGED_ROUTER,
  STANDARD_SUPPORT,
} from './__fixtures__/catalogue';

/** A modest TCV that never trips the value-based escalation on its own. */
const SMALL_TCV = cents(1_000_000); // €10,000

function request(overrides: {
  requestedBps: number;
  role: Role;
  selectedProducts?: readonly ProductSnapshot[];
  tcv?: number;
}) {
  return {
    requestedBps: overrides.requestedBps,
    role: overrides.role,
    selectedProducts: overrides.selectedProducts ?? [FIB_1G, MANAGED_FIREWALL],
    tcv: cents(overrides.tcv ?? SMALL_TCV),
  };
}

describe('discount engine', () => {
  describe('role authority', () => {
    it('lets a sales rep grant a discount inside their 10% authority', () => {
      const result = evaluateDiscount(request({ requestedBps: 800, role: Role.SALES_REP }));

      expect(result.withinAuthority).toBe(true);
      expect(result.requiresApproval).toBe(false);
      expect(result.escalatesTo).toBeNull();
      expect(result.reasons).toHaveLength(0);
    });

    it('treats the boundary as inclusive — exactly 10% needs no approval', () => {
      const result = evaluateDiscount(request({ requestedBps: 1_000, role: Role.SALES_REP }));

      expect(result.withinAuthority).toBe(true);
      expect(result.requiresApproval).toBe(false);
    });

    it('escalates one basis point over the boundary', () => {
      const result = evaluateDiscount(request({ requestedBps: 1_001, role: Role.SALES_REP }));

      expect(result.withinAuthority).toBe(false);
      expect(result.requiresApproval).toBe(true);
    });

    it('escalates an 18% request from a rep to the sales manager', () => {
      // The seeded QT-10482 scenario from the specification.
      const result = evaluateDiscount(request({ requestedBps: 1_800, role: Role.SALES_REP }));

      expect(result.withinAuthority).toBe(false);
      expect(result.requiresApproval).toBe(true);
      expect(result.exceedsAllRoles).toBe(false);
      expect(result.escalatesTo).toBe(Role.SALES_MANAGER);
      expect(result.reasons).toContain(ApprovalReason.DISCOUNT_EXCEEDS_THRESHOLD);
      expect(result.explanation).toContain('Sales Manager');
    });

    it('escalates to the lowest sufficient role, not always an administrator', () => {
      const result = evaluateDiscount(
        request({
          requestedBps: 2_400,
          role: Role.SALES_REP,
          selectedProducts: [STANDARD_SUPPORT],
        }),
      );

      expect(result.escalatesTo).toBe(Role.PRICING_ADMIN);
    });

    it('needs no approval when the same request comes from a manager', () => {
      const result = evaluateDiscount(request({ requestedBps: 1_800, role: Role.SALES_MANAGER }));

      expect(result.withinAuthority).toBe(true);
      expect(result.requiresApproval).toBe(false);
    });
  });

  describe('product ceiling', () => {
    it('is bounded by the least flexible product in the bundle', () => {
      // Managed Router caps at 10%, so the whole bundle caps at 10%.
      const result = evaluateDiscount(
        request({
          requestedBps: 1_500,
          role: Role.PRICING_ADMIN,
          selectedProducts: [FIB_1G, MANAGED_ROUTER],
        }),
      );

      expect(result.productMaxRate).toBeCloseTo(0.1, 5);
      expect(result.allowedRate).toBeCloseTo(0.1, 5);
      expect(result.exceedsAllRoles).toBe(true);
      expect(result.escalatesTo).toBeNull();
      expect(isDiscountBlocked(result)).toBe(true);
    });

    it('cannot be overridden by any role, including admin', () => {
      const result = evaluateDiscount(
        request({
          requestedBps: 3_000,
          role: Role.ADMIN,
          selectedProducts: [MANAGED_ROUTER],
        }),
      );

      expect(result.exceedsAllRoles).toBe(true);
      expect(result.explanation).toContain('No role can approve this');
    });

    it('allows a request that sits exactly on the product ceiling', () => {
      const result = evaluateDiscount(
        request({
          requestedBps: 2_500,
          role: Role.PRICING_ADMIN,
          selectedProducts: [STANDARD_SUPPORT],
        }),
      );

      expect(result.withinAuthority).toBe(true);
      expect(result.exceedsAllRoles).toBe(false);
    });

    it('permits no discount at all when nothing is selected', () => {
      const result = evaluateDiscount(
        request({ requestedBps: 500, role: Role.ADMIN, selectedProducts: [] }),
      );

      expect(result.allowedRate).toBe(0);
      expect(result.exceedsAllRoles).toBe(true);
    });
  });

  describe('contract value escalation', () => {
    it('requires approval on a large contract even at list price', () => {
      const result = evaluateDiscount(
        request({ requestedBps: 0, role: Role.SALES_REP, tcv: TCV_APPROVAL_THRESHOLD_CENTS }),
      );

      expect(result.withinAuthority).toBe(true);
      expect(result.requiresApproval).toBe(true);
      expect(result.reasons).toContain(ApprovalReason.CONTRACT_VALUE_THRESHOLD);
      expect(result.explanation).toContain('contract value');
    });

    it('does not trigger just below the threshold', () => {
      const result = evaluateDiscount(
        request({ requestedBps: 0, role: Role.SALES_REP, tcv: TCV_APPROVAL_THRESHOLD_CENTS - 1 }),
      );

      expect(result.requiresApproval).toBe(false);
    });

    it('records both reasons when discount and value both escalate', () => {
      const result = evaluateDiscount(
        request({
          requestedBps: 1_800,
          role: Role.SALES_REP,
          tcv: TCV_APPROVAL_THRESHOLD_CENTS,
        }),
      );

      expect(result.reasons).toContain(ApprovalReason.DISCOUNT_EXCEEDS_THRESHOLD);
      expect(result.reasons).toContain(ApprovalReason.CONTRACT_VALUE_THRESHOLD);
    });
  });

  describe('hostile input', () => {
    it('does not throw on an absurd rate — it answers "not allowed"', () => {
      const result = evaluateDiscount(request({ requestedBps: 9_900, role: Role.SALES_REP }));

      expect(result.exceedsAllRoles).toBe(true);
      expect(result.withinAuthority).toBe(false);
    });

    it('clamps a hostile request to the product ceiling when pricing', () => {
      // A client POSTing "discount: 99%" must change nothing about the price.
      const rate = approvedDiscountRate(
        request({ requestedBps: 9_900, role: Role.SALES_REP, selectedProducts: [MANAGED_ROUTER] }),
      );

      expect(rate).toBeCloseTo(0.1, 5);
    });

    it('treats a negative request as zero', () => {
      const result = evaluateDiscount(request({ requestedBps: -5_000, role: Role.SALES_REP }));

      expect(result.requestedRate).toBe(0);
      expect(result.withinAuthority).toBe(true);
    });
  });

  describe('approved rate', () => {
    it('applies a within-authority rate as requested', () => {
      expect(approvedDiscountRate(request({ requestedBps: 800, role: Role.SALES_REP }))).toBeCloseTo(
        0.08,
        5,
      );
    });

    it('shows the approver the full requested rate while escalation is pending', () => {
      // The state machine, not the price, is what stops an unapproved quote
      // from being sent — so the approver reviews the real number.
      expect(
        approvedDiscountRate(request({ requestedBps: 1_800, role: Role.SALES_REP })),
      ).toBeCloseTo(0.18, 5);
    });
  });
});
