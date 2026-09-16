import { redirect } from 'next/navigation';

import { currentActor } from '@/lib/session';

/** The root is a router, not a landing page: this is an internal tool. */
export default async function RootPage() {
  const actor = await currentActor();
  redirect(actor ? '/dashboard' : '/sign-in');
}
