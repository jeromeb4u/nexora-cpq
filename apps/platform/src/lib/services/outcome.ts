/**
 * What a service returns besides its data.
 *
 * Mirrors `apps/cpq/src/lib/services/outcome.ts`, minus email: nothing in the
 * customer/location workflow sends mail. Services decide *what* should happen
 * after a commit — which pages are stale — but do not do it themselves:
 * `revalidatePath` only works inside a Next.js request, so it is carried out
 * by the thin action wrapper after the service's transaction has committed.
 * That also lets integration tests call the service directly with no
 * Next.js request in play.
 */
export interface ServiceOutcome<T> {
  readonly data: T;
  readonly revalidate: readonly string[];
}

export function outcome<T>(
  data: T,
  effects: { readonly revalidate?: readonly string[] } = {},
): ServiceOutcome<T> {
  return { data, revalidate: effects.revalidate ?? [] };
}
