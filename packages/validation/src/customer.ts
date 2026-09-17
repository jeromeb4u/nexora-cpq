import { z } from 'zod';
import {
  csvArray,
  cuidSchema,
  emailSchema,
  nonEmptyString,
  paginationSchema,
  phoneSchema,
  sortDirSchema,
  vatNumberSchema,
} from './common';
import { customerStatusSchema, industrySchema } from './enums';

/**
 * One schema for both the "new customer" form and the server action that
 * creates it — the client renders exactly the rules the server enforces.
 */
export const createCustomerSchema = z.object({
  companyName: nonEmptyString(200),
  legalName: nonEmptyString(200),
  industry: industrySchema,
  vatNumber: vatNumberSchema,
  status: customerStatusSchema.default('PROSPECT'),
  email: emailSchema,
  phone: phoneSchema,
  website: z
    .url({ error: 'Enter a valid website address, for example https://example.com.' })
    .trim()
    .optional(),
  notes: nonEmptyString(4000).optional(),
  accountOwnerId: cuidSchema,
});
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

/**
 * Every field is optional on update: an omitted key means "leave unchanged".
 * The genuinely optional columns also accept `null`, which means "clear it" —
 * without that, emptying a customer's website in the edit form could never
 * reach the database.
 */
export const updateCustomerSchema = createCustomerSchema.partial().extend({
  id: cuidSchema,
  website: createCustomerSchema.shape.website.unwrap().nullable().optional(),
  notes: createCustomerSchema.shape.notes.unwrap().nullable().optional(),
});
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

export const customerSortBySchema = z.enum(['companyName', 'createdAt', 'updatedAt', 'status'], {
  error: 'Select a valid field to sort by.',
});

/**
 * Safe to parse directly from `URLSearchParams` / a Next.js `searchParams`
 * object: every field has a default, so `customerListQuerySchema.parse({})`
 * (a bare URL with no query string) succeeds.
 */
export const customerListQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  status: csvArray(customerStatusSchema),
  industry: csvArray(industrySchema),
  ownerId: cuidSchema.optional(),
  sortBy: customerSortBySchema.default('companyName'),
  sortDir: sortDirSchema.default('asc'),
  ...paginationSchema.shape,
});
export type CustomerListQueryInput = z.infer<typeof customerListQuerySchema>;
