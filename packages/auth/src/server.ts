import 'server-only';

import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { nextCookies } from 'better-auth/next-js';
import { prisma } from '@nexora/db';
import { ROLES, Role } from '@nexora/types';

/**
 * The Better Auth server instance.
 *
 * Security decisions worth naming:
 *
 *  - `role`, `managerId` and `isActive` are declared with `input: false`.
 *    Without that, Better Auth would accept them in a sign-up or profile-update
 *    body, and any visitor could register themselves as an ADMIN. They are
 *    server-owned fields, writable only through seeded data or an
 *    administrative action.
 *
 *  - Email verification is disabled and sign-up is closed. This is a
 *    demonstration system with fixed seeded accounts (§45); leaving open
 *    registration on a public demo would let anyone create accounts against
 *    the shared database.
 *
 *  - Sessions are cookie-based with a 7-day expiry and a rolling 1-day update
 *    window, so an active user is not signed out mid-quote.
 */

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days
const SESSION_UPDATE_AGE_SECONDS = 60 * 60 * 24; // refresh once a day

function requiredSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      'BETTER_AUTH_SECRET is missing or too short. Generate one with `openssl rand -base64 32` and set it in .env.',
    );
  }
  return secret;
}

/**
 * Origins allowed to call the auth endpoints.
 *
 * Better Auth rejects a request whose `Origin` header is not trusted, with a
 * bare 403 — which is correct CSRF defence and a real trap in a micro frontend.
 * The browser is served from the PROXY origin (the microfrontends dev proxy, or
 * the Vercel edge in production), not from the Platform app's own origin, so
 * the proxy origin has to be trusted explicitly or every mutation fails.
 *
 * Driven by environment so production lists real domains rather than localhost.
 */
function trustedOrigins(): string[] {
  const configured = (process.env.AUTH_TRUSTED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const origins = new Set<string>(configured);

  for (const candidate of [
    process.env.BETTER_AUTH_URL,
    process.env.NEXT_PUBLIC_PLATFORM_URL,
    process.env.NEXT_PUBLIC_CPQ_URL,
  ]) {
    if (candidate) origins.add(candidate);
  }

  if (process.env.NODE_ENV !== 'production') {
    // The local microfrontends proxy: the origin a developer actually browses.
    origins.add('http://localhost:3024');
  }

  if (process.env.VERCEL_URL) {
    origins.add(`https://${process.env.VERCEL_URL}`);
  }

  return [...origins];
}

export const auth = betterAuth({
  secret: requiredSecret(),
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
  trustedOrigins: trustedOrigins(),

  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),

  emailAndPassword: {
    enabled: true,
    // Closed system: accounts come from the seed, not from self-registration.
    disableSignUp: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
  },

  session: {
    expiresIn: SESSION_MAX_AGE_SECONDS,
    updateAge: SESSION_UPDATE_AGE_SECONDS,
  },

  user: {
    additionalFields: {
      role: {
        type: ROLES as unknown as string[],
        required: false,
        defaultValue: Role.SALES_REP,
        // Server-owned. Never accepted from a request body.
        input: false,
      },
      jobTitle: {
        type: 'string',
        required: false,
        input: true,
      },
      managerId: {
        type: 'string',
        required: false,
        input: false,
      },
      isActive: {
        type: 'boolean',
        required: false,
        defaultValue: true,
        input: false,
      },
    },
  },

  // Must remain the last plugin so it can set cookies on the outgoing response.
  plugins: [nextCookies()],
});

export type Auth = typeof auth;
