import { describe, expect, it } from 'vitest';
import { type ConfigurationInput, Serviceability, ValidationSeverity } from '@nexora/types';

import { evaluateConfiguration, requiredProductIds } from './configuration';
import {
  CATALOGUE,
  DDOS_PROTECTION,
  ENTERPRISE_ROUTER,
  FIB_100,
  FIB_10G,
  FIB_1G,
  MANAGED_FIREWALL,
  MANAGED_ROUTER,
  PREMIUM_SUPPORT,
  RULES,
  SDWAN_EDGE,
  SDWAN_ENTERPRISE,
  SECURE_GATEWAY,
  STANDARD_SUPPORT,
  WITHDRAWN_PRODUCT,
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

function select(...productIds: readonly string[]) {
  return productIds.map((productId) => ({ productId, quantity: 1 }));
}

function evaluate(input: Partial<ConfigurationInput>) {
  return evaluateConfiguration(configuration(input), CATALOGUE, RULES);
}

function findingIds(result: ReturnType<typeof evaluate>): readonly string[] {
  return result.findings.map((finding) => finding.ruleId);
}

describe('configuration engine', () => {
  describe('requirement rules', () => {
    it('accepts a simple valid configuration', () => {
      const result = evaluate({ selections: select(FIB_100.id, MANAGED_FIREWALL.id) });

      expect(result.isValid).toBe(true);
      expect(result.canProceed).toBe(true);
      expect(result.findings.filter((finding) => finding.blocking)).toHaveLength(0);
    });

    it('requires a routing device at 1 Gbps', () => {
      const result = evaluate({ selections: select(FIB_1G.id) });

      expect(result.isValid).toBe(false);
      expect(findingIds(result)).toContain('r_1g_needs_router');
    });

    it('accepts either router at 1 Gbps', () => {
      const withManaged = evaluate({ selections: select(FIB_1G.id, MANAGED_ROUTER.id) });
      const withEnterprise = evaluate({ selections: select(FIB_1G.id, ENTERPRISE_ROUTER.id) });

      expect(findingIds(withManaged)).not.toContain('r_1g_needs_router');
      expect(findingIds(withEnterprise)).not.toContain('r_1g_needs_router');
    });

    it('requires the Enterprise Router at 10 Gbps', () => {
      const result = evaluate({ selections: select(FIB_10G.id, MANAGED_ROUTER.id) });

      expect(findingIds(result)).toContain('r_10g_needs_ent_router');
    });

    it('rejects the Managed Router on a 10 Gbps circuit', () => {
      const result = evaluate({
        selections: select(FIB_10G.id, ENTERPRISE_ROUTER.id, MANAGED_ROUTER.id),
      });

      const finding = result.findings.find(
        (item) => item.ruleId === 'r_10g_excludes_managed_router',
      );
      expect(finding).toBeDefined();
      expect(finding?.blocking).toBe(true);
      expect(finding?.remedy).toEqual({ kind: 'REMOVE_PRODUCT', productId: MANAGED_ROUTER.id });
    });

    it('accepts a fully valid 10 Gbps configuration', () => {
      const result = evaluate({
        selections: select(FIB_10G.id, ENTERPRISE_ROUTER.id, MANAGED_FIREWALL.id),
        contractMonths: 36,
      });

      expect(result.isValid).toBe(true);
      expect(result.canProceed).toBe(true);
    });

    it('requires the Secure Internet Gateway with DDoS Protection', () => {
      const result = evaluate({ selections: select(FIB_100.id, DDOS_PROTECTION.id) });

      expect(findingIds(result)).toContain('r_ddos_needs_gateway');

      const satisfied = evaluate({
        selections: select(FIB_100.id, DDOS_PROTECTION.id, SECURE_GATEWAY.id),
      });
      expect(findingIds(satisfied)).not.toContain('r_ddos_needs_gateway');
    });

    it('requires an edge device with SD-WAN and forbids the Managed Router', () => {
      const result = evaluate({
        selections: select(FIB_1G.id, SDWAN_ENTERPRISE.id, MANAGED_ROUTER.id),
      });

      expect(findingIds(result)).toContain('r_sdwan_needs_edge');
      expect(findingIds(result)).toContain('r_sdwan_excludes_managed_router');
    });
  });

  describe('mutual exclusion', () => {
    it('rejects two support tiers at once', () => {
      const result = evaluate({
        selections: select(FIB_100.id, STANDARD_SUPPORT.id, PREMIUM_SUPPORT.id),
      });

      const finding = result.findings.find((item) => item.ruleId === 'r_one_support_tier');
      expect(finding).toBeDefined();
      expect(finding?.blocking).toBe(true);
      expect(finding?.relatedProductIds).toHaveLength(2);
    });

    it('accepts a single support tier', () => {
      const result = evaluate({ selections: select(FIB_100.id, PREMIUM_SUPPORT.id) });

      expect(findingIds(result)).not.toContain('r_one_support_tier');
    });
  });

  describe('serviceability', () => {
    it('blocks any configuration at an unserviceable location', () => {
      const result = evaluate({
        selections: select(FIB_100.id),
        serviceability: Serviceability.UNAVAILABLE,
      });

      expect(result.isValid).toBe(false);
      expect(result.canProceed).toBe(false);
      expect(findingIds(result)).toContain('intrinsic:serviceability-unavailable');
    });

    it('warns but does not block while a serviceability check is pending', () => {
      const result = evaluate({
        selections: select(FIB_100.id),
        serviceability: Serviceability.PENDING_CHECK,
      });

      const finding = result.findings.find(
        (item) => item.ruleId === 'intrinsic:serviceability-pending',
      );
      expect(finding?.severity).toBe(ValidationSeverity.WARNING);
      expect(finding?.blocking).toBe(false);
      expect(result.isValid).toBe(true);
    });

    it('blocks 10 Gbps at a location with only limited service', () => {
      const result = evaluate({
        selections: select(FIB_10G.id, ENTERPRISE_ROUTER.id),
        serviceability: Serviceability.LIMITED,
      });

      expect(findingIds(result)).toContain('r_10g_needs_available');
      expect(result.isValid).toBe(false);
    });
  });

  describe('contract term', () => {
    it("enforces a product's own minimum term", () => {
      const result = evaluate({
        selections: select(FIB_1G.id, MANAGED_ROUTER.id),
        contractMonths: 12,
      });

      const finding = result.findings.find(
        (item) => item.ruleId === `intrinsic:min-term:${FIB_1G.id}`,
      );
      expect(finding?.blocking).toBe(true);
      expect(finding?.remedy).toEqual({ kind: 'SET_CONTRACT_MONTHS', months: 24 });
    });

    it('enforces the rule-driven minimum term for 10 Gbps', () => {
      const result = evaluate({
        selections: select(FIB_10G.id, ENTERPRISE_ROUTER.id),
        contractMonths: 24,
      });

      expect(findingIds(result)).toContain('r_10g_min_term');
    });
  });

  describe('catalogue integrity', () => {
    it('blocks a withdrawn product', () => {
      const result = evaluate({ selections: select(FIB_100.id, WITHDRAWN_PRODUCT.id) });

      const finding = result.findings.find(
        (item) => item.ruleId === `intrinsic:inactive:${WITHDRAWN_PRODUCT.id}`,
      );
      expect(finding?.blocking).toBe(true);
      expect(finding?.remedy).toEqual({ kind: 'REMOVE_PRODUCT', productId: WITHDRAWN_PRODUCT.id });
    });

    it('blocks a selection that no longer exists in the catalogue', () => {
      const result = evaluate({ selections: select(FIB_100.id, 'p_vanished') });

      expect(findingIds(result)).toContain('intrinsic:unknown-product:p_vanished');
      expect(result.isValid).toBe(false);
    });
  });

  describe('advisory findings', () => {
    it('recommends a firewall with SD-WAN without blocking', () => {
      const result = evaluate({
        selections: select(FIB_1G.id, ENTERPRISE_ROUTER.id, SDWAN_ENTERPRISE.id, SDWAN_EDGE.id),
      });

      const finding = result.findings.find((item) => item.ruleId === 'r_sdwan_recommends_firewall');
      expect(finding?.severity).toBe(ValidationSeverity.RECOMMENDATION);
      expect(finding?.blocking).toBe(false);
      expect(result.isValid).toBe(true);
    });

    it('warns when a configuration has no connectivity product', () => {
      const result = evaluate({ selections: select(MANAGED_FIREWALL.id) });

      expect(findingIds(result)).toContain('intrinsic:no-connectivity');
      expect(result.isValid).toBe(true);
    });
  });

  describe('engine behaviour', () => {
    it('never fires an inactive rule', () => {
      const result = evaluate({ selections: select(FIB_100.id) });

      expect(findingIds(result)).not.toContain('r_inactive_rule_ignored');
    });

    it('produces findings in a deterministic order', () => {
      const input = {
        selections: select(FIB_10G.id, MANAGED_ROUTER.id, STANDARD_SUPPORT.id, PREMIUM_SUPPORT.id),
        contractMonths: 24 as const,
      };

      expect(findingIds(evaluate(input))).toEqual(findingIds(evaluate(input)));
    });

    it('cannot proceed with an empty selection even though it is valid', () => {
      const result = evaluate({ selections: [] });

      expect(result.isValid).toBe(true);
      expect(result.canProceed).toBe(false);
    });
  });

  describe('required products helper', () => {
    it('lists the routers that satisfy the 1 Gbps requirement', () => {
      const required = requiredProductIds(
        configuration({ selections: select(FIB_1G.id) }),
        CATALOGUE,
        RULES,
      );

      expect(required).toContain(MANAGED_ROUTER.id);
      expect(required).toContain(ENTERPRISE_ROUTER.id);
    });

    it('stops listing an option group once it is satisfied', () => {
      const required = requiredProductIds(
        configuration({ selections: select(FIB_1G.id, MANAGED_ROUTER.id) }),
        CATALOGUE,
        RULES,
      );

      expect(required).not.toContain(ENTERPRISE_ROUTER.id);
    });
  });
});
