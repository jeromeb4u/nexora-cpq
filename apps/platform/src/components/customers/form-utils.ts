import type { FieldErrors, FieldValues, Resolver } from 'react-hook-form';

/**
 * The slice of a Zod schema's runtime interface this module actually needs.
 * `zod` is not a direct dependency of this app (only of `@nexora/validation`,
 * which owns the schemas), so this is structural rather than importing
 * `ZodType` — every schema passed in here already satisfies it.
 */
interface ParsableSchema {
  safeParseAsync(input: unknown): Promise<
    | { readonly success: true; readonly data: unknown }
    | {
        readonly success: false;
        readonly error: {
          readonly issues: readonly {
            readonly path: readonly PropertyKey[];
            readonly code: string;
            readonly message: string;
          }[];
        };
      }
  >;
}

/**
 * Build a react-hook-form `Resolver` from one of the shared Zod schemas
 * (`createCustomerSchema`, `updateLocationSchema`, ...) without redefining
 * any of their rules.
 *
 * Two things this does that a plain `zodResolver(schema)` would not:
 *
 *  1. Blank optional text fields (an empty "Website" box) are normalised to
 *     `undefined` before validation. The schemas use `.optional()`, which
 *     means "omit the key entirely" — not "an empty string is acceptable" —
 *     so a cleared form control has to become `undefined`, not `''`, or a
 *     field like `website` (a URL) fails validation for being blank.
 *  2. `extra` merges in values the form never renders as a control at all
 *     (the `id` on an edit form, the `customerId` a location belongs to),
 *     so the schema that actually requires them can still validate against
 *     the real payload before it reaches the server.
 */
export function formResolver<TFieldValues extends FieldValues>(
  schema: ParsableSchema,
  options: {
    readonly optionalKeys?: readonly (keyof TFieldValues & string)[];
    /** Number inputs held as strings: blank becomes undefined, anything else a number. */
    readonly numericKeys?: readonly (keyof TFieldValues & string)[];
    readonly extra?: Record<string, unknown>;
  } = {},
): Resolver<TFieldValues> {
  const optionalKeys = options.optionalKeys ?? [];

  return async (values) => {
    const normalized: Record<string, unknown> = { ...values, ...options.extra };
    for (const key of optionalKeys) {
      if (normalized[key] === '') normalized[key] = undefined;
    }
    for (const key of options.numericKeys ?? []) {
      const raw = normalized[key];
      if (typeof raw === 'string') {
        normalized[key] = raw.trim() === '' ? undefined : Number(raw);
      }
    }

    const result = await schema.safeParseAsync(normalized);
    if (result.success) {
      // Hand the submit handler the form's own values, not the parsed output:
      // the handler maps raw strings to the server payload itself, and the
      // parsed data has blank optional fields already turned into undefined.
      return { values, errors: {} };
    }

    const errors: Record<string, { type: string; message: string }> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
      if (!errors[path]) errors[path] = { type: issue.code, message: issue.message };
    }

    return { values: {}, errors: errors as FieldErrors<TFieldValues> };
  };
}

/** `value.trim() || undefined` — the mapping every optional text field needs at submit time. */
export function trimmedOrUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
