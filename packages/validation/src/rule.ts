import { z } from 'zod';
import { CONTRACT_TERMS, RULE_EFFECT_KINDS, RULE_TRIGGER_KINDS } from '@nexora/types';

import { cuidSchema } from './common';
import { productCategorySchema, serviceabilitySchema, validationSeveritySchema } from './enums';

/**
 * Editing a compatibility rule.
 *
 * The shape mirrors the `product_rule` row — a trigger, an effect, and the
 * parameters each of those kinds needs — because that is also the shape of the
 * form. Which parameters are required depends on the kinds chosen, and that
 * dependency is checked here, once, for both the form and the server.
 *
 * `type` is deliberately absent: it is derived from the effect
 * (`ruleTypeForEffect`), so a rule whose type contradicts its effect cannot be
 * expressed.
 */

export const ruleTriggerKindSchema = z.enum(RULE_TRIGGER_KINDS, {
  error: 'Choose when this rule should fire.',
});

export const ruleEffectKindSchema = z.enum(RULE_EFFECT_KINDS, {
  error: 'Choose what this rule should assert.',
});

const ruleBase = z.object({
  severity: validationSeveritySchema,
  /** Shown verbatim to a salesperson, so it must be a sentence, not a code. */
  message: z
    .string()
    .trim()
    .min(15, { error: 'Write a message a salesperson can act on — at least 15 characters.' })
    .max(500, { error: 'Keep the message to 500 characters or fewer.' }),
  priority: z
    .int({ error: 'Priority must be a whole number.' })
    .min(0, { error: 'Priority cannot be negative.' })
    .max(1000, { error: 'Priority cannot exceed 1000.' }),
  isActive: z.boolean(),

  triggerKind: ruleTriggerKindSchema,
  triggerProductId: cuidSchema.optional(),
  triggerCategory: productCategorySchema.optional(),
  triggerThreshold: z
    .int({ error: 'Enter a whole number.' })
    .positive({ error: 'Enter a value greater than zero.' })
    .optional(),

  effectKind: ruleEffectKindSchema,
  effectProductId: cuidSchema.optional(),
  effectThreshold: z.int({ error: 'Enter a whole number.' }).positive().optional(),
  effectServiceability: serviceabilitySchema.optional(),
  /** Used by the set-valued effects; ignored by the others. */
  targetProductIds: z.array(cuidSchema).default([]),
});

type RuleShape = z.infer<typeof ruleBase>;

const SINGLE_PRODUCT_EFFECTS = [
  'REQUIRES_PRODUCT',
  'INCOMPATIBLE_WITH_PRODUCT',
  'RECOMMENDS_PRODUCT',
] as const;

const SET_EFFECTS = ['REQUIRES_ONE_OF', 'AT_MOST_ONE_OF'] as const;

function checkRule(data: RuleShape, ctx: z.RefinementCtx): void {
  const require = (condition: boolean, path: keyof RuleShape, message: string) => {
    if (!condition) ctx.addIssue({ code: 'custom', path: [path], message });
  };

  switch (data.triggerKind) {
    case 'PRODUCT_SELECTED':
      require(Boolean(
        data.triggerProductId,
      ), 'triggerProductId', 'Choose the product that triggers this rule.');
      break;
    case 'CATEGORY_SELECTED':
      require(Boolean(
        data.triggerCategory,
      ), 'triggerCategory', 'Choose the category that triggers this rule.');
      break;
    case 'BANDWIDTH_AT_LEAST':
      require(data.triggerThreshold !==
        undefined, 'triggerThreshold', 'Enter the bandwidth in Mbps that triggers this rule.');
      break;
    case 'CONTRACT_TERM_AT_LEAST':
      require(data.triggerThreshold !==
        undefined, 'triggerThreshold', 'Enter the contract term in months that triggers this rule.');
      break;
    case 'ALWAYS':
      break;
  }

  if ((SINGLE_PRODUCT_EFFECTS as readonly string[]).includes(data.effectKind)) {
    require(Boolean(
      data.effectProductId,
    ), 'effectProductId', 'Choose the product this rule applies to.');
  }

  if ((SET_EFFECTS as readonly string[]).includes(data.effectKind)) {
    require(data.targetProductIds.length >=
      2, 'targetProductIds', 'Choose at least two products — a group of one is not a choice.');
    require(new Set(data.targetProductIds).size ===
      data.targetProductIds
        .length, 'targetProductIds', 'Each product can appear once in the group.');
  }

  if (data.effectKind === 'MIN_CONTRACT_MONTHS') {
    require(data.effectThreshold !==
      undefined, 'effectThreshold', 'Choose the minimum contract term.');
    require(data.effectThreshold === undefined ||
      (CONTRACT_TERMS as readonly number[]).includes(
        data.effectThreshold,
      ), 'effectThreshold', `The minimum term must be a term Nexora sells: ${CONTRACT_TERMS.join(', ')} months.`);
  }

  if (data.effectKind === 'MIN_SERVICEABILITY') {
    require(Boolean(
      data.effectServiceability,
    ), 'effectServiceability', 'Choose the minimum serviceability level.');
  }

  // A product that requires or excludes itself can never be satisfied.
  if (
    data.triggerKind === 'PRODUCT_SELECTED' &&
    data.triggerProductId !== undefined &&
    (data.effectProductId === data.triggerProductId ||
      data.targetProductIds.includes(data.triggerProductId))
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['effectProductId'],
      message: 'A rule cannot make a product require, recommend or exclude itself.',
    });
  }
}

export const createRuleSchema = ruleBase.superRefine(checkRule);
export type CreateRuleInput = z.infer<typeof createRuleSchema>;

export const updateRuleSchema = ruleBase.extend({ id: cuidSchema }).superRefine(checkRule);
export type UpdateRuleInput = z.infer<typeof updateRuleSchema>;

/** Toggling a rule on or off from the list, without opening the editor. */
export const setRuleActiveSchema = z.object({ id: cuidSchema, isActive: z.boolean() });
export type SetRuleActiveInput = z.infer<typeof setRuleActiveSchema>;

/** The same, for a product. */
export const setProductActiveSchema = z.object({ id: cuidSchema, isActive: z.boolean() });
export type SetProductActiveInput = z.infer<typeof setProductActiveSchema>;
