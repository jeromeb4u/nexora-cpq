/**
 * Reusable validation primitives shared by every domain schema in this
 * package.
 *
 * Every schema here is written against the Zod 4 API (`zod@4.6.5`), which
 * differs from Zod 3 in a few load-bearing ways — see the top-level
 * `packages/validation/src/index.ts` comment for the full list. In short:
 * string formats live as top-level factories (`z.email()`, `z.cuid()`, …)
 * rather than `.email()` chained off `z.string()`, and per-check messages are
 * passed as `{ error: '...' }` (or a bare string) instead of `{ message }`.
 */

import { z } from 'zod';
import type { ZodType } from 'zod';

/**
 * Prisma's `@default(cuid())` produces classic (v1) CUIDs, e.g.
 * `cjld2cjxh0000qzrmn831i7rn`. Every id in this system is one of these, so
 * this is the schema for every foreign key and primary key alike.
 */
export const cuidSchema = z.cuid({
  error: 'This does not look like a valid record id. Please try again or contact support.',
});

export const emailSchema = z
  .email({
    error: 'Enter a valid email address, for example jane.doe@company.com.',
  })
  .trim()
  .toLowerCase();

/**
 * Accepts common human phone formatting (spaces, hyphens, parentheses, an
 * optional leading `+`) while still requiring a plausible number of digits.
 * We deliberately do not require strict E.164 here — reps copy numbers from
 * business cards and CRMs in all kinds of shapes — but we do reject anything
 * that clearly is not a phone number.
 */
export const phoneSchema = z
  .string()
  .trim()
  .min(1, { error: 'Enter a phone number.' })
  .regex(/^\+?[0-9\s().-]{7,20}$/, {
    error: 'Enter a valid phone number, for example +49 30 1234567.',
  })
  .refine((value) => value.replace(/\D/g, '').length >= 7, {
    error: 'Enter a valid phone number, for example +49 30 1234567.',
  });

export const postalCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9][A-Za-z0-9\s-]{1,9}$/, {
    error: 'Enter a valid postal code, for example 10115.',
  });

/** ISO 3166-1 alpha-2 country code, normalised to uppercase. */
export const countryCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{2}$/, {
    error: 'Enter a 2-letter country code, for example DE for Germany.',
  })
  .transform((value) => value.toUpperCase());

/**
 * EU-style VAT number: a 2-letter country prefix followed by 8-12 alphanumeric
 * characters, e.g. `DE123456789`. Stored and compared uppercase.
 */
export const vatNumberSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}[A-Z0-9]{8,12}$/, {
    error: 'Enter a valid VAT number, for example DE123456789.',
  });

/** A non-negative, whole number of euro cents — see `@nexora/types/money`. */
export const moneyCentsSchema = z
  .int({ error: 'Enter a whole number of euro cents.' })
  .nonnegative({ error: 'Amount cannot be negative.' });

/** An integer rate in basis points (1800 = 18%), 0..10000 inclusive. */
export const basisPointsSchema = z
  .int({ error: 'Enter a whole number of basis points, for example 1800 for 18%.' })
  .min(0, { error: 'Basis points cannot be negative.' })
  .max(10_000, { error: 'Basis points cannot exceed 10000 (100%).' });

/** A trimmed, non-empty string capped at `max` characters. */
export function nonEmptyString(max: number) {
  return z
    .string()
    .trim()
    .min(1, { error: 'This field is required.' })
    .max(max, { error: `Please shorten this to ${max} characters or fewer.` });
}

export const PAGE_SIZES = [10, 25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

/**
 * Pagination, safe to parse straight out of URL search params: every field
 * has a default, so `paginationSchema.parse({})` (an empty query string)
 * succeeds.
 */
export const paginationSchema = z.object({
  page: z.coerce
    .number({ error: 'Page must be a number.' })
    .int({ error: 'Page must be a whole number.' })
    .positive({ error: 'Page must be 1 or greater.' })
    .default(1),
  pageSize: z.coerce
    .number({ error: 'Page size must be a number.' })
    .int({ error: 'Page size must be a whole number.' })
    .refine((value): value is PageSize => (PAGE_SIZES as readonly number[]).includes(value), {
      error: 'Page size must be one of 10, 25, 50, or 100.',
    })
    .default(25),
});
export type PaginationInput = z.infer<typeof paginationSchema>;

/** Shared ascending/descending sort direction for every list-query schema. */
export const sortDirSchema = z.enum(['asc', 'desc'], {
  error: "Sort direction must be 'asc' or 'desc'.",
});
export type SortDirInput = z.infer<typeof sortDirSchema>;

/**
 * Wraps `elementSchema` so a list-query field can be parsed straight out of
 * URL search params: accepts a real array (already parsed, e.g. from
 * `getAll()`), a single comma-separated string (`?status=ACTIVE,PROSPECT`),
 * a lone scalar (`?status=ACTIVE`), or an absent/empty value (defaults to
 * an empty array — "no filter applied").
 */
export function csvArray<T extends ZodType>(elementSchema: T) {
  return z.preprocess((value) => {
    if (value === undefined || value === null || value === '') return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
    }
    return value;
  }, z.array(elementSchema).default([]));
}

/**
 * An optional tri-state boolean filter for a list-query schema, safe to
 * parse from URL search params: absent/empty means "no filter", and both the
 * string `"true"`/`"false"` (as it arrives from a query string) and a real
 * boolean are accepted.
 */
export const booleanQueryParam = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return value;
}, z.boolean({ error: "Value must be 'true' or 'false'." }).optional());

