/**
 * Zod schemas for every domain enumeration.
 *
 * Every schema here is built from the frozen const arrays exported by
 * `@nexora/types` (themselves derived from `as const` objects) — never from a
 * hand-typed list of string literals. That is the single source of truth the
 * Prisma schema also mirrors, so this file cannot drift from either.
 *
 * Zod 4 note: `z.enum()` accepts a runtime array of string literals directly
 * (`z.enum(CUSTOMER_STATUSES)`), unlike Zod 3 where a plain array required a
 * cast. Enums whose members are not strings (contract terms are numbers)
 * cannot use `z.enum` at all; `z.literal()` accepts an array of literal
 * values and builds the equivalent union, which is what `contractTermSchema`
 * below uses.
 */

import { z } from 'zod';
import {
  APPROVAL_REASONS,
  CONTRACT_TERMS,
  CUSTOMER_STATUSES,
  INDUSTRIES,
  PRICING_MODELS,
  PRODUCT_CATEGORIES,
  QUOTE_STATUSES,
  ROLES,
  SERVICEABILITIES,
} from '@nexora/types';

export const roleSchema = z.enum(ROLES, {
  error: 'Select a valid role.',
});
export type RoleInput = z.infer<typeof roleSchema>;

export const customerStatusSchema = z.enum(CUSTOMER_STATUSES, {
  error: 'Select a valid customer status.',
});
export type CustomerStatusInput = z.infer<typeof customerStatusSchema>;

export const industrySchema = z.enum(INDUSTRIES, {
  error: 'Select an industry.',
});
export type IndustryInput = z.infer<typeof industrySchema>;

export const serviceabilitySchema = z.enum(SERVICEABILITIES, {
  error: 'Select a serviceability status.',
});
export type ServiceabilityInput = z.infer<typeof serviceabilitySchema>;

export const productCategorySchema = z.enum(PRODUCT_CATEGORIES, {
  error: 'Select a product category.',
});
export type ProductCategoryInput = z.infer<typeof productCategorySchema>;

export const pricingModelSchema = z.enum(PRICING_MODELS, {
  error: 'Select a pricing model.',
});
export type PricingModelInput = z.infer<typeof pricingModelSchema>;

export const quoteStatusSchema = z.enum(QUOTE_STATUSES, {
  error: 'Select a valid quote status.',
});
export type QuoteStatusInput = z.infer<typeof quoteStatusSchema>;

export const approvalReasonSchema = z.enum(APPROVAL_REASONS, {
  error: 'Select a valid approval reason.',
});
export type ApprovalReasonInput = z.infer<typeof approvalReasonSchema>;

/**
 * Contract durations Nexora sells, in months. `CONTRACT_TERMS` is a tuple of
 * numbers, not strings, so this is a `z.literal()` union rather than
 * `z.enum()`.
 */
export const contractTermSchema = z.literal(CONTRACT_TERMS, {
  error: 'Select a valid contract term: 12, 24, 36, 48, or 60 months.',
});
export type ContractTermInput = z.infer<typeof contractTermSchema>;
