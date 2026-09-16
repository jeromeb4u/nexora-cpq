import {
  PricingModel,
  ProductCategory,
} from '../../src/generated/prisma/enums';
import type { SeedProduct } from './types';

/**
 * Nexora Telecom product catalogue seed data.
 *
 * Prices are plausible European B2B telecoms prices, expressed in euro cents.
 * Bandwidth tiers within CONNECTIVITY increase monotonically in price, but
 * sub-linearly with bandwidth (a 10 Gbps circuit is nowhere near 100x the
 * price of a 100 Mbps one, reflecting how carrier backbone economics actually
 * scale). SKUs and prices for the subset also used in
 * packages/cpq-engine/src/__fixtures__/catalogue.ts are kept identical so
 * that fixture and production data never silently diverge.
 */

// ---------------------------------------------------------------------------
// CONNECTIVITY
// ---------------------------------------------------------------------------

const FIB_100: SeedProduct = {
  sku: 'FIB-100',
  name: 'Business Fiber 100 Mbps',
  description:
    'A shared fiber internet circuit delivering 100 Mbps symmetric bandwidth, suited to small offices and branch locations with light cloud and VoIP usage.',
  category: ProductCategory.CONNECTIVITY,
  monthlyPriceCents: 29_900,
  setupPriceCents: 50_000,
  pricingModel: PricingModel.FLAT,
  minContractMonths: 12,
  maxDiscountBps: 2000,
  bandwidthMbps: 100,
  isActive: true,
  sortOrder: 10,
};

const FIB_250: SeedProduct = {
  sku: 'FIB-250',
  name: 'Business Fiber 250 Mbps',
  description:
    'A shared fiber circuit delivering 250 Mbps symmetric bandwidth for growing offices running multiple cloud applications alongside voice traffic.',
  category: ProductCategory.CONNECTIVITY,
  monthlyPriceCents: 42_900,
  setupPriceCents: 60_000,
  pricingModel: PricingModel.FLAT,
  minContractMonths: 12,
  maxDiscountBps: 2000,
  bandwidthMbps: 250,
  isActive: true,
  sortOrder: 20,
};

const FIB_500: SeedProduct = {
  sku: 'FIB-500',
  name: 'Business Fiber 500 Mbps',
  description:
    'A shared fiber circuit delivering 500 Mbps symmetric bandwidth for mid-sized sites with heavier video conferencing, backup, and SaaS traffic.',
  category: ProductCategory.CONNECTIVITY,
  monthlyPriceCents: 59_900,
  setupPriceCents: 75_000,
  pricingModel: PricingModel.FLAT,
  minContractMonths: 24,
  maxDiscountBps: 2000,
  bandwidthMbps: 500,
  isActive: true,
  sortOrder: 30,
};

const FIB_1G: SeedProduct = {
  sku: 'FIB-1G',
  name: 'Business Fiber 1 Gbps',
  description:
    'A shared fiber circuit delivering 1 Gbps symmetric bandwidth for data centres, headquarters, or sites consolidating traffic from multiple branches.',
  category: ProductCategory.CONNECTIVITY,
  monthlyPriceCents: 89_900,
  setupPriceCents: 150_000,
  pricingModel: PricingModel.FLAT,
  minContractMonths: 24,
  maxDiscountBps: 2000,
  bandwidthMbps: 1_000,
  isActive: true,
  sortOrder: 40,
};

const FIB_10G: SeedProduct = {
  sku: 'FIB-10G',
  name: 'Business Fiber 10 Gbps',
  description:
    'A high-capacity shared fiber circuit delivering 10 Gbps symmetric bandwidth for large data centres and carrier-grade aggregation points.',
  category: ProductCategory.CONNECTIVITY,
  monthlyPriceCents: 249_900,
  setupPriceCents: 500_000,
  pricingModel: PricingModel.FLAT,
  minContractMonths: 36,
  maxDiscountBps: 2000,
  bandwidthMbps: 10_000,
  isActive: true,
  sortOrder: 50,
};

