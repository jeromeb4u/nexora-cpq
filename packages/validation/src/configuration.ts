import { z } from 'zod';
import { basisPointsSchema, cuidSchema, nonEmptyString } from './common';
import { contractTermSchema } from './enums';

export const configurationSelectionSchema = z.object({
  productId: cuidSchema,
  quantity: z
    .int({ error: 'Quantity must be a whole number.' })
    .min(1, { error: 'Quantity must be at least 1.' })
    .max(999, { error: 'Quantity cannot exceed 999.' }),
});
export type ConfigurationSelectionInput = z.infer<typeof configurationSelectionSchema>;

/**
 * Saves a quote's configuration. A discount always needs a stated
 * justification: whenever `requestedDiscountBps` is greater than 0,
 * `discountReason` must be present and meaningful (at least 10 characters),
 * enforced by the cross-field refinement below rather than duplicated in the
 * client and the server action separately.
 */
export const saveConfigurationSchema = z
  .object({
    quoteId: cuidSchema,
    selections: z
      .array(configurationSelectionSchema)
      .min(1, { error: 'Select at least one product before saving.' }),
    contractMonths: contractTermSchema,
    siteCount: z
      .int({ error: 'Site count must be a whole number.' })
      .min(1, { error: 'Site count must be at least 1.' }),
    requestedDiscountBps: basisPointsSchema,
    discountReason: nonEmptyString(1000).optional(),
  })
  .refine(
    (data) => {
      if (data.requestedDiscountBps <= 0) return true;
      return typeof data.discountReason === 'string' && data.discountReason.length >= 10;
    },
    {
      error:
        'A requested discount needs a reason of at least 10 characters explaining why it is justified.',
      path: ['discountReason'],
    },
  );
export type SaveConfigurationInput = z.infer<typeof saveConfigurationSchema>;
