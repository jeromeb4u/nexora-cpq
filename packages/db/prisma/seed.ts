import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

const packageDir = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(packageDir, '../../../.env'), quiet: true });

import { hashPassword } from 'better-auth/crypto';
import {
  type ConfigurationInput,
  type ContractTerm,
  type ProductSnapshot,
  bpsToRate,
  cents,
  formatMoney,
  formatRate,
  rateToBps,
  Role,
} from '@nexora/types';
import {
  approvedDiscountRate,
  calculatePrice,
  evaluateConfiguration,
  evaluateDiscount,
} from '@nexora/cpq-engine';

import { prisma } from '../src/client';
import type { Product, User } from '../src/generated/prisma/client';
import { SEED_PRODUCTS } from './seed-data/catalogue';
import { SEED_RULES } from './seed-data/rules';
import {
  createRandom,
  daysAgo,
  daysFromNow,
  quoteNumber,
  toProductSnapshot,
} from './seed-helpers';

/**
 * Database seed.
 *
 * Two properties this script is built around:
 *
 *  1. **Deterministic.** A fixed reference date and a seeded PRNG mean the same
 *     database comes out every time. Screenshots, documentation and end-to-end
 *     assertions would all be worthless otherwise.
 *
 *  2. **Genuinely computed.** Every MRR, OTC and TCV below is produced by the
 *     real pricing engine from the real catalogue, and every discount is run
 *     through the real discount engine. Nothing is a hand-typed number that
 *     happens to look plausible (§26, §48). If the engine changes, the demo
 *     data changes with it — and if the seeded data would be invalid under the
 *     configuration rules, this script fails loudly rather than seeding a
 *     broken quote.
 */

/** Fixed reference point so relative dates never drift. */
const NOW = new Date('2026-09-16T09:00:00.000Z');

/** Documented demo password — see README. Deliberately not a secret. */
const DEMO_PASSWORD = 'NexoraDemo123!';

const random = createRandom(20260916);

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

