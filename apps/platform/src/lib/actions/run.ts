import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { type Actor, ForbiddenError, UnauthorizedError, requireActor } from '@nexora/auth/session';
import { AppError, forbidden, logger, toSafeError, unauthorized } from '@nexora/observability';

import type { ServiceOutcome } from '../services/outcome';

/**
 * What every server action in this app returns, and the wrapper that produces
 * it: authenticate, call the service, then revalidate whatever the service
 * says is now stale.
 *
 * Kept out of the `'use server'` files because those may only export async
 * functions — this module also exports a type. Sharing it means error mapping
 * (Zod, auth, `AppError`, unknown) exists exactly once.
 */

export type ActionResult<T = void> =
  | { readonly ok: true; readonly data: T }
  | {
      readonly ok: false;
      readonly code: string;
      readonly message: string;
      readonly reference: string;
    };

interface ZodLikeError {
  readonly name: 'ZodError';
  readonly issues: readonly { readonly message: string }[];
}

function isZodError(value: unknown): value is ZodLikeError {
  return (
    value instanceof Error &&
    value.name === 'ZodError' &&
    Array.isArray((value as Partial<ZodLikeError>).issues)
  );
}

function firstZodMessage(error: ZodLikeError): string {
  return error.issues[0]?.message ?? 'Some of the details entered are not valid.';
}

/**
 * Convert a thrown error into a result the client can render.
 *
 * Unexpected errors are logged in full server-side and reduced to a reference
 * code for the browser, so a Prisma message never reaches a user (§31).
 */
function fail(thrown: unknown, action: string): ActionResult<never> {
  const error =
    thrown instanceof UnauthorizedError
      ? unauthorized(thrown.message)
      : thrown instanceof ForbiddenError
        ? forbidden(thrown.message)
        : isZodError(thrown)
          ? new AppError('VALIDATION', firstZodMessage(thrown))
          : thrown;

  const safe = toSafeError(error);

  if (error instanceof AppError) {
    logger.warn('action rejected', { action, code: safe.code, reference: safe.reference });
  } else {
    logger.error('action failed', {
      action,
      reference: safe.reference,
      error: thrown instanceof Error ? thrown.message : String(thrown),
    });
  }

  return { ok: false, code: safe.code, message: safe.message, reference: safe.reference };
}

export async function run<T>(
  action: string,
  service: (actor: Actor) => Promise<ServiceOutcome<T>>,
): Promise<ActionResult<T>> {
  let result: ServiceOutcome<T>;
  try {
    const actor = await requireActor(await headers());
    result = await service(actor);
  } catch (error) {
    return fail(error, action);
  }

  for (const path of result.revalidate) revalidatePath(path);

  return { ok: true, data: result.data };
}
