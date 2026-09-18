'use server';

import type { QuoteStatus } from '@nexora/types';

import * as quotes from '../services/quote-service';
import { type ActionResult, run } from './run';

/**
 * Quote server actions.
 *
 * Deliberately thin. Each one authenticates, hands the untrusted input to a
 * service (which validates, authorizes, recomputes and persists), and the
 * wrapper revalidates pages and sends email after the transaction commits.
 *
 * The business rules live in `lib/services`, where they can be exercised by
 * integration tests without a Next.js request.
 */

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

export async function requestApproval(
  input: unknown,
): Promise<ActionResult<{ approvalId: string }>> {
  return run('requestApproval', (actor) => quotes.requestApproval(actor, input));
}

export async function decideApproval(
  input: unknown,
): Promise<ActionResult<{ status: QuoteStatus }>> {
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
