import type { Product } from '../src/generated/prisma/client';
import type { ProductSnapshot } from '@nexora/types';
import { bpsToRate, cents } from '@nexora/types';

/**
 * Helpers shared by the seed script.
 *
 * Kept separate from `seed.ts` so the scenario logic there reads as a narrative
 * rather than as plumbing.
 */

/**
 * Project a database Product onto the shape the CPQ engines consume.
 *
 * This is the same projection the application uses at runtime, which is the
 * point: seeded quotes are priced by the real pricing engine, so every figure
 * in the demo is genuinely derived rather than typed in by hand (§26).
 */
export function toProductSnapshot(product: Product): ProductSnapshot {
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    category: product.category,
    monthlyPrice: cents(product.monthlyPriceCents),
    setupPrice: cents(product.setupPriceCents),
    pricingModel: product.pricingModel,
    minContractMonths: product.minContractMonths,
    maxDiscountRate: bpsToRate(product.maxDiscountBps),
    bandwidthMbps: product.bandwidthMbps,
    isActive: product.isActive,
  };
}

/**
 * A small deterministic PRNG (mulberry32).
 *
 * The seed must produce the same database every time: a demo whose dashboard
 * numbers shift on every reseed is impossible to write documentation or
 * screenshots against, and impossible to assert on in an end-to-end test.
 */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(random: () => number, items: readonly T[]): T {
  const item = items[Math.floor(random() * items.length)];
  if (item === undefined) {
    throw new Error('pick() called with an empty array');
  }
  return item;
}

/** A date `daysAgo` days before the fixed reference point. */
export function daysAgo(reference: Date, days: number): Date {
  const date = new Date(reference);
  date.setUTCDate(date.getUTCDate() - days);
  return date;
}

export function daysFromNow(reference: Date, days: number): Date {
  return daysAgo(reference, -days);
}

/**
 * Quote numbers are sequential and human-facing, starting from a number that
 * looks like a system already in use rather than one that started yesterday.
 */
export function quoteNumber(index: number): string {
  return `QT-${10_470 + index}`;
}
