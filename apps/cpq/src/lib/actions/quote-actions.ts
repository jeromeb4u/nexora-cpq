'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { type Actor, ForbiddenError, UnauthorizedError, requireActor } from '@nexora/auth/session';
import { sendEmail } from '@nexora/email';
import { AppError, forbidden, logger, toSafeError, unauthorized } from '@nexora/observability';
import type { QuoteStatus } from '@nexora/types';

import type { ServiceOutcome } from '../services/outcome';
import * as quotes from '../services/quote-service';

/**
 * Quote server actions.
 *
 * Deliberately thin. Each one authenticates, hands the untrusted input to a
 * service (which validates, authorizes, recomputes and persists), and then —
 * only after the service's transaction has committed — revalidates pages and
 * sends the emails the service asked for.
 *
 * The business rules live in `lib/services`, where they can be exercised by
 * integration tests without a Next.js request.
 */

export type ActionResult<T = void> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly code: string; readonly message: string; readonly reference: string };

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

interface ZodLikeError {
  readonly name: 'ZodError';
  readonly issues: readonly { readonly message: string }[];
}

function isZodError(value: unknown): value is ZodLikeError {
  return value instanceof Error && value.name === 'ZodError' && Array.isArray((value as Partial<ZodLikeError>).issues);
}

function firstZodMessage(error: ZodLikeError): string {
  return error.issues[0]?.message ?? 'Some of the details entered are not valid.';
}

async function run<T>(
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

  // After commit, and never able to fail the action: sendEmail logs and
  // swallows delivery errors (packages/email).
  await Promise.all(result.emails.map((message) => sendEmail(message)));

  return { ok: true, data: result.data };
}

export async function createQuote(
  input: unknown,
): Promise<ActionResult<{ quoteId: string; quoteNumber: string }>> {
  return run('createQuote', (actor) => quotes.createQuote(actor, input));
}

export async function saveConfiguration(
  input: unknown,
): Promise<ActionResult<{ versionId: string; requiresApproval: boolean; mrrCents: number }>> {
  return run('saveConfiguration', (actor) => quotes.saveConfiguration(actor, input));
}

export async function requestApproval(input: unknown): Promise<ActionResult<{ approvalId: string }>> {
  return run('requestApproval', (actor) => quotes.requestApproval(actor, input));
}

export async function decideApproval(input: unknown): Promise<ActionResult<{ status: QuoteStatus }>> {
  return run('decideApproval', (actor) => quotes.decideApproval(actor, input));
}

export async function transitionQuoteStatus(
  input: unknown,
): Promise<ActionResult<{ status: QuoteStatus }>> {
  return run('transitionQuoteStatus', (actor) => quotes.transitionQuoteStatus(actor, input));
}

export async function createRevisionFrom(
  input: unknown,
): Promise<ActionResult<{ versionId: string; versionNumber: number }>> {
  return run('createRevisionFrom', (actor) => quotes.createRevisionFrom(actor, input));
}
