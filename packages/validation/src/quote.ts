import { z } from 'zod';
import { csvArray, cuidSchema, nonEmptyString, paginationSchema, sortDirSchema } from './common';
import { quoteStatusSchema } from './enums';

export const createQuoteSchema = z.object({
  customerId: cuidSchema,
  locationId: cuidSchema.optional(),
  title: nonEmptyString(200).optional(),
});
export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;

/**
 * Editable metadata on an existing quote. The customer a quote belongs to is
 * immutable once created, so it is intentionally not part of this schema.
 */
export const updateQuoteMetadataSchema = createQuoteSchema.omit({ customerId: true }).partial().extend({
  id: cuidSchema,
});
export type UpdateQuoteMetadataInput = z.infer<typeof updateQuoteMetadataSchema>;

export const quoteSortBySchema = z.enum(['quoteNumber', 'updatedAt', 'mrrCents', 'status'], {
  error: 'Select a valid field to sort by.',
});

/**
 * Safe to parse directly from `URLSearchParams` — every field defaults, so a
 * bare URL with no query string parses successfully.
 */
export const quoteListQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  status: csvArray(quoteStatusSchema),
  ownerId: cuidSchema.optional(),
  customerId: cuidSchema.optional(),
  updatedAfter: z
    .iso.datetime({ offset: true, error: 'Enter a valid ISO 8601 date and time, for example 2026-01-01T00:00:00Z.' })
    .optional(),
  updatedBefore: z
    .iso.datetime({ offset: true, error: 'Enter a valid ISO 8601 date and time, for example 2026-01-01T00:00:00Z.' })
    .optional(),
  sortBy: quoteSortBySchema.default('updatedAt'),
  sortDir: sortDirSchema.default('desc'),
  ...paginationSchema.shape,
});
export type QuoteListQueryInput = z.infer<typeof quoteListQuerySchema>;

export const quoteStatusTransitionSchema = z.object({
  quoteId: cuidSchema,
  toStatus: quoteStatusSchema,
  note: nonEmptyString(1000).optional(),
});
export type QuoteStatusTransitionInput = z.infer<typeof quoteStatusTransitionSchema>;

/**
 * Copy an existing version of a quote into a new, current version. The source
 * is never modified; history only grows.
 */
export const createRevisionSchema = z.object({
  quoteId: cuidSchema,
  sourceVersionId: cuidSchema,
});
export type CreateRevisionInput = z.infer<typeof createRevisionSchema>;

/** Identifies a quote for actions that need nothing else (e.g. document generation). */
export const quoteIdSchema = z.object({ quoteId: cuidSchema });
export type QuoteIdInput = z.infer<typeof quoteIdSchema>;
