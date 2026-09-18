import 'server-only';

import { Prisma, prisma } from '@nexora/db';
import { Permission, can } from '@nexora/auth/permissions';
import type { Actor } from '@nexora/auth/session';
import { type RuleEffectKind, ruleTypeForEffect } from '@nexora/types';
import type { CreateRuleInput } from '@nexora/validation';
import {
  createProductSchema,
  createRuleSchema,
  setProductActiveSchema,
  setRuleActiveSchema,
  updateProductSchema,
  updateRuleSchema,
} from '@nexora/validation';
import { conflict, forbidden, notFound } from '@nexora/observability';

import { type Db, recordAudit } from '../audit';
import { type ServiceOutcome, outcome } from './outcome';

/**
 * Catalogue and rule administration — the Pricing Administrator's half of the
 * system.
 *
 * Two properties matter more than anything else here:
 *
 *  1. **Editing the catalogue never rewrites history.** Quote versions store
 *     their own prices and SKU/name snapshots, so changing a price or renaming
 *     a product changes what the *next* quote costs, never what an existing one
 *     says. That is a property of the schema ([ADR-007]), and these services
 *     rely on it rather than trying to cascade updates.
 *  2. **A rule that cannot be satisfied is refused before it is stored.** The
 *     schema checks the shape; this layer checks the references — that every
 *     product mentioned actually exists — because only the database knows that.
 */

const REVALIDATE = ['/products', '/products/rules'];

/** Every field an audit entry may name. Values are never recorded. */
const PRODUCT_FIELDS = [
  'sku',
  'name',
  'description',
  'category',
  'monthlyPriceCents',
  'setupPriceCents',
  'pricingModel',
  'minContractMonths',
  'maxDiscountBps',
  'bandwidthMbps',
  'isActive',
  'sortOrder',
] as const;

const RULE_FIELDS = [
  'severity',
  'message',
  'priority',
  'isActive',
  'triggerKind',
  'triggerProductId',
  'triggerCategory',
  'triggerThreshold',
  'effectKind',
  'effectProductId',
  'effectThreshold',
  'effectServiceability',
] as const;

function changedFieldNames<T extends Record<string, unknown>>(
  next: Partial<T>,
  existing: T,
  fields: readonly (keyof T & string)[],
): string[] {
  return fields.filter((field) => {
    if (!(field in next)) return false;
    return (next[field] ?? null) !== (existing[field] ?? null);
  });
}

function isSkuConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return false;
  }
  const target = error.meta?.target;
  if (Array.isArray(target)) {
    return target.some((column) => typeof column === 'string' && column.toLowerCase() === 'sku');
  }
  if (typeof target === 'string') return target.toLowerCase().includes('sku');
  return error.message.toLowerCase().includes('sku');
}

function assertCan(actor: Actor, permission: Permission, what: string): void {
  if (!can(actor.role, permission)) {
    throw forbidden(`Your role does not permit ${what}.`);
  }
}

/* ==========================================================================
 * Products
 * ======================================================================== */

export async function createProduct(
  actor: Actor,
  input: unknown,
): Promise<ServiceOutcome<{ productId: string }>> {
  const data = createProductSchema.parse(input);
  assertCan(actor, Permission.PRODUCT_MANAGE, 'changing the catalogue');

  try {
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          sku: data.sku,
          name: data.name,
          description: data.description,
          category: data.category,
          monthlyPriceCents: data.monthlyPriceCents,
          setupPriceCents: data.setupPriceCents,
          pricingModel: data.pricingModel,
          minContractMonths: data.minContractMonths,
          maxDiscountBps: data.maxDiscountBps,
          bandwidthMbps: data.bandwidthMbps ?? null,
          isActive: data.isActive,
          sortOrder: data.sortOrder,
        },
      });

      await recordAudit(tx, {
        action: 'PRODUCT_CREATED',
        entity: 'PRODUCT',
        entityId: created.id,
        actorId: actor.id,
        summary: `Added ${created.sku} — ${created.name} to the catalogue`,
      });

      return created;
    });

    return outcome({ productId: product.id }, { revalidate: REVALIDATE });
  } catch (error) {
    if (isSkuConflict(error)) throw conflict('A product with this SKU already exists.');
    throw error;
  }
}

