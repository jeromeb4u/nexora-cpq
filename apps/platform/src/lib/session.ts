import 'server-only';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { type Actor, getActor } from '@nexora/auth/session';
import { type Permission, ROLE_PERMISSIONS, can } from '@nexora/auth/permissions';

/**
 * Next-flavoured session helpers.
 *
 * `@nexora/auth` stays framework-agnostic and throws on failure; this thin
 * layer adapts it to the App Router by reading `headers()` and redirecting.
 * Server Components call these; they never read cookies themselves.
 */

/** The current actor, or null. Use in layouts that render for both states. */
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
 * The current actor, or redirect — and a 403 page if they lack `permission`.
 *
 * Every page that renders privileged data calls this. Hiding a nav item is not
 * access control; this is.
 */
export async function requirePagePermission(permission: Permission): Promise<Actor> {
  const actor = await requireSession();
  if (!can(actor.role, permission)) {
    redirect('/forbidden');
  }
  return actor;
}

/** The capability list for the current actor, for nav rendering. */
export function permissionsOf(actor: Actor): readonly string[] {
  return ROLE_PERMISSIONS[actor.role];
}
