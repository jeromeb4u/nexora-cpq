/**
 * Authentication and authorization.
 *
 * Import surfaces are split deliberately:
 *   `@nexora/auth/permissions` — pure RBAC, safe anywhere (server or client)
 *   `@nexora/auth/server`      — the Better Auth instance, server only
 *   `@nexora/auth/client`      — the React client, browser only
 *
 * This barrel re-exports only the pure half, so importing `@nexora/auth` from a
 * Client Component can never drag the server instance into the bundle.
 */

export {
  can,
  canAll,
  canAny,
  canDecideApproval,
  canEditQuote,
  canReadQuote,
  Permission,
  quoteReadScope,
  QuoteScope,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  type QuoteAccessContext,
} from './permissions';