export async function updateProduct(
  actor: Actor,
  input: unknown,
): Promise<ServiceOutcome<{ productId: string; changedFields: string[] }>> {
  const data = updateProductSchema.parse(input);
  assertCan(actor, Permission.PRODUCT_MANAGE, 'changing the catalogue');

  const existing = await prisma.product.findUnique({ where: { id: data.id } });
  if (!existing) throw notFound('Product');

  const { id, bandwidthMbps, ...rest } = data;
  const next = {
    ...rest,
    ...(bandwidthMbps === undefined ? {} : { bandwidthMbps: bandwidthMbps ?? null }),
  };

  const changedFields = changedFieldNames(next, existing, PRODUCT_FIELDS);
  if (changedFields.length === 0) {
    return outcome({ productId: existing.id, changedFields }, { revalidate: [] });
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.product.update({ where: { id }, data: next });

      await recordAudit(tx, {
        action: 'PRODUCT_UPDATED',
        entity: 'PRODUCT',
        entityId: existing.id,
        actorId: actor.id,
        // Existing quotes keep their own snapshot of price, SKU and name, so
        // this changes future quotes only — worth stating in the trail.
        summary: `Updated ${existing.sku} (applies to new quote versions)`,
        metadata: { changedFields },
      });
    });

    return outcome({ productId: existing.id, changedFields }, { revalidate: REVALIDATE });
  } catch (error) {
    if (isSkuConflict(error)) throw conflict('A product with this SKU already exists.');
    throw error;
  }
}

/**
 * Withdraw a product from sale, or bring it back.
 *
 * Withdrawing is deliberately not blocked when quotes still reference the
 * product: the catalogue owner decides what may be sold, and the configurator
 * already surfaces a withdrawn product on an existing quote as an error the
 * rep must resolve. The count of affected in-progress versions is returned so
 * the UI can say what the change will disturb.
 */
export async function setProductActive(
  actor: Actor,
  input: unknown,
): Promise<ServiceOutcome<{ productId: string; isActive: boolean; affectedQuotes: number }>> {
  const data = setProductActiveSchema.parse(input);
  assertCan(actor, Permission.PRODUCT_MANAGE, 'changing the catalogue');

  const existing = await prisma.product.findUnique({ where: { id: data.id } });
  if (!existing) throw notFound('Product');

  const affectedQuotes = data.isActive
    ? 0
    : await prisma.quote.count({
        where: {
          status: { in: ['DRAFT', 'CONFIGURING', 'READY_FOR_REVIEW', 'APPROVAL_REQUIRED'] },
          currentVersion: { items: { some: { productId: existing.id } } },
        },
      });

  if (existing.isActive === data.isActive) {
    return outcome(
      { productId: existing.id, isActive: existing.isActive, affectedQuotes },
      { revalidate: [] },
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.product.update({ where: { id: existing.id }, data: { isActive: data.isActive } });

    await recordAudit(tx, {
      action: 'PRODUCT_UPDATED',
      entity: 'PRODUCT',
      entityId: existing.id,
      actorId: actor.id,
      summary: data.isActive
        ? `Returned ${existing.sku} to the catalogue`
        : `Withdrew ${existing.sku} from sale`,
      metadata: { changedFields: ['isActive'], affectedQuotes },
    });
  });

  return outcome(
    { productId: existing.id, isActive: data.isActive, affectedQuotes },
    { revalidate: REVALIDATE },
  );
}

/* ==========================================================================
 * Rules
 * ======================================================================== */

interface RuleReferences {
  readonly triggerProductId?: string | undefined;
  readonly effectProductId?: string | undefined;
  readonly targetProductIds: readonly string[];
}

/** Every product a rule points at must exist, or the rule can never fire correctly. */
async function assertProductsExist(db: Db, references: RuleReferences): Promise<void> {
  const ids = [
    ...(references.triggerProductId ? [references.triggerProductId] : []),
    ...(references.effectProductId ? [references.effectProductId] : []),
    ...references.targetProductIds,
  ];
  if (ids.length === 0) return;

  const unique = [...new Set(ids)];
  const found = await db.product.count({ where: { id: { in: unique } } });
  if (found !== unique.length) throw notFound('Product');
}

/** The columns a rule row stores, derived from the validated form input. */
function ruleColumns(data: CreateRuleInput) {
  return {
    // Derived, never supplied: see ruleTypeForEffect.
    type: ruleTypeForEffect(data.effectKind),
    severity: data.severity,
    message: data.message,
    priority: data.priority,
    isActive: data.isActive,
    triggerKind: data.triggerKind,
    triggerProductId: data.triggerProductId ?? null,
    triggerCategory: data.triggerCategory ?? null,
    triggerThreshold: data.triggerThreshold ?? null,
    effectKind: data.effectKind,
    effectProductId: data.effectProductId ?? null,
    effectThreshold: data.effectThreshold ?? null,
    effectServiceability: data.effectServiceability ?? null,
  } as const;
}

