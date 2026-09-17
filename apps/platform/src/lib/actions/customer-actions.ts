'use server';

import * as customerService from '../services/customer-service';
import { type ActionResult, run } from './run';

/**
 * Customer and location server actions.
 *
 * Deliberately thin, mirroring `apps/cpq/src/lib/actions/quote-actions.ts`:
 * each one authenticates, hands the untrusted input to a service (which
 * validates, authorizes and persists), and only after the service's
 * transaction has committed does it revalidate pages. The business rules live
 * in `lib/services`, where they can be exercised by integration tests without
 * a Next.js request.
 */

export async function createCustomer(
  input: unknown,
): Promise<ActionResult<{ customerId: string }>> {
  return run('createCustomer', (actor) => customerService.createCustomer(actor, input));
}

export async function updateCustomer(
  input: unknown,
): Promise<ActionResult<{ customerId: string }>> {
  return run('updateCustomer', (actor) => customerService.updateCustomer(actor, input));
}

export async function createLocation(
  input: unknown,
): Promise<ActionResult<{ locationId: string; customerId: string }>> {
  return run('createLocation', (actor) => customerService.createLocation(actor, input));
}

export async function updateLocation(
  input: unknown,
): Promise<ActionResult<{ locationId: string; customerId: string }>> {
  return run('updateLocation', (actor) => customerService.updateLocation(actor, input));
}
