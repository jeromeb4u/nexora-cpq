import { z } from 'zod';
import {
  basisPointsSchema,
  booleanQueryParam,
  csvArray,
  cuidSchema,
  moneyCentsSchema,
  nonEmptyString,
  paginationSchema,
} from './common';
import { contractTermSchema, productCategorySchema, pricingModelSchema } from './enums';

export const skuSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]+(-[A-Z0-9]+)*$/, {
    error:
      'Enter a SKU using only uppercase letters, numbers, and hyphens, for example SDWAN-100M.',
  })
  .max(50, { error: 'SKU must be 50 characters or fewer.' });

export const createProductSchema = z.object({
  sku: skuSchema,
  name: nonEmptyString(200),
  description: nonEmptyString(2000),
  category: productCategorySchema,
  monthlyPriceCents: moneyCentsSchema,
  setupPriceCents: moneyCentsSchema,
  pricingModel: pricingModelSchema.default('FLAT'),
  minContractMonths: contractTermSchema.default(12),
  maxDiscountBps: basisPointsSchema,
  bandwidthMbps: z
    .int({ error: 'Enter bandwidth as a whole number of Mbps.' })
    .positive({ error: 'Bandwidth must be greater than 0 Mbps.' })
    .optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.int({ error: 'Sort order must be a whole number.' }).default(0),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

/**
 * A partial update: an omitted field means "leave it as it is".
 *
 * The fields that carry a `.default()` on create are redeclared without one.
 * `.partial()` makes a field optional but keeps its default, so a request that
 * only renamed a product would also quietly reset its pricing model, minimum
 * term, sort order and availability to the create-time defaults.
 */
export const updateProductSchema = createProductSchema.partial().extend({
  id: cuidSchema,
  pricingModel: pricingModelSchema.optional(),
  minContractMonths: contractTermSchema.optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.int({ error: 'Sort order must be a whole number.' }).optional(),
});
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const productListQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  category: csvArray(productCategorySchema),
  isActive: booleanQueryParam,
  ...paginationSchema.shape,
});
export type ProductListQueryInput = z.infer<typeof productListQuerySchema>;