const CONN_BACKUP: SeedProduct = {
  sku: 'CONN-BACKUP',
  name: '4G/5G Wireless Backup Circuit',
  description:
    'A 4G/5G wireless failover circuit that automatically takes over when the primary fiber connection drops, protecting sites that cannot tolerate downtime.',
  category: ProductCategory.CONNECTIVITY,
  monthlyPriceCents: 14_900,
  setupPriceCents: 20_000,
  pricingModel: PricingModel.FLAT,
  minContractMonths: 12,
  maxDiscountBps: 2000,
  bandwidthMbps: 150,
  isActive: true,
  sortOrder: 60,
};

const CONN_ETH_DED: SeedProduct = {
  sku: 'CONN-ETH-DED',
  name: 'Dedicated Ethernet Line',
  description:
    'An uncontended, symmetric point-to-point Ethernet circuit with a dedicated SLA, suited to latency-sensitive applications such as real-time trading or data replication.',
  category: ProductCategory.CONNECTIVITY,
  monthlyPriceCents: 145_000,
  setupPriceCents: 250_000,
  pricingModel: PricingModel.FLAT,
  minContractMonths: 36,
  maxDiscountBps: 2000,
  bandwidthMbps: 1_000,
  isActive: true,
  sortOrder: 70,
};

// ---------------------------------------------------------------------------
// SD_WAN
// ---------------------------------------------------------------------------

const SDW_STD: SeedProduct = {
  sku: 'SDW-STD',
  name: 'SD-WAN Standard',
  description:
    'An entry-level SD-WAN service providing basic application-aware routing across two or more circuits for small multi-site businesses.',
  category: ProductCategory.SD_WAN,
  monthlyPriceCents: 35_000,
  setupPriceCents: 50_000,
  pricingModel: PricingModel.FLAT,
  minContractMonths: 12,
  maxDiscountBps: 2000,
  bandwidthMbps: null,
  isActive: true,
  sortOrder: 10,
};

const SDW_ADV: SeedProduct = {
  sku: 'SDW-ADV',
  name: 'SD-WAN Advanced',
  description:
    'A mid-tier SD-WAN service adding dynamic path selection and application performance monitoring for businesses with several branch sites.',
  category: ProductCategory.SD_WAN,
  monthlyPriceCents: 50_000,
  setupPriceCents: 75_000,
  pricingModel: PricingModel.FLAT,
  minContractMonths: 12,
  maxDiscountBps: 2000,
  bandwidthMbps: null,
  isActive: true,
  sortOrder: 20,
};

const SDW_ENT: SeedProduct = {
  sku: 'SDW-ENT',
  name: 'SD-WAN Enterprise',
  description:
    'A full-featured SD-WAN service with centralized policy control, application-aware routing, and integrated security for multi-site enterprises.',
  category: ProductCategory.SD_WAN,
  monthlyPriceCents: 65_000,
  setupPriceCents: 100_000,
  pricingModel: PricingModel.FLAT,
  minContractMonths: 24,
  maxDiscountBps: 2000,
  bandwidthMbps: null,
  isActive: true,
  sortOrder: 30,
};

const SDW_MGMT: SeedProduct = {
  sku: 'SDW-MGMT',
  name: 'SD-WAN Management & Orchestration',
  description:
    "An add-on giving the customer's IT team a self-service portal to monitor and adjust their own SD-WAN policies without opening a support ticket.",
  category: ProductCategory.SD_WAN,
  monthlyPriceCents: 15_000,
  setupPriceCents: 20_000,
  pricingModel: PricingModel.FLAT,
  minContractMonths: 12,
  maxDiscountBps: 2000,
  bandwidthMbps: null,
  isActive: true,
  sortOrder: 40,
};

// ---------------------------------------------------------------------------
// SECURITY
// ---------------------------------------------------------------------------

const SEC_SIG: SeedProduct = {
  sku: 'SEC-SIG',
  name: 'Secure Internet Gateway',
  description:
    'A cloud-delivered secure web gateway that filters and inspects outbound internet traffic for malware and policy violations, suited to any office with direct internet access.',
  category: ProductCategory.SECURITY,
  monthlyPriceCents: 28_000,
  setupPriceCents: 0,
  pricingModel: PricingModel.FLAT,
  minContractMonths: 12,
  maxDiscountBps: 1500,
  bandwidthMbps: null,
  isActive: true,
  sortOrder: 10,
};

