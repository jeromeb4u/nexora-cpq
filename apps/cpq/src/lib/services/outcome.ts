import type { EmailMessage } from '@nexora/email';

/**
 * What a service returns besides its data.
 *
 * Services decide *what* should happen after a commit — which pages are stale,
 * which emails are owed — but do not do it themselves. `revalidatePath` only
 * works inside a Next.js request and email must never be sent before the
 * transaction commits, so both are carried out by the thin action wrapper.
 * That also lets integration tests assert on the intended emails directly,
 * without a mail provider or a mock.
 */
export interface ServiceOutcome<T> {
  readonly data: T;
  readonly emails: readonly EmailMessage[];
  readonly revalidate: readonly string[];
}

export function outcome<T>(
  data: T,
  effects: { readonly emails?: readonly EmailMessage[]; readonly revalidate?: readonly string[] } = {},
): ServiceOutcome<T> {
  return { data, emails: effects.emails ?? [], revalidate: effects.revalidate ?? [] };
}

/**
 * An absolute URL on the public origin, for links inside emails.
 *
 * Emails are read outside the app, so relative links are useless. The public
 * origin is the Platform zone: every route, CPQ's included, is served from it
 * through the microfrontends edge.
 */
export function publicUrl(path: string): string {
  const origin =
    process.env.NEXT_PUBLIC_PLATFORM_URL ?? process.env.BETTER_AUTH_URL ?? 'http://localhost:3024';
  return new URL(path, origin).toString();
}
