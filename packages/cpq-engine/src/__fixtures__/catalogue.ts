import {
  type ConfigurationRule,
  type ProductSnapshot,
  cents,
  PricingModel,
  ProductCategory,
  RuleType,
  Serviceability,
  ValidationSeverity,
} from '@nexora/types';

/**
 * Test fixtures: a realistic slice of the Nexora catalogue and rule set.
 *
 * Kept deliberately close to the seeded production data so that a test failure
 * here means a real behavioural change, not a fixture artefact.
 */

function product(overrides: Partial<ProductSnapshot> & Pick<ProductSnapshot, 'id' | 'sku' | 'name' | 'category'>): ProductSnapshot {
  return {
    monthlyPrice: cents(0),
    setupPrice: cents(0),
    pricingModel: PricingModel.FLAT,
    minContractMonths: 12,
    maxDiscountRate: 0.2,
    bandwidthMbps: null,
    isActive: true,
    ...overrides,
  };
}

export const FIB_100 = product({
  id: 'p_fib100',
  sku: 'FIB-100',
  name: 'Business Fiber 100 Mbps',
  category: ProductCategory.CONNECTIVITY,
  monthlyPrice: cents(29_900),
  setupPrice: cents(50_000),
  bandwidthMbps: 100,
});

export const FIB_1G = product({
  id: 'p_fib1g',
  sku: 'FIB-1G',
  name: 'Business Fiber 1 Gbps',
  category: ProductCategory.CONNECTIVITY,
  monthlyPrice: cents(89_900),
  setupPrice: cents(150_000),
  bandwidthMbps: 1_000,
  minContractMonths: 24,
});

export const FIB_10G = product({
  id: 'p_fib10g',
  sku: 'FIB-10G',
  name: 'Business Fiber 10 Gbps',
  category: ProductCategory.CONNECTIVITY,
  monthlyPrice: cents(249_900),
  setupPrice: cents(500_000),
  bandwidthMbps: 10_000,
  minContractMonths: 36,
});

export const SDWAN_ENTERPRISE = product({
  id: 'p_sdwan_ent',
  sku: 'SDW-ENT',
  name: 'SD-WAN Enterprise',
  category: ProductCategory.SD_WAN,
  monthlyPrice: cents(65_000),
  setupPrice: cents(100_000),
  minContractMonths: 24,
});

export const MANAGED_FIREWALL = product({
  id: 'p_fw',
  sku: 'SEC-FW',
  name: 'Managed Firewall',
  category: ProductCategory.SECURITY,
  monthlyPrice: cents(32_000),
  setupPrice: cents(25_000),
});

export const DDOS_PROTECTION = product({
  id: 'p_ddos',
  sku: 'SEC-DDOS',
  name: 'DDoS Protection',
  category: ProductCategory.SECURITY,
  monthlyPrice: cents(45_000),
});

export const SECURE_GATEWAY = product({
  id: 'p_sig',
  sku: 'SEC-SIG',
  name: 'Secure Internet Gateway',
  category: ProductCategory.SECURITY,
  monthlyPrice: cents(28_000),
});

export const MANAGED_ROUTER = product({
  id: 'p_rtr_mgd',
  sku: 'HW-RTR-MGD',
  name: 'Managed Router',
  category: ProductCategory.HARDWARE,
  monthlyPrice: cents(8_500),
  setupPrice: cents(30_000),
  pricingModel: PricingModel.PER_UNIT,
  maxDiscountRate: 0.1,
});

export const ENTERPRISE_ROUTER = product({
  id: 'p_rtr_ent',
  sku: 'HW-RTR-ENT',
  name: 'Enterprise Router',
  category: ProductCategory.HARDWARE,
  monthlyPrice: cents(24_000),
  setupPrice: cents(90_000),
  pricingModel: PricingModel.PER_UNIT,
  maxDiscountRate: 0.1,
});

export const SDWAN_EDGE = product({
  id: 'p_sdwan_edge',
  sku: 'HW-SDWAN-EDGE',
  name: 'SD-WAN Edge Device',
  category: ProductCategory.HARDWARE,
  monthlyPrice: cents(12_000),
  setupPrice: cents(40_000),
  pricingModel: PricingModel.PER_SITE,
  maxDiscountRate: 0.1,
});

export const STANDARD_SUPPORT = product({
  id: 'p_sup_std',
  sku: 'SUP-STD',
  name: 'Standard Support',
  category: ProductCategory.SUPPORT,
  monthlyPrice: cents(9_900),
  maxDiscountRate: 0.25,
});

export const PREMIUM_SUPPORT = product({
  id: 'p_sup_prem',
  sku: 'SUP-PREM',
  name: 'Premium Support',
  category: ProductCategory.SUPPORT,
  monthlyPrice: cents(24_900),
  maxDiscountRate: 0.25,
});

export const WITHDRAWN_PRODUCT = product({
  id: 'p_withdrawn',
  sku: 'SEC-LEGACY',
  name: 'Legacy IDS',
  category: ProductCategory.SECURITY,
  monthlyPrice: cents(15_000),
  isActive: false,
});

export const CATALOGUE: readonly ProductSnapshot[] = [
  FIB_100,
  FIB_1G,
  FIB_10G,
  SDWAN_ENTERPRISE,
  MANAGED_FIREWALL,
  DDOS_PROTECTION,
  SECURE_GATEWAY,
  MANAGED_ROUTER,
  ENTERPRISE_ROUTER,
  SDWAN_EDGE,
  STANDARD_SUPPORT,
  PREMIUM_SUPPORT,
  WITHDRAWN_PRODUCT,
];

