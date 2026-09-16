'use client';

import { createAuthClient } from 'better-auth/react';
import { inferAdditionalFields } from 'better-auth/client/plugins';

import type { Auth } from './server';

/**
 * The browser-side auth client.
 *
 * `inferAdditionalFields<Auth>()` carries the custom user fields (role,
 * jobTitle, isActive) through to the client's session type, so components get
 * `session.user.role` fully typed instead of casting.
 *
 * Note that the type-only import of `Auth` never pulls server code into the
 * bundle — it is erased at compile time.
 */
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_PLATFORM_URL ?? 'http://localhost:3000',
  plugins: [inferAdditionalFields<Auth>()],
});

export const { signIn, signOut, useSession, getSession } = authClient;
