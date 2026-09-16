/**
 * Money.
 *
 * Every monetary amount in this system is an integer number of **minor units**
 * (euro cents). Nothing anywhere holds a floating-point euro value.
 *
 * Why: binary floating point cannot represent 0.1 exactly, so repeated
 * accumulation of prices and percentage discounts drifts. A quote that renders
 * as €1,575.00 in the browser but stores 1574.9999999999998 is a real defect in
 * a system whose output is a contract. Integers are exact, compare cleanly,
 * index well in Postgres, and serialise over JSON without precision loss —
 * which matters because the server recomputes and must agree with itself
 * byte-for-byte (§33).
 *
 * The `Cents` brand makes the unit part of the type, so a raw euro number
 * cannot be passed where cents are expected without an explicit conversion.
 */

declare const centsBrand: unique symbol;

/** An exact monetary amount in euro cents. */
export type Cents = number & { readonly [centsBrand]: true };

/** The only currency this demo trades in. */
export const CURRENCY = 'EUR' as const;
export type Currency = typeof CURRENCY;

/** Construct a `Cents` value from an integer count of minor units. */
export function cents(value: number): Cents {
  if (!Number.isInteger(value)) {
    throw new RangeError(`Money must be a whole number of cents, received ${value}`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`Money value ${value} exceeds the safe integer range`);
  }
  return value as Cents;
}

/** Construct a `Cents` value from a major-unit (euro) amount. */
export function euros(value: number): Cents {
  return cents(Math.round(value * 100));
}

export const ZERO: Cents = 0 as Cents;

export function add(...amounts: readonly Cents[]): Cents {
  return cents(amounts.reduce<number>((total, amount) => total + amount, 0));
}

export function subtract(minuend: Cents, subtrahend: Cents): Cents {
  return cents(minuend - subtrahend);
}

/**
 * Multiply money by a whole quantity or a contract term.
 * Kept separate from `applyRate` so the intent is visible at the call site.
 */
export function multiply(amount: Cents, factor: number): Cents {
  if (!Number.isInteger(factor)) {
    throw new RangeError(`multiply() expects an integer factor, received ${factor}`);
  }
  return cents(amount * factor);
}

/**
 * Apply a rate (e.g. a 0.18 discount) to an amount.
 *
 * Rounds half away from zero, which is the convention commercial invoicing
 * expects and, unlike `Math.round`, is symmetric for negative amounts. All
 * rounding in the pricing engine funnels through here so the behaviour is
 * defined in exactly one place.
 */
export function applyRate(amount: Cents, rate: number): Cents {
  if (!Number.isFinite(rate)) {
    throw new RangeError(`Rate must be finite, received ${rate}`);
  }
  const raw = amount * rate;
  const rounded = raw < 0 ? -Math.round(-raw) : Math.round(raw);
  return cents(rounded);
}

/** Percentage of `part` relative to `whole`, as a 0..1 rate. Safe at zero. */
export function rateOf(part: Cents, whole: Cents): number {
  if (whole === 0) return 0;
  return part / whole;
}

export function isZero(amount: Cents): boolean {
  return amount === 0;
}

export function max(a: Cents, b: Cents): Cents {
  return a >= b ? a : b;
}

export function min(a: Cents, b: Cents): Cents {
  return a <= b ? a : b;
}

/**
 * Format for display. Server and client must produce identical strings, so the
 * locale is pinned rather than taken from the browser — a quote that reads
 * "1.575,00 €" for one user and "€1,575.00" for another is a support ticket.
 */
export function formatMoney(
  amount: Cents,
  options: { readonly locale?: string; readonly showCents?: boolean } = {},
): string {
  const { locale = 'de-DE', showCents = true } = options;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: CURRENCY,
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  }).format(amount / 100);
}

/** Format a 0..1 rate as a percentage string, e.g. 0.185 -> "18.5%". */
export function formatRate(rate: number, fractionDigits = 1): string {
  const percent = rate * 100;
  const rounded = Number(percent.toFixed(fractionDigits));
  return `${rounded}%`;
}