const SEC_FW: SeedProduct = {
  sku: 'SEC-FW',
  name: 'Managed Firewall',
  description:
    "A vendor-managed next-generation firewall appliance with 24/7 monitoring and rule changes handled by Nexora's security operations centre.",
  category: ProductCategory.SECURITY,
  monthlyPriceCents: 32_000,
  setupPriceCents: 25_000,
  pricingModel: PricingModel.FLAT,
  minContractMonths: 12,
  maxDiscountBps: 1500,
  bandwidthMbps: null,
  isActive: true,
  sortOrder: 20,
};

const SEC_DDOS: SeedProduct = {
  sku: 'SEC-DDOS',
  name: 'DDoS Protection',
  description:
    'Always-on traffic scrubbing that detects and mitigates volumetric and application-layer DDoS attacks before they reach the customer network.',
  category: ProductCategory.SECURITY,
  monthlyPriceCents: 45_000,
  setupPriceCents: 0,
  pricingModel: PricingModel.FLAT,
  minContractMonths: 12,
  maxDiscountBps: 1500,
  bandwidthMbps: null,
  isActive: true,
  sortOrder: 30,
};

const SEC_ZTNA: SeedProduct = {
  sku: 'SEC-ZTNA',
  name: 'Zero Trust Network Access',
  description:
    'A zero trust network access service that grants remote and hybrid employees access to specific applications without placing them on the full corporate network.',
  category: ProductCategory.SECURITY,
  monthlyPriceCents: 38_000,
  setupPriceCents: 30_000,
  pricingModel: PricingModel.FLAT,
  minContractMonths: 12,
  maxDiscountBps: 1500,
  bandwidthMbps: null,
  isActive: true,
  sortOrder: 40,
};

const SEC_EMAIL: SeedProduct = {
  sku: 'SEC-EMAIL',
  name: 'Email Security Gateway',
  description:
    'A cloud email security gateway that filters phishing, malware, and spam before messages reach the customer mailboxes, suited to any organisation using hosted email.',
  category: ProductCategory.SECURITY,
  monthlyPriceCents: 18_000,
  setupPriceCents: 0,
  pricingModel: PricingModel.FLAT,
  minContractMonths: 12,
  maxDiscountBps: 1500,
  bandwidthMbps: null,
  isActive: true,
  sortOrder: 50,
};

const SEC_MDR: SeedProduct = {
  sku: 'SEC-MDR',
  name: 'Managed Detection & Response',
  description:
    '24/7 managed detection and response where Nexora analysts monitor endpoint and network telemetry and actively respond to confirmed threats.',
  category: ProductCategory.SECURITY,
  monthlyPriceCents: 55_000,
  setupPriceCents: 0,
  pricingModel: PricingModel.FLAT,
  minContractMonths: 24,
  maxDiscountBps: 1500,
  bandwidthMbps: null,
  isActive: true,
  sortOrder: 60,
};

const SEC_LEGACY: SeedProduct = {
  sku: 'SEC-LEGACY',
  name: 'Legacy IDS',
  description:
    'A discontinued signature-based intrusion detection appliance, retained in the catalogue only for existing installations still under contract.',
  category: ProductCategory.SECURITY,
  monthlyPriceCents: 15_000,
  setupPriceCents: 0,
  pricingModel: PricingModel.FLAT,
  minContractMonths: 12,
  maxDiscountBps: 1500,
  bandwidthMbps: null,
  isActive: false,
  sortOrder: 70,
};

// ---------------------------------------------------------------------------
// HARDWARE
// ---------------------------------------------------------------------------

const HW_RTR_MGD: SeedProduct = {
  sku: 'HW-RTR-MGD',
  name: 'Managed Router',
  description:
    'A vendor-managed mid-range router suited to single-site businesses on circuits up to 1 Gbps, with configuration and firmware handled by Nexora.',
  category: ProductCategory.HARDWARE,
  monthlyPriceCents: 8_500,
  setupPriceCents: 30_000,
  pricingModel: PricingModel.PER_UNIT,
  minContractMonths: 12,
  maxDiscountBps: 1000,
  bandwidthMbps: null,
  isActive: true,
  sortOrder: 10,
};

