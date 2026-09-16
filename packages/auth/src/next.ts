import 'server-only';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { type Actor, getActor } from './session';
import { type Permission, ROLE_PERMISSIONS, can } from './permissions';

/**
 * Next.js App Router adapter for the session layer.
 *
 * Lives in the auth package rather than being copied into each application.
 * Both micro frontends must enforce authentication identically, and two
 * hand-maintained copies of a security guard is exactly how one of them ends up
 * subtly weaker than the other. The framework-agnostic core stays in
 * `session.ts`; this file is only the adapter that reads `headers()` and
 * redirects.
 */

export type { Actor };

/** The current actor, or null. For layouts that render in both states. */
export async function currentActor(): Promise<Actor | null> {
  return getActor(await headers());
}

/** The current actor, or redirect to sign-in preserving the intended path. */
export async function requireSession(returnTo?: string): Promise<Actor> {
  const actor = await currentActor();
  if (!actor) {
    const target = returnTo ? `/sign-in?next=${encodeURIComponent(returnTo)}` : '/sign-in';
    redirect(target);
  }
  return actor;
}

/**
 * The current actor, or redirect — and to /forbidden if they lack `permission`.
 *
 * Every page rendering privileged data calls this. Hiding a nav item is not
 * access control; this is.
 */
export async function requirePagePermission(permission: Permission): Promise<Actor> {
  const actor = await requireSession();
  if (!can(actor.role, permission)) {
    redirect('/forbidden');
  }
  return actor;
}

/** The capability list for an actor, for nav rendering. */
export function permissionsOf(actor: Actor): readonly string[] {
  return ROLE_PERMISSIONS[actor.role];
}
