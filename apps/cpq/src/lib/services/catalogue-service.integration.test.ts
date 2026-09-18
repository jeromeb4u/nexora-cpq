import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@nexora/db';
import type { Actor } from '@nexora/auth/session';
import { type ErrorCode, isAppError } from '@nexora/observability';

import { USERS, acmeMunich, actorFor, bundleSelections, productIds } from '@/test/fixtures';
import {
  createProduct,
  createRule,
  setProductActive,
  setRuleActive,
  updateProduct,
  updateRule,
} from './catalogue-service';
import { createQuote, saveConfiguration } from './quote-service';

/**
 * Catalogue and rule administration against real PostgreSQL.
 *
 * The rules that only prove out here: who may change the catalogue, that SKUs
 * are unique, that a rule's stored `type` is derived rather than supplied, that
 * target groups are replaced rather than merged, and that withdrawing a product
 * reports what it disturbs.
 */

async function expectAppError(promise: Promise<unknown>, code: ErrorCode) {
  const error = await promise.then(
    () => null,
    (thrown: unknown) => thrown,
  );
  expect(isAppError(error), `expected an AppError ${code}, got ${String(error)}`).toBe(true);
  if (isAppError(error)) expect(error.code).toBe(code);
}

/** Schema failures surface as ZodError; the action wrapper turns them into VALIDATION. */
async function expectSchemaRejection(promise: Promise<unknown>, fragment: string) {
  const error = await promise.then(
    () => null,
    (thrown: unknown) => thrown,
  );
  expect(error).toBeInstanceOf(Error);
  expect((error as Error).name).toBe('ZodError');
  expect((error as Error).message).toContain(fragment);
}

let rep: Actor;
let pricingAdmin: Actor;

beforeAll(async () => {
  [rep, pricingAdmin] = await Promise.all([actorFor(USERS.rep), actorFor(USERS.pricingAdmin)]);
});

afterAll(async () => {
  await prisma.$disconnect();
});

const unique = () => Date.now().toString(36).toUpperCase().slice(-6);

function newProductInput(overrides: Record<string, unknown> = {}) {
  return {
    sku: `TEST-${unique()}`,
    name: 'Integration Test Circuit',
    description: 'A product created by the catalogue integration tests.',
    category: 'CONNECTIVITY',
    monthlyPriceCents: 150_000,
    setupPriceCents: 25_000,
    pricingModel: 'FLAT',
    minContractMonths: 12,
    maxDiscountBps: 1_500,
    isActive: true,
    sortOrder: 900,
    ...overrides,
  };
}

describe('product administration', () => {
  it('lets a pricing administrator add a product, and audits it', async () => {
    const created = await createProduct(pricingAdmin, newProductInput());

    const product = await prisma.product.findUniqueOrThrow({
      where: { id: created.data.productId },
    });
    expect(product.monthlyPriceCents).toBe(150_000);

    const audit = await prisma.auditEvent.findFirst({
      where: { entityId: product.id, action: 'PRODUCT_CREATED' },
    });
    expect(audit?.actorId).toBe(pricingAdmin.id);
    expect(audit?.entity).toBe('PRODUCT');
  });

  it('refuses a sales representative', async () => {
    await expectAppError(createProduct(rep, newProductInput()), 'FORBIDDEN');

    const existing = await prisma.product.findFirstOrThrow();
    await expectAppError(updateProduct(rep, { id: existing.id, name: 'Renamed' }), 'FORBIDDEN');
    await expectAppError(setProductActive(rep, { id: existing.id, isActive: false }), 'FORBIDDEN');
  });

  it('rejects a duplicate SKU as a conflict', async () => {
    const sku = `TEST-${unique()}D`;
    await createProduct(pricingAdmin, newProductInput({ sku }));

    await expectAppError(createProduct(pricingAdmin, newProductInput({ sku })), 'CONFLICT');
  });

  it('writes nothing when an update changes nothing', async () => {
    const created = await createProduct(pricingAdmin, newProductInput());
    const before = await prisma.auditEvent.count({
      where: { entityId: created.data.productId, action: 'PRODUCT_UPDATED' },
    });

    const result = await updateProduct(pricingAdmin, {
      id: created.data.productId,
      name: 'Integration Test Circuit',
    });
    expect(result.data.changedFields).toEqual([]);

    const after = await prisma.auditEvent.count({
      where: { entityId: created.data.productId, action: 'PRODUCT_UPDATED' },
    });
    expect(after).toBe(before);
  });

  it('records changed field names, and leaves saved quote versions at their old price', async () => {
    const ids = await productIds(['FIB-10G']);
    const fibreId = ids.get('FIB-10G') ?? '';

    const { customer, location } = await acmeMunich();
    const quote = await createQuote(rep, { customerId: customer.id, locationId: location.id });
    const saved = await saveConfiguration(rep, {
      quoteId: quote.data.quoteId,
      selections: await bundleSelections(),
      contractMonths: 36,
      siteCount: 1,
      requestedDiscountBps: 0,
    });

    const before = await prisma.quoteItem.findFirstOrThrow({
      where: { quoteVersionId: saved.data.versionId, productId: fibreId },
    });

    const product = await prisma.product.findUniqueOrThrow({ where: { id: fibreId } });
    const result = await updateProduct(pricingAdmin, {
      id: fibreId,
      monthlyPriceCents: product.monthlyPriceCents + 10_000,
    });
    expect(result.data.changedFields).toEqual(['monthlyPriceCents']);

    const after = await prisma.quoteItem.findFirstOrThrow({ where: { id: before.id } });
    expect(after.unitMonthlyCents).toBe(before.unitMonthlyCents);

    // Put the catalogue back so later tests price as the seed intends.
    await updateProduct(pricingAdmin, {
      id: fibreId,
      monthlyPriceCents: product.monthlyPriceCents,
    });
  });

  it('reports how many in-progress quotes a withdrawal disturbs', async () => {
    const ids = await productIds(['FIB-10G']);
    const fibreId = ids.get('FIB-10G') ?? '';

    const withdrawn = await setProductActive(pricingAdmin, { id: fibreId, isActive: false });
    expect(withdrawn.data.isActive).toBe(false);
    expect(withdrawn.data.affectedQuotes).toBeGreaterThan(0);

    const restored = await setProductActive(pricingAdmin, { id: fibreId, isActive: true });
    expect(restored.data.isActive).toBe(true);
  });
});

