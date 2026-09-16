'use client';

import { createAuthClient } from 'better-auth/react';
import { inferAdditionalFields } from 'better-auth/client/plugins';

import type { Auth } from './server';

/**
 * The browser-side auth client.
 *
 * **`baseURL` is deliberately omitted so requests go to the CURRENT origin.**
 *
 * It is tempting to point this at the Platform app's URL, since Platform owns
 * the `/api/auth/*` route handler. That is wrong in a micro frontend, and it
 * fails in a very specific way: the CPQ app is served through the same origin
 * as Platform (the microfrontends proxy in development, the Vercel edge in
 * production), so a hardcoded `http://localhost:3000` turns an ordinary
 * same-origin call into a cross-origin one and the browser blocks the preflight.
 * Sign-out silently stops working, with a CORS error visible only in the
 * console.
 *
 * Same-origin is also simply correct: `/api/auth/*` is not claimed by CPQ in
 * `microfrontends.json`, so the proxy routes it to the default application —
 * Platform — which is exactly where it should land. The routing table, not the
 * client, decides which app answers.
 *
 * `inferAdditionalFields<Auth>()` carries the custom user fields (role,
 * jobTitle, isActive) through to the client's session type. The type-only
 * import of `Auth` is erased at compile time and never pulls server code into
 * the browser bundle.
 */
export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<Auth>()],
});

export const { signIn, signOut, useSession, getSession } = authClient;
