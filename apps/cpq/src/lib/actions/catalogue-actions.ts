'use server';

import * as catalogue from '../services/catalogue-service';
import { type ActionResult, run } from './run';

/**
 * Catalogue and rule administration actions.
 *
 * Every one is gated on PRODUCT_MANAGE or RULE_MANAGE inside the service, so
 * hiding the buttons from other roles is a convenience, never the control.
 */

export async function createProduct(input: unknown): Promise<ActionResult<{ productId: string }>> {
  return run('createProduct', (actor) => catalogue.createProduct(actor, input));
}

export async function updateProduct(
  input: unknown,
): Promise<ActionResult<{ productId: string; changedFields: string[] }>> {
  return run('updateProduct', (actor) => catalogue.updateProduct(actor, input));
}

export async function setProductActive(
  input: unknown,
): Promise<ActionResult<{ productId: string; isActive: boolean; affectedQuotes: number }>> {
  return run('setProductActive', (actor) => catalogue.setProductActive(actor, input));
}

export async function createRule(input: unknown): Promise<ActionResult<{ ruleId: string }>> {
  return run('createRule', (actor) => catalogue.createRule(actor, input));
}

export async function updateRule(
  input: unknown,
): Promise<ActionResult<{ ruleId: string; changedFields: string[] }>> {
  return run('updateRule', (actor) => catalogue.updateRule(actor, input));
}

export async function setRuleActive(
  input: unknown,
): Promise<ActionResult<{ ruleId: string; isActive: boolean }>> {
  return run('setRuleActive', (actor) => catalogue.setRuleActive(actor, input));
}
