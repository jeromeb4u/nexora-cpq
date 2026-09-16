/**
 * The instant a request is being rendered at.
 *
 * Exists so that reading the clock happens in exactly ONE place, with one
 * documented justification, rather than being scattered across pages.
 *
 * `react-hooks/purity` forbids calling `Date.now()` during render, and it is
 * right to for Client Components: a value that changes on every render produces
 * unstable output and server/client hydration mismatches. In a Server Component
 * the function body runs once per request and never re-renders, so capturing
 * the instant here is correct — and passing it down as a prop is what makes the
 * *consuming* components pure and their output stable.
 */
export function requestInstant(): number {
  return Date.now();
}