const SET_EFFECTS: readonly RuleEffectKind[] = ['REQUIRES_ONE_OF', 'AT_MOST_ONE_OF'];

/** Targets only mean something for the set-valued effects; drop them otherwise. */
function targetsFor(effectKind: RuleEffectKind, targetProductIds: readonly string[]): string[] {
  return SET_EFFECTS.includes(effectKind) ? [...new Set(targetProductIds)] : [];
}

export async function createRule(
  actor: Actor,
  input: unknown,
): Promise<ServiceOutcome<{ ruleId: string }>> {
  const data = createRuleSchema.parse(input);
  assertCan(actor, Permission.RULE_MANAGE, 'changing configuration rules');

  await assertProductsExist(prisma, data);
  const targets = targetsFor(data.effectKind, data.targetProductIds);

  const rule = await prisma.$transaction(async (tx) => {
    const created = await tx.productRule.create({
      data: {
        ...ruleColumns(data),
        ...(targets.length > 0
          ? { targets: { create: targets.map((productId) => ({ productId })) } }
          : {}),
      },
    });

    await recordAudit(tx, {
      action: 'RULE_CREATED',
      entity: 'PRODUCT_RULE',
      entityId: created.id,
      actorId: actor.id,
      summary: `Added a ${created.severity.toLowerCase()} rule: ${created.message}`,
      metadata: { triggerKind: created.triggerKind, effectKind: created.effectKind },
    });

    return created;
  });

  return outcome({ ruleId: rule.id }, { revalidate: REVALIDATE });
}

export async function updateRule(
  actor: Actor,
  input: unknown,
): Promise<ServiceOutcome<{ ruleId: string; changedFields: string[] }>> {
  const data = updateRuleSchema.parse(input);
  assertCan(actor, Permission.RULE_MANAGE, 'changing configuration rules');

  const existing = await prisma.productRule.findUnique({
    where: { id: data.id },
    include: { targets: true },
  });
  if (!existing) throw notFound('Rule');

  await assertProductsExist(prisma, data);

  const columns = ruleColumns(data);
  const targets = targetsFor(data.effectKind, data.targetProductIds);
  const previousTargets = existing.targets.map((target) => target.productId).sort();
  const targetsChanged = [...targets].sort().join() !== previousTargets.join();

  const changedFields = [
    ...changedFieldNames(columns, existing, RULE_FIELDS),
    ...(targetsChanged ? ['targetProductIds'] : []),
  ];
  if (changedFields.length === 0) {
    return outcome({ ruleId: existing.id, changedFields }, { revalidate: [] });
  }

  await prisma.$transaction(async (tx) => {
    await tx.productRule.update({ where: { id: existing.id }, data: columns });

    // Targets are a set, so they are replaced rather than merged: an editor
    // removing a product from the group must actually remove it.
    if (targetsChanged) {
      await tx.productRuleTarget.deleteMany({ where: { ruleId: existing.id } });
      if (targets.length > 0) {
        await tx.productRuleTarget.createMany({
          data: targets.map((productId) => ({ ruleId: existing.id, productId })),
        });
      }
    }

    await recordAudit(tx, {
      action: 'RULE_UPDATED',
      entity: 'PRODUCT_RULE',
      entityId: existing.id,
      actorId: actor.id,
      summary: `Updated a configuration rule: ${columns.message}`,
      metadata: { changedFields },
    });
  });

  return outcome({ ruleId: existing.id, changedFields }, { revalidate: REVALIDATE });
}

export async function setRuleActive(
  actor: Actor,
  input: unknown,
): Promise<ServiceOutcome<{ ruleId: string; isActive: boolean }>> {
  const data = setRuleActiveSchema.parse(input);
  assertCan(actor, Permission.RULE_MANAGE, 'changing configuration rules');

  const existing = await prisma.productRule.findUnique({ where: { id: data.id } });
  if (!existing) throw notFound('Rule');

  if (existing.isActive === data.isActive) {
    return outcome({ ruleId: existing.id, isActive: existing.isActive }, { revalidate: [] });
  }

  await prisma.$transaction(async (tx) => {
    await tx.productRule.update({ where: { id: existing.id }, data: { isActive: data.isActive } });

    await recordAudit(tx, {
      action: 'RULE_UPDATED',
      entity: 'PRODUCT_RULE',
      entityId: existing.id,
      actorId: actor.id,
      summary: data.isActive
        ? `Enabled a configuration rule: ${existing.message}`
        : `Disabled a configuration rule: ${existing.message}`,
      metadata: { changedFields: ['isActive'] },
    });
  });

  return outcome({ ruleId: existing.id, isActive: data.isActive }, { revalidate: REVALIDATE });
}