/** The rule set described in the build specification (§12). */
export const RULES: readonly ConfigurationRule[] = [
  {
    // NOTE: the source specification states this rule as "≥1 Gbps requires the
    // Managed Router". Taken literally alongside the two 10 Gbps rules below,
    // that is unsatisfiable: a 10 Gbps circuit would simultaneously require and
    // forbid the Managed Router. The requirement is therefore modelled as
    // "requires *a* router", which the Enterprise Router also satisfies.
    // Documented in docs/CPQ-RULES.md.
    id: 'r_1g_needs_router',
    type: RuleType.REQUIRES,
    severity: ValidationSeverity.ERROR,
    message: 'Connectivity of 1 Gbps or above requires a managed routing device.',
    isActive: true,
    priority: 10,
    trigger: { kind: 'BANDWIDTH_AT_LEAST', mbps: 1_000 },
    effect: {
      kind: 'REQUIRES_ONE_OF',
      productIds: [MANAGED_ROUTER.id, ENTERPRISE_ROUTER.id],
    },
  },
  {
    id: 'r_10g_needs_ent_router',
    type: RuleType.REQUIRES,
    severity: ValidationSeverity.ERROR,
    message: 'Connectivity of 10 Gbps requires an Enterprise Router.',
    isActive: true,
    priority: 5,
    trigger: { kind: 'BANDWIDTH_AT_LEAST', mbps: 10_000 },
    effect: { kind: 'REQUIRES_PRODUCT', productId: ENTERPRISE_ROUTER.id },
  },
  {
    id: 'r_10g_excludes_managed_router',
    type: RuleType.INCOMPATIBLE,
    severity: ValidationSeverity.ERROR,
    message: 'The Managed Router cannot terminate a 10 Gbps circuit.',
    isActive: true,
    priority: 6,
    trigger: { kind: 'BANDWIDTH_AT_LEAST', mbps: 10_000 },
    effect: { kind: 'INCOMPATIBLE_WITH_PRODUCT', productId: MANAGED_ROUTER.id },
  },
  {
    id: 'r_sdwan_needs_edge',
    type: RuleType.REQUIRES,
    severity: ValidationSeverity.ERROR,
    message: 'SD-WAN requires an SD-WAN Edge Device at each site.',
    isActive: true,
    priority: 20,
    trigger: { kind: 'CATEGORY_SELECTED', category: ProductCategory.SD_WAN },
    effect: { kind: 'REQUIRES_PRODUCT', productId: SDWAN_EDGE.id },
  },
  {
    id: 'r_sdwan_excludes_managed_router',
    type: RuleType.INCOMPATIBLE,
    severity: ValidationSeverity.ERROR,
    message: 'SD-WAN replaces the Managed Router and cannot be combined with it.',
    isActive: true,
    priority: 21,
    trigger: { kind: 'CATEGORY_SELECTED', category: ProductCategory.SD_WAN },
    effect: { kind: 'INCOMPATIBLE_WITH_PRODUCT', productId: MANAGED_ROUTER.id },
  },
  {
    id: 'r_ddos_needs_gateway',
    type: RuleType.REQUIRES,
    severity: ValidationSeverity.ERROR,
    message: 'DDoS Protection requires the Secure Internet Gateway.',
    isActive: true,
    priority: 30,
    trigger: { kind: 'PRODUCT_SELECTED', productId: DDOS_PROTECTION.id },
    effect: { kind: 'REQUIRES_PRODUCT', productId: SECURE_GATEWAY.id },
  },
  {
    id: 'r_one_support_tier',
    type: RuleType.MUTUALLY_EXCLUSIVE,
    severity: ValidationSeverity.ERROR,
    message: 'Only one support tier may be selected.',
    isActive: true,
    priority: 40,
    trigger: { kind: 'CATEGORY_SELECTED', category: ProductCategory.SUPPORT },
    effect: {
      kind: 'AT_MOST_ONE_OF',
      productIds: [STANDARD_SUPPORT.id, PREMIUM_SUPPORT.id],
    },
  },
  {
    id: 'r_10g_needs_available',
    type: RuleType.REQUIRES_SERVICEABILITY,
    severity: ValidationSeverity.ERROR,
    message: '10 Gbps connectivity requires a fully serviceable location.',
    isActive: true,
    priority: 1,
    trigger: { kind: 'BANDWIDTH_AT_LEAST', mbps: 10_000 },
    effect: { kind: 'MIN_SERVICEABILITY', level: Serviceability.AVAILABLE },
  },
  {
    id: 'r_sdwan_recommends_firewall',
    type: RuleType.RECOMMENDS,
    severity: ValidationSeverity.RECOMMENDATION,
    message: 'A Managed Firewall is recommended alongside SD-WAN.',
    isActive: true,
    priority: 90,
    trigger: { kind: 'CATEGORY_SELECTED', category: ProductCategory.SD_WAN },
    effect: { kind: 'RECOMMENDS_PRODUCT', productId: MANAGED_FIREWALL.id },
  },
  {
    id: 'r_10g_min_term',
    type: RuleType.MIN_CONTRACT_TERM,
    severity: ValidationSeverity.ERROR,
    message: '10 Gbps connectivity requires a minimum 36-month contract.',
    isActive: true,
    priority: 15,
    trigger: { kind: 'BANDWIDTH_AT_LEAST', mbps: 10_000 },
    effect: { kind: 'MIN_CONTRACT_MONTHS', months: 36 },
  },
  {
    id: 'r_inactive_rule_ignored',
    type: RuleType.REQUIRES,
    severity: ValidationSeverity.ERROR,
    message: 'This rule is disabled and must never fire.',
    isActive: false,
    priority: 2,
    trigger: { kind: 'ALWAYS' },
    effect: { kind: 'REQUIRES_PRODUCT', productId: PREMIUM_SUPPORT.id },
  },
];
