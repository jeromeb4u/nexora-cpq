/**
 * `@nexora/validation` — the single source of truth for input validation.
 *
 * Every schema in this package is written for **Zod 4** (`zod@4.6.5`), which
 * is not backwards compatible with Zod 3 idioms. The differences that matter
 * most here, discovered by reading `node_modules/zod`'s own type
 * definitions rather than assumed from memory:
 *
 * 1. String formats moved to top-level factories. `z.string().email()`,
 *    `.uuid()`, `.url()`, `.cuid()`, etc. still exist on `ZodString` but are
 *    marked `@deprecated` in `v4/classic/schemas.d.ts` — the replacement is a
 *    standalone `ZodEmail`/`ZodURL`/`ZodCUID` schema returned by `z.email()`,
 *    `z.url()`, `z.cuid()`, and so on. This package uses those top-level
 *    forms throughout (see `common.ts`).
 * 2. Error message customisation uses `error`, not `message`/`errorMap`.
 *    Every check (`.min()`, `.max()`, `z.email()`, `.refine()`, `z.enum()`, …)
 *    accepts `params?: string | { error?: string | ErrorMap }`; `message` is
 *    still accepted but is marked deprecated in `core/api.d.ts`. This package
 *    always writes `{ error: '...' }` (or the bare-string shorthand).
 * 3. `z.enum()` accepts a runtime array of string literals directly:
 *    `z.enum(CUSTOMER_STATUSES)` where `CUSTOMER_STATUSES` is a plain
 *    `string[]` from `@nexora/types`. In Zod 3 this required a `[string,
 *    ...string[]]` tuple cast; in Zod 4 the first overload of `z.enum()` is
 *    `<const T extends readonly string[]>(values: T, ...)`, so a plain const
 *    array works without a cast (see `enums.ts`).
 * 4. Numeric enumerations (contract terms, which are numbers, not strings)
 *    cannot use `z.enum()` at all — it only accepts strings. `z.literal()`
 *    gained an overload that accepts an array of literal values and builds
 *    the equivalent union (`z.literal(CONTRACT_TERMS)`), which is what this
 *    package uses instead of a hand-written `z.union([z.literal(12), ...])`.
 * 5. `z.string().int()` no longer exists as a concept; use the top-level
 *    `z.int()`, which is `ZodNumber` narrowed to Zod's internal `"safeint"`
 *    format and therefore already bounded to `Number.isSafeInteger`.
 *
 * Design principle: every schema here validates both the client-side form
 * and the corresponding server action or route handler. There is exactly one
 * definition of each rule; nothing downstream should redeclare a min/max,
 * a regex, or a cross-field check.
 */

export * from './common';
export * from './enums';
export * from './customer';
export * from './location';
export * from './product';
export * from './quote';
export * from './configuration';
export * from './approval';
export * from './auth';
export * from './notification';