const HW_RTR_ENT: SeedProduct = {
  sku: 'HW-RTR-ENT',
  name: 'Enterprise Router',
  description:
    'A high-throughput enterprise router required for 10 Gbps circuits and multi-homed sites needing hardware-level redundancy.',
  category: ProductCategory.HARDWARE,
  monthlyPriceCents: 24_000,
  setupPriceCents: 90_000,
  pricingModel: PricingModel.PER_UNIT,
  minContractMonths: 12,
  maxDiscountBps: 1000,
  bandwidthMbps: null,
  isActive: true,
  sortOrder: 20,
};

const HW_SDWAN_EDGE: SeedProduct = {
  sku: 'HW-SDWAN-EDGE',
  name: 'SD-WAN Edge Device',
  description:
    "The on-site SD-WAN appliance that terminates all circuits at a location and applies the customer's SD-WAN policy locally; required at every SD-WAN site.",
  category: ProductCategory.HARDWARE,
  monthlyPriceCents: 12_000,
  setupPriceCents: 40_000,
  pricingModel: PricingModel.PER_SITE,
  minContractMonths: 12,
  maxDiscountBps: 1000,
  bandwidthMbps: null,
  isActive: true,
  sortOrder: 30,
};

const HW_SWITCH_MGD: SeedProduct = {
  sku: 'HW-SWITCH-MGD',
  name: 'Managed Switch',
  description:
    'A managed Layer 2/3 switch with remote configuration and monitoring, suited to offices needing more wired ports than a router alone can provide.',
  category: ProductCategory.HARDWARE,
  monthlyPriceCents: 7_200,
  setupPriceCents: 25_000,
  pricingModel: PricingModel.PER_UNIT,
  minContractMonths: 12,
  maxDiscountBps: 1000,
  bandwidthMbps: null,
  isActive: true,
  sortOrder: 40,
};

const HW_AP_WIFI6: SeedProduct = {
  sku: 'HW-AP-WIFI6',
  name: 'Wi-Fi 6 Access Point',
  description:
    "A Wi-Fi 6 access point for offices needing higher-density wireless coverage than a router's built-in radio can provide.",
  category: ProductCategory.HARDWARE,
  monthlyPriceCents: 4_500,
  setupPriceCents: 15_000,
  pricingModel: PricingModel.PER_UNIT,
  minContractMonths: 12,
  maxDiscountBps: 1000,
  bandwidthMbps: null,
  isActive: true,
  sortOrder: 50,
};

const HW_ONT: SeedProduct = {
  sku: 'HW-ONT',
  name: 'Optical Network Terminal',
  description:
    'The optical network terminal that converts the incoming fiber signal to Ethernet at the customer premises; required wherever fiber is delivered directly to the site.',
  category: ProductCategory.HARDWARE,
  monthlyPriceCents: 3_000,
  setupPriceCents: 10_000,
  pricingModel: PricingModel.PER_UNIT,
  minContractMonths: 12,
  maxDiscountBps: 1000,
  bandwidthMbps: null,
  isActive: true,
  sortOrder: 60,
};

// ---------------------------------------------------------------------------
// VOICE
// ---------------------------------------------------------------------------

const VOI_SEAT: SeedProduct = {
  sku: 'VOI-SEAT',
  name: 'Business Voice Seat',
  description:
    'A hosted business voice seat including a desk or softphone license, suited to any employee needing a direct business phone line.',
  category: ProductCategory.VOICE,
  monthlyPriceCents: 1_800,
  setupPriceCents: 0,
  pricingModel: PricingModel.PER_UNIT,
  minContractMonths: 12,
  maxDiscountBps: 2000,
  bandwidthMbps: null,
  isActive: true,
  sortOrder: 10,
};

const SIP_TRUNK: SeedProduct = {
  sku: 'SIP-TRUNK',
  name: 'SIP Trunk Channel',
  description:
    "A SIP trunk channel connecting the customer's own PBX to the Nexora voice network, priced per simultaneous call path.",
  category: ProductCategory.VOICE,
  monthlyPriceCents: 2_500,
  setupPriceCents: 0,
  pricingModel: PricingModel.PER_UNIT,
  minContractMonths: 12,
  maxDiscountBps: 2000,
  bandwidthMbps: null,
  isActive: true,
  sortOrder: 20,
};