describe('rule administration', () => {
  const ruleInput = (overrides: Record<string, unknown> = {}) => ({
    severity: 'ERROR',
    message: 'Integration test rule message that is long enough.',
    priority: 500,
    isActive: true,
    triggerKind: 'CATEGORY_SELECTED',
    triggerCategory: 'VOICE',
    effectKind: 'REQUIRES_PRODUCT',
    targetProductIds: [],
    ...overrides,
  });

  it('derives the rule type from the effect', async () => {
    const ids = await productIds(['SEC-FW']);
    const created = await createRule(
      pricingAdmin,
      ruleInput({ effectKind: 'RECOMMENDS_PRODUCT', effectProductId: ids.get('SEC-FW') }),
    );

    const rule = await prisma.productRule.findUniqueOrThrow({ where: { id: created.data.ruleId } });
    expect(rule.type).toBe('RECOMMENDS');

    await setRuleActive(pricingAdmin, { id: rule.id, isActive: false });
    const disabled = await prisma.productRule.findUniqueOrThrow({ where: { id: rule.id } });
    expect(disabled.isActive).toBe(false);
  });

  it('refuses a rule whose product does not exist', async () => {
    await expectAppError(
      createRule(pricingAdmin, ruleInput({ effectProductId: 'c' + 'x'.repeat(24) })),
      'NOT_FOUND',
    );
  });

  it('refuses a group of fewer than two products', async () => {
    const ids = await productIds(['SEC-FW']);
    await expectSchemaRejection(
      createRule(
        pricingAdmin,
        ruleInput({ effectKind: 'REQUIRES_ONE_OF', targetProductIds: [ids.get('SEC-FW')] }),
      ),
      'at least two products',
    );
  });

  it('refuses a rule that makes a product require itself', async () => {
    const ids = await productIds(['SEC-FW']);
    const id = ids.get('SEC-FW');
    await expectSchemaRejection(
      createRule(
        pricingAdmin,
        ruleInput({ triggerKind: 'PRODUCT_SELECTED', triggerProductId: id, effectProductId: id }),
      ),
      'itself',
    );
  });

  it('replaces the target group on update rather than merging it', async () => {
    const ids = await productIds(['SUP-STD', 'SUP-PREM', 'SEC-FW']);
    const created = await createRule(
      pricingAdmin,
      ruleInput({
        effectKind: 'AT_MOST_ONE_OF',
        targetProductIds: [ids.get('SUP-STD'), ids.get('SUP-PREM')],
      }),
    );

    const updated = await updateRule(
      pricingAdmin,
      ruleInput({
        id: created.data.ruleId,
        effectKind: 'AT_MOST_ONE_OF',
        targetProductIds: [ids.get('SUP-PREM'), ids.get('SEC-FW')],
      }),
    );
    expect(updated.data.changedFields).toContain('targetProductIds');

    const targets = await prisma.productRuleTarget.findMany({
      where: { ruleId: created.data.ruleId },
      select: { productId: true },
    });
    expect(targets.map((target) => target.productId).sort()).toEqual(
      [ids.get('SUP-PREM') ?? '', ids.get('SEC-FW') ?? ''].sort(),
    );
  });

  it('refuses a sales representative', async () => {
    const ids = await productIds(['SEC-FW']);
    await expectAppError(
      createRule(rep, ruleInput({ effectProductId: ids.get('SEC-FW') })),
      'FORBIDDEN',
    );
  });

  it('is visible to the configurator as soon as it is active', async () => {
    const ids = await productIds(['SEC-DDOS']);
    const created = await createRule(
      pricingAdmin,
      ruleInput({
        triggerKind: 'ALWAYS',
        triggerCategory: undefined,
        effectKind: 'RECOMMENDS_PRODUCT',
        effectProductId: ids.get('SEC-DDOS'),
        severity: 'RECOMMENDATION',
        message: 'Consider DDoS protection on every quote — integration test rule.',
      }),
    );

    const active = await prisma.productRule.findMany({ where: { isActive: true } });
    expect(active.map((rule) => rule.id)).toContain(created.data.ruleId);

    await setRuleActive(pricingAdmin, { id: created.data.ruleId, isActive: false });
  });
});
