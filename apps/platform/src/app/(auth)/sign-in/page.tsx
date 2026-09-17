import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { SignInForm } from '@/components/sign-in-form';
import { currentActor } from '@/lib/session';

export const metadata: Metadata = { title: 'Sign in' };

/**
 * Only internal paths are accepted as a post-sign-in destination. Echoing an
 * arbitrary `next` value back into a redirect is an open-redirect: an attacker
 * could send a link that signs the user in and bounces them to a look-alike
 * site with the referrer intact.
 */
function safeNextPath(raw: string | undefined): string {
  if (!raw) return '/dashboard';
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/dashboard';
  return raw;
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const actor = await currentActor();
  const { next } = await searchParams;
  const nextPath = safeNextPath(next);

  if (actor) redirect(nextPath);

  return (
    <>
      <div className="mb-8 flex flex-col items-center text-center">
        <svg viewBox="0 0 16 16" className="mb-3 size-9" aria-hidden focusable="false">
          <rect width="16" height="16" rx="3" fill="var(--accent-solid)" />
          <path
            d="M4.5 11.5v-7l7 7v-7"
            fill="none"
            stroke="var(--text-inverse)"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
          Nexora Telecom
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Configure, price and quote enterprise connectivity
        </p>
      </div>

      <SignInForm nextPath={nextPath} />

      <p className="text-2xs mt-10 max-w-sm text-center leading-relaxed text-[var(--text-tertiary)]">
        Nexora Telecom is a fictional company created for this portfolio project. All customers,
        pricing and quotes shown are invented demonstration data.
      </p>
    </>
  );
}