async function reset(): Promise<void> {
  // Ordered so that no foreign key is ever violated. Quote must lose its
  // pointer to currentVersion before versions can be deleted.
  await prisma.quote.updateMany({ data: { currentVersionId: null } });

  await prisma.notification.deleteMany();
  await prisma.auditEvent.deleteMany();
  await prisma.quoteApproval.deleteMany();
  await prisma.quoteItem.deleteMany();
  await prisma.quoteVersion.deleteMany();
  await prisma.quote.deleteMany();
  await prisma.productRuleTarget.deleteMany();
  await prisma.productRule.deleteMany();
  await prisma.product.deleteMany();
  await prisma.customerLocation.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.verification.deleteMany();
  await prisma.user.deleteMany();
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

interface SeedUserSpec {
  readonly email: string;
  readonly name: string;
  readonly role: Role;
  readonly jobTitle: string;
  readonly managerEmail?: string;
}

const USER_SPECS: readonly SeedUserSpec[] = [
  {
    email: 'admin@nexora.demo',
    name: 'Alex Turner',
    role: Role.ADMIN,
    jobTitle: 'Platform Administrator',
  },
  {
    email: 'pricing@nexora.demo',
    name: 'Priya Raman',
    role: Role.PRICING_ADMIN,
    jobTitle: 'Head of Pricing',
  },
  {
    email: 'salesmanager@nexora.demo',
    name: 'Sarah Klein',
    role: Role.SALES_MANAGER,
    jobTitle: 'Regional Sales Manager, DACH',
  },
  {
    email: 'sales@nexora.demo',
    name: 'John Smith',
    role: Role.SALES_REP,
    jobTitle: 'Enterprise Account Executive',
    managerEmail: 'salesmanager@nexora.demo',
  },
  {
    email: 'maria.lopez@nexora.demo',
    name: 'Maria Lopez',
    role: Role.SALES_REP,
    jobTitle: 'Enterprise Account Executive',
    managerEmail: 'salesmanager@nexora.demo',
  },
  {
    email: 'tom.fischer@nexora.demo',
    name: 'Tom Fischer',
    role: Role.SALES_REP,
    jobTitle: 'Account Executive, Mittelstand',
    managerEmail: 'salesmanager@nexora.demo',
  },
];

async function seedUsers(): Promise<Map<string, User>> {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const byEmail = new Map<string, User>();

  // Two passes: create everyone, then wire the reporting lines.
  for (const spec of USER_SPECS) {
    const user = await prisma.user.create({
      data: {
        email: spec.email,
        name: spec.name,
        emailVerified: true,
        role: spec.role,
        jobTitle: spec.jobTitle,
        isActive: true,
        createdAt: daysAgo(NOW, 400),
        accounts: {
          create: {
            // Better Auth stores email/password credentials as an account row
            // with providerId 'credential' and the hash in `password`.
            providerId: 'credential',
            accountId: spec.email,
            password: passwordHash,
          },
        },
      },
    });
    byEmail.set(spec.email, user);
  }

  for (const spec of USER_SPECS) {
    if (!spec.managerEmail) continue;
    const manager = byEmail.get(spec.managerEmail);
    const user = byEmail.get(spec.email);
    if (!manager || !user) continue;

    byEmail.set(
      spec.email,
      await prisma.user.update({
        where: { id: user.id },
        data: { managerId: manager.id },
      }),
    );
  }

  return byEmail;
}

// ---------------------------------------------------------------------------
// Catalogue and rules
// ---------------------------------------------------------------------------

async function seedCatalogue(): Promise<Map<string, Product>> {
  const bySku = new Map<string, Product>();

  for (const spec of SEED_PRODUCTS) {
    const product = await prisma.product.create({ data: { ...spec } });
    bySku.set(product.sku, product);
  }

  return bySku;
}

async function seedRules(productsBySku: Map<string, Product>): Promise<number> {
  /** Resolve a SKU to an id, failing loudly on a typo rather than silently. */
  function idFor(sku: string, context: string): string {
    const product = productsBySku.get(sku);
    if (!product) {
      throw new Error(`Rule "${context}" references unknown product SKU "${sku}".`);
    }
    return product.id;
  }

  for (const rule of SEED_RULES) {
    await prisma.productRule.create({
      data: {
        type: rule.type,
        severity: rule.severity,
        message: rule.message,
        priority: rule.priority,
        isActive: rule.isActive,
        triggerKind: rule.triggerKind,
        triggerProductId: rule.triggerSku ? idFor(rule.triggerSku, rule.key) : null,
        triggerCategory: rule.triggerCategory,
        triggerThreshold: rule.triggerThreshold,
        effectKind: rule.effectKind,
        effectProductId: rule.effectSku ? idFor(rule.effectSku, rule.key) : null,
        effectThreshold: rule.effectThreshold,
        effectServiceability: rule.effectServiceability,
        targets: {
          create: rule.targetSkus.map((sku) => ({
            productId: idFor(sku, rule.key),
          })),
        },
      },
    });
  }

  return SEED_RULES.length;
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

interface SeedCustomerSpec {
  readonly companyName: string;
  readonly legalName: string;
  readonly industry:
    | 'MANUFACTURING'
    | 'FINANCIAL_SERVICES'
    | 'HEALTHCARE'
    | 'RETAIL'
    | 'LOGISTICS'
    | 'PUBLIC_SECTOR'
    | 'TECHNOLOGY'
    | 'ENERGY_UTILITIES'
    | 'PROFESSIONAL_SERVICES'
    | 'EDUCATION';
  readonly vatNumber: string;
  readonly status: 'PROSPECT' | 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
  readonly email: string;
  readonly phone: string;
  readonly website: string;
  readonly ownerEmail: string;
  readonly locations: readonly {
    readonly name: string;
    readonly addressLine1: string;
    readonly city: string;
    readonly postalCode: string;
    readonly country: string;
    readonly contactName: string;
    readonly contactEmail: string;
    readonly serviceability: 'AVAILABLE' | 'LIMITED' | 'UNAVAILABLE' | 'PENDING_CHECK';
    readonly maxBandwidthMbps: number | null;
    readonly existingConnectivity: string | null;
    readonly isPrimary: boolean;
  }[];
}

const CUSTOMER_SPECS: readonly SeedCustomerSpec[] = [
  {
    companyName: 'ACME GmbH',
    legalName: 'ACME Industrieanlagen GmbH',
    industry: 'MANUFACTURING',
    vatNumber: 'DE811234567',
    status: 'ACTIVE',
    email: 'it@acme-gmbh.demo',
    phone: '+49 89 1200 4400',
    website: 'https://acme-gmbh.demo',
    ownerEmail: 'sales@nexora.demo',
    locations: [
      {
        name: 'Munich HQ',
        addressLine1: 'Leopoldstraße 128',
        city: 'München',
        postalCode: '80802',
        country: 'DE',
        contactName: 'Klaus Berger',
        contactEmail: 'k.berger@acme-gmbh.demo',
        serviceability: 'AVAILABLE',
        maxBandwidthMbps: 10_000,
        existingConnectivity: 'Legacy 1 Gbps leased line from incumbent, contract ends Q1.',
        isPrimary: true,
      },
      {
        name: 'Berlin Office',
        addressLine1: 'Friedrichstraße 68',
        city: 'Berlin',
        postalCode: '10117',
        country: 'DE',
        contactName: 'Anja Roth',
        contactEmail: 'a.roth@acme-gmbh.demo',
        serviceability: 'AVAILABLE',
        maxBandwidthMbps: 1_000,
        existingConnectivity: '500 Mbps business broadband.',
        isPrimary: false,
      },
      {
        name: 'Frankfurt Data Centre',
        addressLine1: 'Kleyerstraße 90',
        city: 'Frankfurt am Main',
        postalCode: '60326',
        country: 'DE',
        contactName: 'Stefan Weiss',
        contactEmail: 's.weiss@acme-gmbh.demo',
        serviceability: 'AVAILABLE',
        maxBandwidthMbps: 10_000,
        existingConnectivity: 'Dual 10 Gbps cross-connects to two carriers.',
        isPrimary: false,
      },
    ],
  },
  {
    companyName: 'Nordwind Logistik',
    legalName: 'Nordwind Logistik AG',
    industry: 'LOGISTICS',
    vatNumber: 'DE812345678',
    status: 'ACTIVE',
    email: 'netzwerk@nordwind.demo',
    phone: '+49 40 3300 1200',
    website: 'https://nordwind.demo',
    ownerEmail: 'sales@nexora.demo',
    locations: [
      {
        name: 'Hamburg Port Terminal',
        addressLine1: 'Am Sandtorkai 44',
        city: 'Hamburg',
        postalCode: '20457',
        country: 'DE',
        contactName: 'Lena Voss',
        contactEmail: 'l.voss@nordwind.demo',
        serviceability: 'AVAILABLE',
        maxBandwidthMbps: 1_000,
        existingConnectivity: 'Redundant 500 Mbps fibre pair.',
        isPrimary: true,
      },
      {
        name: 'Bremen Depot',
        addressLine1: 'Hafenstraße 12',
        city: 'Bremen',
        postalCode: '28217',
        country: 'DE',
        contactName: 'Jan Petersen',
        contactEmail: 'j.petersen@nordwind.demo',
        serviceability: 'LIMITED',
        maxBandwidthMbps: 250,
        existingConnectivity: 'Copper VDSL only; fibre build scheduled.',
        isPrimary: false,
      },
    ],
  },
  {
    companyName: 'Helvetia Bankhaus',
    legalName: 'Helvetia Bankhaus AG',
    industry: 'FINANCIAL_SERVICES',
    vatNumber: 'CHE116273849',
    status: 'ACTIVE',
    email: 'infrastructure@helvetia-bank.demo',
    phone: '+41 44 200 1100',
    website: 'https://helvetia-bank.demo',
    ownerEmail: 'maria.lopez@nexora.demo',
    locations: [
      {
        name: 'Zürich Head Office',
        addressLine1: 'Bahnhofstrasse 21',
        city: 'Zürich',
        postalCode: '8001',
        country: 'CH',
        contactName: 'Matthias Good',
        contactEmail: 'm.good@helvetia-bank.demo',
        serviceability: 'AVAILABLE',
        maxBandwidthMbps: 10_000,
        existingConnectivity: 'Dedicated 1 Gbps with a secondary carrier.',
        isPrimary: true,
      },
      {
        name: 'Geneva Branch',
        addressLine1: 'Rue du Rhône 62',
        city: 'Genève',
        postalCode: '1204',
        country: 'CH',
        contactName: 'Céline Dubois',
        contactEmail: 'c.dubois@helvetia-bank.demo',
        serviceability: 'AVAILABLE',
        maxBandwidthMbps: 1_000,
        existingConnectivity: '200 Mbps business fibre.',
        isPrimary: false,
      },
    ],
  },
  {
    companyName: 'Vitalis Klinikgruppe',
    legalName: 'Vitalis Klinikgruppe gGmbH',
    industry: 'HEALTHCARE',
    vatNumber: 'DE813456789',
    status: 'ACTIVE',
    email: 'it@vitalis-kliniken.demo',
    phone: '+49 221 4400 2200',
    website: 'https://vitalis-kliniken.demo',
    ownerEmail: 'maria.lopez@nexora.demo',
    locations: [
      {
        name: 'Köln Central Hospital',
        addressLine1: 'Kerpener Straße 62',
        city: 'Köln',
        postalCode: '50937',
        country: 'DE',
        contactName: 'Dr. Ute Hahn',
        contactEmail: 'u.hahn@vitalis-kliniken.demo',
        serviceability: 'AVAILABLE',
        maxBandwidthMbps: 1_000,
        existingConnectivity: '1 Gbps fibre, single path.',
        isPrimary: true,
      },
      {
        name: 'Bonn Outpatient Centre',
        addressLine1: 'Sigmund-Freud-Straße 25',
        city: 'Bonn',
        postalCode: '53127',
        country: 'DE',
        contactName: 'Peter Adam',
        contactEmail: 'p.adam@vitalis-kliniken.demo',
        serviceability: 'PENDING_CHECK',
        maxBandwidthMbps: null,
        existingConnectivity: null,
        isPrimary: false,
      },
    ],
  },
  {
    companyName: 'Brightline Retail',
    legalName: 'Brightline Retail Group B.V.',
    industry: 'RETAIL',
    vatNumber: 'NL857123456B01',
    status: 'PROSPECT',
    email: 'procurement@brightline.demo',
    phone: '+31 20 700 3300',
    website: 'https://brightline.demo',
    ownerEmail: 'tom.fischer@nexora.demo',
    locations: [
      {
        name: 'Amsterdam Support Office',
        addressLine1: 'Keizersgracht 555',
        city: 'Amsterdam',
        postalCode: '1017 DR',
        country: 'NL',
        contactName: 'Sanne de Vries',
        contactEmail: 's.devries@brightline.demo',
        serviceability: 'AVAILABLE',
        maxBandwidthMbps: 1_000,
        existingConnectivity: '300 Mbps cable.',
        isPrimary: true,
      },
      {
        name: 'Utrecht Distribution Centre',
        addressLine1: 'Proostwetering 20',
        city: 'Utrecht',
        postalCode: '3543 AE',
        country: 'NL',
        contactName: 'Bram Jansen',
        contactEmail: 'b.jansen@brightline.demo',
        serviceability: 'LIMITED',
        maxBandwidthMbps: 500,
        existingConnectivity: 'Shared 200 Mbps.',
        isPrimary: false,
      },
    ],
  },
  {
    companyName: 'Stadtwerke Rheinfels',
    legalName: 'Stadtwerke Rheinfels AöR',
    industry: 'ENERGY_UTILITIES',
    vatNumber: 'DE814567890',
    status: 'ACTIVE',
    email: 'netz@sw-rheinfels.demo',
    phone: '+49 261 5500 1100',
    website: 'https://sw-rheinfels.demo',
    ownerEmail: 'tom.fischer@nexora.demo',
    locations: [
      {
        name: 'Koblenz Control Centre',
        addressLine1: 'Schlossstraße 4',
        city: 'Koblenz',
        postalCode: '56068',
        country: 'DE',
        contactName: 'Heiko Braun',
        contactEmail: 'h.braun@sw-rheinfels.demo',
        serviceability: 'AVAILABLE',
        maxBandwidthMbps: 1_000,
        existingConnectivity: 'Private fibre ring, ageing equipment.',
        isPrimary: true,
      },
      {
        name: 'Andernach Substation',
        addressLine1: 'Industriestraße 8',
        city: 'Andernach',
        postalCode: '56626',
        country: 'DE',
        contactName: 'Nina Krause',
        contactEmail: 'n.krause@sw-rheinfels.demo',
        serviceability: 'UNAVAILABLE',
        maxBandwidthMbps: null,
        existingConnectivity: 'No fibre in the street; microwave link only.',
        isPrimary: false,
      },
    ],
  },
  {
    companyName: 'Lumen Software',
    legalName: 'Lumen Software Solutions GmbH',
    industry: 'TECHNOLOGY',
    vatNumber: 'DE815678901',
    status: 'ACTIVE',
    email: 'ops@lumensoftware.demo',
    phone: '+49 30 8800 4400',
    website: 'https://lumensoftware.demo',
    ownerEmail: 'sales@nexora.demo',
    locations: [
      {
        name: 'Berlin Engineering Hub',
        addressLine1: 'Prenzlauer Allee 186',
        city: 'Berlin',
        postalCode: '10405',
        country: 'DE',
        contactName: 'Felix Adler',
        contactEmail: 'f.adler@lumensoftware.demo',
        serviceability: 'AVAILABLE',
        maxBandwidthMbps: 10_000,
        existingConnectivity: '1 Gbps symmetric fibre.',
        isPrimary: true,
      },
    ],
  },
  {
    companyName: 'Universität Marbach',
    legalName: 'Universität Marbach, Körperschaft des öffentlichen Rechts',
    industry: 'EDUCATION',
    vatNumber: 'DE816789012',
    status: 'PROSPECT',
    email: 'rechenzentrum@uni-marbach.demo',
    phone: '+49 711 6600 2200',
    website: 'https://uni-marbach.demo',
    ownerEmail: 'maria.lopez@nexora.demo',
    locations: [
      {
        name: 'Main Campus Computing Centre',
        addressLine1: 'Universitätsstraße 1',
        city: 'Marbach',
        postalCode: '71672',
        country: 'DE',
        contactName: 'Dr. Ingo Reuter',
        contactEmail: 'i.reuter@uni-marbach.demo',
        serviceability: 'AVAILABLE',
        maxBandwidthMbps: 10_000,
        existingConnectivity: 'Research network uplink, commodity internet separate.',
        isPrimary: true,
      },
      {
        name: 'Medical Faculty Annexe',
        addressLine1: 'Klinikweg 7',
        city: 'Marbach',
        postalCode: '71672',
        country: 'DE',
        contactName: 'Sonja Mertens',
        contactEmail: 's.mertens@uni-marbach.demo',
        serviceability: 'PENDING_CHECK',
        maxBandwidthMbps: null,
        existingConnectivity: null,
        isPrimary: false,
      },
    ],
  },
  {
    companyName: 'Kanzlei Hoffmann & Partner',
    legalName: 'Hoffmann & Partner Rechtsanwälte mbB',
    industry: 'PROFESSIONAL_SERVICES',
    vatNumber: 'DE817890123',
    status: 'INACTIVE',
    email: 'edv@hoffmann-partner.demo',
    phone: '+49 69 2200 5500',
    website: 'https://hoffmann-partner.demo',
    ownerEmail: 'tom.fischer@nexora.demo',
    locations: [
      {
        name: 'Frankfurt Office',
        addressLine1: 'Bockenheimer Landstraße 24',
        city: 'Frankfurt am Main',
        postalCode: '60323',
        country: 'DE',
        contactName: 'Martin Hoffmann',
        contactEmail: 'm.hoffmann@hoffmann-partner.demo',
        serviceability: 'AVAILABLE',
        maxBandwidthMbps: 500,
        existingConnectivity: '200 Mbps business line.',
        isPrimary: true,
      },
    ],
  },
  {
    companyName: 'Bezirksamt Lindau',
    legalName: 'Bezirksamt Lindau, Körperschaft des öffentlichen Rechts',
    industry: 'PUBLIC_SECTOR',
    vatNumber: 'DE818901234',
    status: 'SUSPENDED',
    email: 'it@ba-lindau.demo',
    phone: '+49 8382 9900 1100',
    website: 'https://ba-lindau.demo',
    ownerEmail: 'tom.fischer@nexora.demo',
    locations: [
      {
        name: 'Lindau Town Hall',
        addressLine1: 'Bregenzer Straße 6',
        city: 'Lindau',
        postalCode: '88131',
        country: 'DE',
        contactName: 'Gerd Sommer',
        contactEmail: 'g.sommer@ba-lindau.demo',
        serviceability: 'LIMITED',
        maxBandwidthMbps: 250,
        existingConnectivity: 'Municipal network, 100 Mbps.',
        isPrimary: true,
      },
      {
        name: 'Civic Archive',
        addressLine1: 'Fischergasse 3',
        city: 'Lindau',
        postalCode: '88131',
        country: 'DE',
        contactName: 'Renate Bauer',
        contactEmail: 'r.bauer@ba-lindau.demo',
        serviceability: 'PENDING_CHECK',
        maxBandwidthMbps: null,
        existingConnectivity: null,
        isPrimary: false,
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Quote construction
// ---------------------------------------------------------------------------

interface BuildQuoteArgs {
  readonly index: number;
  readonly customerId: string;
  readonly locationId: string;
  readonly owner: User;
  readonly title: string;
  readonly status:
    | 'DRAFT'
    | 'CONFIGURING'
    | 'READY_FOR_REVIEW'
    | 'APPROVAL_REQUIRED'
    | 'APPROVED'
    | 'REJECTED'
    | 'SENT_TO_CUSTOMER'
    | 'ACCEPTED'
    | 'EXPIRED'
    | 'CANCELLED';
  readonly skus: readonly { readonly sku: string; readonly quantity: number }[];
  readonly contractMonths: ContractTerm;
  readonly requestedDiscountBps: number;
  readonly discountReason: string | null;
  readonly serviceability: 'AVAILABLE' | 'LIMITED' | 'UNAVAILABLE' | 'PENDING_CHECK';
  readonly siteCount: number;
  readonly createdDaysAgo: number;
  /** Prior versions to create before the current one, as discount deltas. */
  readonly priorVersionDiscountsBps?: readonly number[];
}

/**
 * Create a quote, its version history and its line items.
 *
 * The configuration is validated and priced by the real engines. A seeded quote
 * that would be rejected by the configuration rules aborts the seed, because
 * shipping a demo whose flagship quote shows blocking errors is worse than
 * failing here.
 */
async function buildQuote(
  args: BuildQuoteArgs,
  productsBySku: Map<string, Product>,
  catalogue: readonly ProductSnapshot[],
): Promise<{ quoteId: string; currentVersionId: string; mrrCents: number }> {
  const selections = args.skus.map(({ sku, quantity }) => {
    const product = productsBySku.get(sku);
    if (!product) throw new Error(`Quote "${args.title}" references unknown SKU "${sku}".`);
    return { productId: product.id, quantity };
  });

  const configuration: ConfigurationInput = {
    selections,
    contractMonths: args.contractMonths,
    serviceability: args.serviceability,
    siteCount: args.siteCount,
  };

  // Validate against the real rule set, using the rules already in the database.
  const dbRules = await loadRules();
  const validation = evaluateConfiguration(configuration, catalogue, dbRules);
  const blocking = validation.findings.filter((finding) => finding.blocking);
  if (blocking.length > 0 && args.status !== 'DRAFT' && args.status !== 'CONFIGURING') {
    throw new Error(
      `Seeded quote "${args.title}" is not a valid configuration:\n` +
        blocking.map((finding) => `  - ${finding.message}`).join('\n'),
    );
  }

  const selectedProducts = selections
    .map((selection) => catalogue.find((product) => product.id === selection.productId))
    .filter((product): product is ProductSnapshot => product !== undefined);

  const quote = await prisma.quote.create({
    data: {
      quoteNumber: quoteNumber(args.index),
      status: args.status,
      title: args.title,
      customerId: args.customerId,
      locationId: args.locationId,
      ownerId: args.owner.id,
      createdAt: daysAgo(NOW, args.createdDaysAgo),
      updatedAt: daysAgo(NOW, Math.max(0, args.createdDaysAgo - 3)),
      validUntil:
        args.status === 'SENT_TO_CUSTOMER' || args.status === 'ACCEPTED'
          ? daysFromNow(NOW, 21)
          : args.status === 'EXPIRED'
            ? daysAgo(NOW, 5)
            : null,
      sentAt:
        args.status === 'SENT_TO_CUSTOMER' || args.status === 'ACCEPTED' || args.status === 'EXPIRED'
          ? daysAgo(NOW, Math.max(1, args.createdDaysAgo - 6))
          : null,
      acceptedAt: args.status === 'ACCEPTED' ? daysAgo(NOW, 2) : null,
    },
  });

  const discountLadder = [...(args.priorVersionDiscountsBps ?? []), args.requestedDiscountBps];
  let currentVersionId = '';
  let currentMrr = 0;

  for (const [versionIndex, discountBps] of discountLadder.entries()) {
    const isCurrent = versionIndex === discountLadder.length - 1;

    // Price it exactly the way the application would.
    const evaluation = evaluateDiscount({
      requestedBps: discountBps,
      role: args.owner.role,
      selectedProducts,
      tcv: cents(0), // provisional; the value trigger is re-checked below
    });

    const price = calculatePrice({
      configuration,
      catalogue,
      approvedManualRate: approvedDiscountRate({
        requestedBps: discountBps,
        role: args.owner.role,
        selectedProducts,
        tcv: cents(0),
      }),
    });

    const version = await prisma.quoteVersion.create({
      data: {
        quoteId: quote.id,
        versionNumber: versionIndex + 1,
        contractMonths: args.contractMonths,
        discountBps,
        discountReason: args.discountReason,
        grossMonthlyCents: price.grossMonthly,
        grossSetupCents: price.grossSetup,
        discountMonthlyCents: price.discountMonthly,
        mrrCents: price.mrr,
        otcCents: price.otc,
        tcvCents: price.tcv,
        effectiveDiscountBps: rateToBps(price.effectiveDiscountRate),
        createdById: args.owner.id,
        createdAt: daysAgo(NOW, args.createdDaysAgo - versionIndex * 2),
        supersededAt: isCurrent ? null : daysAgo(NOW, args.createdDaysAgo - versionIndex * 2 - 1),
        configSnapshot: {
          findings: validation.findings.map((finding) => ({
            ruleId: finding.ruleId,
            severity: finding.severity,
            message: finding.message,
          })),
          discounts: price.discounts.map((discount) => ({
            code: discount.code,
            label: discount.label,
            rate: discount.rate,
            amountCents: discount.amount,
          })),
          discountEvaluation: {
            requestedRate: evaluation.requestedRate,
            allowedRate: evaluation.allowedRate,
            requiresApproval: evaluation.requiresApproval,
            explanation: evaluation.explanation,
          },
          serviceability: args.serviceability,
          siteCount: args.siteCount,
        },
        items: {
          create: price.lines.map((line, lineIndex) => ({
            productId: line.productId,
            quantity: line.quantity,
            unitMonthlyCents: line.unitMonthlyPrice,
            unitSetupCents: line.unitSetupPrice,
            monthlyCents: line.monthlySubtotal,
            setupCents: line.setupSubtotal,
            skuSnapshot: line.sku,
            nameSnapshot: line.name,
            sortOrder: lineIndex,
          })),
        },
      },
    });

    if (isCurrent) {
      currentVersionId = version.id;
      currentMrr = price.mrr;
    }
  }

  await prisma.quote.update({
    where: { id: quote.id },
    data: { currentVersionId },
  });

  return { quoteId: quote.id, currentVersionId, mrrCents: currentMrr };
}

/** Load the persisted rules back into the engine's shape. */
async function loadRules() {
  const rows = await prisma.productRule.findMany({ include: { targets: true } });

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    message: row.message,
    severity: row.severity,
    isActive: row.isActive,
    priority: row.priority,
    trigger: buildTrigger(row),
    effect: buildEffect(row),
  }));
}

type RuleRow = Awaited<ReturnType<typeof prisma.productRule.findMany>>[number] & {
  targets: { productId: string }[];
};

function buildTrigger(row: RuleRow) {
  switch (row.triggerKind) {
    case 'PRODUCT_SELECTED':
      return { kind: 'PRODUCT_SELECTED' as const, productId: row.triggerProductId ?? '' };
    case 'CATEGORY_SELECTED':
      return { kind: 'CATEGORY_SELECTED' as const, category: row.triggerCategory ?? 'CONNECTIVITY' };
    case 'BANDWIDTH_AT_LEAST':
      return { kind: 'BANDWIDTH_AT_LEAST' as const, mbps: row.triggerThreshold ?? 0 };
    case 'CONTRACT_TERM_AT_LEAST':
      return { kind: 'CONTRACT_TERM_AT_LEAST' as const, months: row.triggerThreshold ?? 0 };
    case 'ALWAYS':
      return { kind: 'ALWAYS' as const };
  }
}

function buildEffect(row: RuleRow) {
  switch (row.effectKind) {
    case 'REQUIRES_PRODUCT':
      return { kind: 'REQUIRES_PRODUCT' as const, productId: row.effectProductId ?? '' };
    case 'REQUIRES_ONE_OF':
      return {
        kind: 'REQUIRES_ONE_OF' as const,
        productIds: row.targets.map((target) => target.productId),
      };
    case 'INCOMPATIBLE_WITH_PRODUCT':
      return {
        kind: 'INCOMPATIBLE_WITH_PRODUCT' as const,
        productId: row.effectProductId ?? '',
      };
    case 'RECOMMENDS_PRODUCT':
      return { kind: 'RECOMMENDS_PRODUCT' as const, productId: row.effectProductId ?? '' };
    case 'AT_MOST_ONE_OF':
      return {
        kind: 'AT_MOST_ONE_OF' as const,
        productIds: row.targets.map((target) => target.productId),
      };
    case 'MIN_CONTRACT_MONTHS':
      return { kind: 'MIN_CONTRACT_MONTHS' as const, months: row.effectThreshold ?? 12 };
    case 'MIN_SERVICEABILITY':
      return {
        kind: 'MIN_SERVICEABILITY' as const,
        level: row.effectServiceability ?? 'AVAILABLE',
      };
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  process.stdout.write('Resetting database…\n');
  await reset();

  process.stdout.write('Seeding users…\n');
  const users = await seedUsers();

  process.stdout.write('Seeding catalogue…\n');
  const productsBySku = await seedCatalogue();
  const catalogue = [...productsBySku.values()].map(toProductSnapshot);

  process.stdout.write('Seeding compatibility rules…\n');
  const ruleCount = await seedRules(productsBySku);

  process.stdout.write('Seeding customers and locations…\n');
  const customerIds = new Map<string, string>();
  const locationIds = new Map<string, string>();

  for (const spec of CUSTOMER_SPECS) {
    const owner = users.get(spec.ownerEmail);
    if (!owner) throw new Error(`Unknown account owner ${spec.ownerEmail}`);

    const customer = await prisma.customer.create({
      data: {
        companyName: spec.companyName,
        legalName: spec.legalName,
        industry: spec.industry,
        vatNumber: spec.vatNumber,
        status: spec.status,
        email: spec.email,
        phone: spec.phone,
        website: spec.website,
        accountOwnerId: owner.id,
        createdAt: daysAgo(NOW, 200 + Math.floor(random() * 150)),
        locations: {
          create: spec.locations.map((location) => ({
            name: location.name,
            addressLine1: location.addressLine1,
            city: location.city,
            postalCode: location.postalCode,
            country: location.country,
            contactName: location.contactName,
            contactEmail: location.contactEmail,
            existingConnectivity: location.existingConnectivity,
            serviceability: location.serviceability,
            maxBandwidthMbps: location.maxBandwidthMbps,
            isPrimary: location.isPrimary,
          })),
        },
      },
      include: { locations: true },
    });

    customerIds.set(spec.companyName, customer.id);
    for (const location of customer.locations) {
      locationIds.set(`${spec.companyName}::${location.name}`, location.id);
    }
  }

  process.stdout.write('Seeding quotes…\n');
  await seedQuotes({ users, customerIds, locationIds, productsBySku, catalogue });

  const counts = {
    users: await prisma.user.count(),
    customers: await prisma.customer.count(),
    locations: await prisma.customerLocation.count(),
    products: await prisma.product.count(),
    rules: ruleCount,
    quotes: await prisma.quote.count(),
    versions: await prisma.quoteVersion.count(),
    items: await prisma.quoteItem.count(),
    approvals: await prisma.quoteApproval.count(),
    auditEvents: await prisma.auditEvent.count(),
    notifications: await prisma.notification.count(),
  };

  process.stdout.write('\nSeed complete.\n');
  for (const [label, value] of Object.entries(counts)) {
    process.stdout.write(`  ${label.padEnd(14)} ${value}\n`);
  }
  process.stdout.write(`\n  Demo password for every account: ${DEMO_PASSWORD}\n`);
}

// The quote scenarios are large enough to deserve their own module-level
// function rather than inflating main().
async function seedQuotes(context: {
  users: Map<string, User>;
  customerIds: Map<string, string>;
  locationIds: Map<string, string>;
  productsBySku: Map<string, Product>;
  catalogue: readonly ProductSnapshot[];
}): Promise<void> {
  const { users, customerIds, locationIds, productsBySku, catalogue } = context;

  const john = users.get('sales@nexora.demo');
  const sarah = users.get('salesmanager@nexora.demo');
  const maria = users.get('maria.lopez@nexora.demo');
  const tom = users.get('tom.fischer@nexora.demo');
  if (!john || !sarah || !maria || !tom) throw new Error('Seed users missing');

  function customer(name: string): string {
    const id = customerIds.get(name);
    if (!id) throw new Error(`Unknown customer ${name}`);
    return id;
  }
  function location(customerName: string, locationName: string): string {
    const id = locationIds.get(`${customerName}::${locationName}`);
    if (!id) throw new Error(`Unknown location ${customerName}/${locationName}`);
    return id;
  }

  /* -----------------------------------------------------------------------
   * QT-10482 — the flagship scenario (§46).
   *
   * ACME GmbH, Munich HQ, 36 months, 18% requested by a Sales Rep whose own
   * authority is 10%. That exceeds their threshold, so the quote sits in
   * APPROVAL_REQUIRED with a real pending approval for Sarah to decide.
   *
   * The SD-WAN Edge Device and Secure Internet Gateway are included because the
   * rule set requires them (SD-WAN needs an edge device; DDoS needs the
   * gateway). The specification's product list omits both — including them is
   * what makes the flagship quote actually pass validation.
   * --------------------------------------------------------------------- */
  const acme = await buildQuote(
    {
      index: 12,
      customerId: customer('ACME GmbH'),
      locationId: location('ACME GmbH', 'Munich HQ'),
      owner: john,
      title: 'ACME GmbH — Munich HQ network modernisation',
      status: 'APPROVAL_REQUIRED',
      skus: [
        { sku: 'FIB-10G', quantity: 1 },
        { sku: 'SDW-ENT', quantity: 1 },
        { sku: 'HW-SDWAN-EDGE', quantity: 1 },
        { sku: 'SEC-FW', quantity: 1 },
        { sku: 'SEC-DDOS', quantity: 1 },
        { sku: 'SEC-SIG', quantity: 1 },
        { sku: 'HW-RTR-ENT', quantity: 2 },
        { sku: 'SUP-PREM', quantity: 1 },
      ],
      contractMonths: 36,
      requestedDiscountBps: 1_800,
      discountReason:
        'Competitive bid against the incumbent, who has quoted aggressively on a like-for-like 10 Gbps package. Losing Munich HQ would put the Berlin and Frankfurt sites at risk too.',
      serviceability: 'AVAILABLE',
      siteCount: 1,
      createdDaysAgo: 9,
      // Three versions: the discount was negotiated upward over two revisions.
      priorVersionDiscountsBps: [800, 1_200],
    },
    productsBySku,
    catalogue,
  );

  const acmeVersion = await prisma.quoteVersion.findUniqueOrThrow({
    where: { id: acme.currentVersionId },
  });

  const approval = await prisma.quoteApproval.create({
    data: {
      quoteId: acme.quoteId,
      quoteVersionId: acme.currentVersionId,
      decision: 'PENDING',
      reason: 'DISCOUNT_EXCEEDS_THRESHOLD',
      requestedDiscountBps: 1_800,
      allowedDiscountBps: 1_000,
      mrrCentsSnapshot: acmeVersion.mrrCents,
      justification:
        'Competitive bid against the incumbent. Approving 18% keeps the three-site footprint intact.',
      requestedById: john.id,
      createdAt: daysAgo(NOW, 2),
    },
  });

  await prisma.notification.create({
    data: {
      type: 'APPROVAL_REQUESTED',
      title: `Approval requested on ${quoteNumber(12)}`,
      body: `${john.name} requested ${formatRate(0.18)} on ACME GmbH — ${formatMoney(cents(acmeVersion.mrrCents))} per month.`,
      href: `/approvals/${approval.id}`,
      userId: sarah.id,
      createdAt: daysAgo(NOW, 2),
    },
  });

  await prisma.auditEvent.createMany({
    data: [
      {
        action: 'QUOTE_CREATED',
        entity: 'QUOTE',
        entityId: acme.quoteId,
        actorId: john.id,
        summary: `Created quote ${quoteNumber(12)} for ACME GmbH`,
        createdAt: daysAgo(NOW, 9),
      },
      {
        action: 'DISCOUNT_CHANGED',
        entity: 'QUOTE',
        entityId: acme.quoteId,
        actorId: john.id,
        summary: 'Discount changed 8% → 12%',
        metadata: { fromBps: 800, toBps: 1_200 },
        createdAt: daysAgo(NOW, 5),
      },
      {
        action: 'DISCOUNT_CHANGED',
        entity: 'QUOTE',
        entityId: acme.quoteId,
        actorId: john.id,
        summary: 'Discount changed 12% → 18%',
        metadata: { fromBps: 1_200, toBps: 1_800 },
        createdAt: daysAgo(NOW, 2),
      },
      {
        action: 'APPROVAL_REQUESTED',
        entity: 'QUOTE_APPROVAL',
        entityId: approval.id,
        actorId: john.id,
        summary: `Approval requested — 18% exceeds the 10% Sales Representative threshold`,
        metadata: { requestedBps: 1_800, allowedBps: 1_000 },
        createdAt: daysAgo(NOW, 2),
      },
    ],
  });

  /* -----------------------------------------------------------------------
   * The remaining quotes, spread across every status so each list filter,
   * badge and empty state has real data behind it.
   * --------------------------------------------------------------------- */
  const others: readonly BuildQuoteArgs[] = [
    {
      index: 1,
      customerId: customer('Nordwind Logistik'),
      locationId: location('Nordwind Logistik', 'Hamburg Port Terminal'),
      owner: john,
      title: 'Nordwind Logistik — Hamburg terminal uplift',
      status: 'ACCEPTED',
      skus: [
        { sku: 'FIB-1G', quantity: 1 },
        { sku: 'HW-RTR-MGD', quantity: 1 },
        { sku: 'SEC-FW', quantity: 1 },
        { sku: 'SUP-STD', quantity: 1 },
      ],
      contractMonths: 36,
      requestedDiscountBps: 600,
      discountReason: 'Volume commitment across two sites.',
      serviceability: 'AVAILABLE',
      siteCount: 1,
      createdDaysAgo: 64,
    },
    {
      index: 3,
      customerId: customer('Helvetia Bankhaus'),
      locationId: location('Helvetia Bankhaus', 'Zürich Head Office'),
      owner: maria,
      title: 'Helvetia Bankhaus — Zürich resilience programme',
      status: 'SENT_TO_CUSTOMER',
      skus: [
        { sku: 'FIB-10G', quantity: 1 },
        { sku: 'HW-RTR-ENT', quantity: 2 },
        { sku: 'SEC-FW', quantity: 1 },
        { sku: 'SEC-DDOS', quantity: 1 },
        { sku: 'SEC-SIG', quantity: 1 },
        { sku: 'SUP-247', quantity: 1 },
      ],
      contractMonths: 60,
      requestedDiscountBps: 1_500,
      discountReason: 'Five-year commitment with an option on the Geneva branch.',
      serviceability: 'AVAILABLE',
      siteCount: 1,
      createdDaysAgo: 30,
      priorVersionDiscountsBps: [1_000],
    },
    {
      index: 5,
      customerId: customer('Vitalis Klinikgruppe'),
      locationId: location('Vitalis Klinikgruppe', 'Köln Central Hospital'),
      owner: maria,
      title: 'Vitalis Klinikgruppe — Köln clinical network',
      status: 'APPROVED',
      skus: [
        { sku: 'FIB-1G', quantity: 1 },
        { sku: 'HW-RTR-MGD', quantity: 1 },
        { sku: 'SEC-FW', quantity: 1 },
        { sku: 'SEC-MDR', quantity: 1 },
        { sku: 'SUP-PREM', quantity: 1 },
      ],
      contractMonths: 48,
      requestedDiscountBps: 1_400,
      discountReason: 'Public healthcare framework pricing.',
      serviceability: 'AVAILABLE',
      siteCount: 1,
      createdDaysAgo: 21,
    },
    {
      index: 7,
      customerId: customer('Brightline Retail'),
      locationId: location('Brightline Retail', 'Amsterdam Support Office'),
      owner: tom,
      title: 'Brightline Retail — Amsterdam and Utrecht',
      status: 'READY_FOR_REVIEW',
      skus: [
        { sku: 'FIB-500', quantity: 1 },
        { sku: 'HW-RTR-MGD', quantity: 1 },
        { sku: 'SEC-FW', quantity: 1 },
        { sku: 'SUP-STD', quantity: 1 },
      ],
      contractMonths: 24,
      requestedDiscountBps: 500,
      discountReason: 'Standard new-logo incentive.',
      serviceability: 'AVAILABLE',
      siteCount: 2,
      createdDaysAgo: 6,
    },
    {
      index: 9,
      customerId: customer('Stadtwerke Rheinfels'),
      locationId: location('Stadtwerke Rheinfels', 'Koblenz Control Centre'),
      owner: tom,
      title: 'Stadtwerke Rheinfels — control centre connectivity',
      status: 'CONFIGURING',
      skus: [
        { sku: 'FIB-1G', quantity: 1 },
        { sku: 'HW-RTR-MGD', quantity: 1 },
      ],
      contractMonths: 36,
      requestedDiscountBps: 0,
      discountReason: null,
      serviceability: 'AVAILABLE',
      siteCount: 1,
      createdDaysAgo: 3,
    },
    {
      index: 11,
      customerId: customer('Lumen Software'),
      locationId: location('Lumen Software', 'Berlin Engineering Hub'),
      owner: john,
      title: 'Lumen Software — Berlin hub 10G upgrade',
      status: 'DRAFT',
      skus: [{ sku: 'FIB-10G', quantity: 1 }],
      contractMonths: 36,
      requestedDiscountBps: 0,
      discountReason: null,
      serviceability: 'AVAILABLE',
      siteCount: 1,
      createdDaysAgo: 1,
    },
    {
      index: 14,
      customerId: customer('Universität Marbach'),
      locationId: location('Universität Marbach', 'Main Campus Computing Centre'),
      owner: maria,
      title: 'Universität Marbach — campus commodity internet',
      status: 'REJECTED',
      skus: [
        { sku: 'FIB-10G', quantity: 1 },
        { sku: 'HW-RTR-ENT', quantity: 1 },
        { sku: 'SUP-STD', quantity: 1 },
      ],
      contractMonths: 36,
      requestedDiscountBps: 2_600,
      discountReason: 'Public tender; the incumbent bid substantially lower.',
      serviceability: 'AVAILABLE',
      siteCount: 1,
      createdDaysAgo: 40,
    },
    {
      index: 16,
      customerId: customer('Kanzlei Hoffmann & Partner'),
      locationId: location('Kanzlei Hoffmann & Partner', 'Frankfurt Office'),
      owner: tom,
      title: 'Kanzlei Hoffmann & Partner — office renewal',
      status: 'EXPIRED',
      skus: [
        { sku: 'FIB-250', quantity: 1 },
        { sku: 'HW-RTR-MGD', quantity: 1 },
        { sku: 'SUP-STD', quantity: 1 },
      ],
      contractMonths: 24,
      requestedDiscountBps: 400,
      discountReason: 'Renewal retention offer.',
      serviceability: 'AVAILABLE',
      siteCount: 1,
      createdDaysAgo: 75,
    },
    {
      index: 18,
      customerId: customer('Bezirksamt Lindau'),
      locationId: location('Bezirksamt Lindau', 'Lindau Town Hall'),
      owner: tom,
      title: 'Bezirksamt Lindau — town hall connectivity',
      status: 'CANCELLED',
      skus: [
        { sku: 'FIB-250', quantity: 1 },
        { sku: 'HW-RTR-MGD', quantity: 1 },
      ],
      contractMonths: 36,
      requestedDiscountBps: 0,
      discountReason: null,
      serviceability: 'LIMITED',
      siteCount: 1,
      createdDaysAgo: 88,
    },
    {
      index: 20,
      customerId: customer('ACME GmbH'),
      locationId: location('ACME GmbH', 'Frankfurt Data Centre'),
      owner: john,
      title: 'ACME GmbH — Frankfurt data centre interconnect',
      status: 'READY_FOR_REVIEW',
      skus: [
        { sku: 'FIB-10G', quantity: 2 },
        { sku: 'HW-RTR-ENT', quantity: 2 },
        { sku: 'SEC-DDOS', quantity: 1 },
        { sku: 'SEC-SIG', quantity: 1 },
        { sku: 'SUP-247', quantity: 1 },
      ],
      contractMonths: 36,
      requestedDiscountBps: 900,
      discountReason: 'Bundled with the Munich HQ opportunity.',
      serviceability: 'AVAILABLE',
      siteCount: 1,
      createdDaysAgo: 8,
    },
  ];

  for (const spec of others) {
    const built = await buildQuote(spec, productsBySku, catalogue);

    await prisma.auditEvent.create({
      data: {
        action: 'QUOTE_CREATED',
        entity: 'QUOTE',
        entityId: built.quoteId,
        actorId: spec.owner.id,
        summary: `Created quote ${quoteNumber(spec.index)}`,
        createdAt: daysAgo(NOW, spec.createdDaysAgo),
      },
    });

    if (spec.status === 'APPROVED' || spec.status === 'REJECTED') {
      const version = await prisma.quoteVersion.findUniqueOrThrow({
        where: { id: built.currentVersionId },
      });
      const decided = spec.status === 'APPROVED';

      const record = await prisma.quoteApproval.create({
        data: {
          quoteId: built.quoteId,
          quoteVersionId: built.currentVersionId,
          decision: decided ? 'APPROVED' : 'REJECTED',
          reason: 'DISCOUNT_EXCEEDS_THRESHOLD',
          requestedDiscountBps: spec.requestedDiscountBps,
          allowedDiscountBps: 1_000,
          mrrCentsSnapshot: version.mrrCents,
          justification: spec.discountReason ?? 'Escalated for review.',
          decisionNote: decided
            ? null
            : 'Margin at 26% is below the floor for this segment. Re-bid at no more than 20% or add a 60-month term.',
          requestedById: spec.owner.id,
          decidedById: sarah.id,
          decidedAt: daysAgo(NOW, Math.max(1, spec.createdDaysAgo - 10)),
          createdAt: daysAgo(NOW, Math.max(2, spec.createdDaysAgo - 12)),
        },
      });

      await prisma.auditEvent.create({
        data: {
          action: decided ? 'APPROVAL_GRANTED' : 'APPROVAL_REJECTED',
          entity: 'QUOTE_APPROVAL',
          entityId: record.id,
          actorId: sarah.id,
          summary: decided
            ? `Approved ${formatRate(bpsToRate(spec.requestedDiscountBps))} discount`
            : `Rejected ${formatRate(bpsToRate(spec.requestedDiscountBps))} discount`,
          createdAt: daysAgo(NOW, Math.max(1, spec.createdDaysAgo - 10)),
        },
      });

      await prisma.notification.create({
        data: {
          type: decided ? 'APPROVAL_GRANTED' : 'APPROVAL_REJECTED',
          title: decided
            ? `${quoteNumber(spec.index)} approved`
            : `${quoteNumber(spec.index)} rejected`,
          body: decided
            ? `${sarah.name} approved your ${formatRate(bpsToRate(spec.requestedDiscountBps))} discount.`
            : `${sarah.name} rejected your ${formatRate(bpsToRate(spec.requestedDiscountBps))} discount.`,
          href: `/quotes/${built.quoteId}`,
          userId: spec.owner.id,
          readAt: decided ? daysAgo(NOW, 9) : null,
          createdAt: daysAgo(NOW, Math.max(1, spec.createdDaysAgo - 10)),
        },
      });
    }

    if (spec.status === 'SENT_TO_CUSTOMER' || spec.status === 'ACCEPTED') {
      await prisma.auditEvent.create({
        data: {
          action: 'QUOTE_SENT',
          entity: 'QUOTE',
          entityId: built.quoteId,
          actorId: spec.owner.id,
          summary: `Sent ${quoteNumber(spec.index)} to the customer`,
          createdAt: daysAgo(NOW, Math.max(1, spec.createdDaysAgo - 6)),
        },
      });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    process.stderr.write(`\nSeed failed: ${error instanceof Error ? error.message : String(error)}\n`);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
