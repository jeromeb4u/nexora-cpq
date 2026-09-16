import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@nexora/ui';

import { requireSession } from '@/lib/session';
import { ROLE_LABELS } from '@nexora/auth/permissions';

export const metadata: Metadata = { title: 'Access denied' };

export default async function ForbiddenPage() {
  const actor = await requireSession();

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center py-16 text-center">
      <span
        className="mb-4 flex size-11 items-center justify-center rounded-full bg-[var(--color-danger-50)]"
        aria-hidden
      >
        <ShieldAlert className="size-5 text-[var(--color-danger-600)]" />
      </span>
      <h1 className="text-lg font-semibold text-[var(--text-primary)]">
        You do not have access to that page
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
        Your role is <strong className="font-medium">{ROLE_LABELS[actor.role]}</strong>, which does
        not include this capability. If you believe you should have it, ask an administrator to
        review your role.
      </p>
      <div className="mt-6">
        <Button asChild>
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