const VOI_CPBX: SeedProduct = {
  sku: 'VOI-CPBX',
  name: 'Cloud Contact Centre Seat',
  description:
    'A cloud contact-centre seat with call queuing, routing, and reporting for teams handling inbound customer calls.',
  category: ProductCategory.VOICE,
  monthlyPriceCents: 3_900,
  setupPriceCents: 5_000,
  pricingModel: PricingModel.PER_UNIT,
  minContractMonths: 12,
  maxDiscountBps: 2000,
  bandwidthMbps: null,
  isActive: true,
  sortOrder: 30,
};

const VOI_PORT: SeedProduct = {
  sku: 'VOI-PORT',
  name: 'Number Porting',
  description:
    'A one-off service to port an existing phone number from another carrier onto the Nexora voice network.',
  category: ProductCategory.VOICE,
  monthlyPriceCents: 0,
  setupPriceCents: 5_000,
  pricingModel: PricingModel.PER_UNIT,
  minContractMonths: 12,
  maxDiscountBps: 2000,
  bandwidthMbps: null,
  isActive: true,
  sortOrder: 40,
};

// ---------------------------------------------------------------------------
// SUPPORT
// ---------------------------------------------------------------------------

const SUP_STD: SeedProduct = {
  sku: 'SUP-STD',
  name: 'Standard Support',
  description:
    'Business-hours technical support with next-business-day response, suited to customers with in-house IT capability for day-to-day issues.',
  category: ProductCategory.SUPPORT,
  monthlyPriceCents: 9_900,
  setupPriceCents: 0,
  pricingModel: PricingModel.FLAT,
  minContractMonths: 12,
  maxDiscountBps: 2500,
  bandwidthMbps: null,
  isActive: true,
  sortOrder: 10,
};

const SUP_PREM: SeedProduct = {
  sku: 'SUP-PREM',
  name: 'Premium Support',
  description:
    'Extended-hours technical support with 4-hour response times and a named escalation path, suited to businesses with limited in-house IT staff.',
  category: ProductCategory.SUPPORT,
  monthlyPriceCents: 24_900,
  setupPriceCents: 0,
  pricingModel: PricingModel.FLAT,
  minContractMonths: 12,
  maxDiscountBps: 2500,
  bandwidthMbps: null,
  isActive: true,
  sortOrder: 20,
};

const SUP_247: SeedProduct = {
  sku: 'SUP-247',
  name: '24/7 Enterprise Support',
  description:
    'Round-the-clock technical support with 1-hour response for critical incidents, suited to businesses running always-on operations.',
  category: ProductCategory.SUPPORT,
  monthlyPriceCents: 39_900,
  setupPriceCents: 0,
  pricingModel: PricingModel.FLAT,
  minContractMonths: 24,
  maxDiscountBps: 2500,
  bandwidthMbps: null,
  isActive: true,
  sortOrder: 30,
};

const SUP_TAM: SeedProduct = {
  sku: 'SUP-TAM',
  name: 'Technical Account Manager',
  description:
    "A named Technical Account Manager who runs regular service reviews and coordinates escalations on the customer's behalf, layered on top of a support tier.",
  category: ProductCategory.SUPPORT,
  monthlyPriceCents: 55_000,
  setupPriceCents: 0,
  pricingModel: PricingModel.FLAT,
  minContractMonths: 24,
  maxDiscountBps: 2500,
  bandwidthMbps: null,
  isActive: true,
  sortOrder: 40,
};

export const SEED_PRODUCTS: readonly SeedProduct[] = [
  // CONNECTIVITY
  FIB_100,
  FIB_250,
  FIB_500,
  FIB_1G,
  FIB_10G,
  CONN_BACKUP,
  CONN_ETH_DED,
  // SD_WAN
  SDW_STD,
  SDW_ADV,
  SDW_ENT,
  SDW_MGMT,
  // SECURITY
  SEC_SIG,
  SEC_FW,
  SEC_DDOS,
  SEC_ZTNA,
  SEC_EMAIL,
  SEC_MDR,
  SEC_LEGACY,
  // HARDWARE
  HW_RTR_MGD,
  HW_RTR_ENT,
  HW_SDWAN_EDGE,
  HW_SWITCH_MGD,
  HW_AP_WIFI6,
  HW_ONT,
  // VOICE
  VOI_SEAT,
  SIP_TRUNK,
  VOI_CPBX,
  VOI_PORT,
  // SUPPORT
  SUP_STD,
  SUP_PREM,
  SUP_247,
  SUP_TAM,
];
