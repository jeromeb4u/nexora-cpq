import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Signed, expiring links to a quote document.
 *
 * A customer who receives a quote by email has no account, so the link in that
 * email cannot rely on a session. Instead it carries a token that binds the
 * quote, the exact version that was sent, and an expiry, signed with a key
 * derived from the server secret.
 *
 * Binding the version matters: if the quote is later revised, the customer's
 * link still shows what they were actually offered, never a newer draft.
 */

interface DocumentClaims {
  readonly quoteId: string;
  readonly versionId: string;
  /** Expiry, seconds since the epoch. */
  readonly exp: number;
}

function signingKey(): Buffer {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error('BETTER_AUTH_SECRET is not set; document links cannot be signed.');
  }
  // Derive a purpose-specific key so a document signature can never be
  // replayed as anything else signed with the same root secret.
  return createHmac('sha256', secret).update('nexora:quote-document:v1').digest();
}

function sign(payload: string): string {
  return createHmac('sha256', signingKey()).update(payload).digest('base64url');
}

export function createDocumentToken(claims: DocumentClaims): string {
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

/** The claims of a valid, unexpired token — or null. Never throws on bad input. */
export function verifyDocumentToken(
  token: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): DocumentClaims | null {
  const [payload, signature, ...rest] = token.split('.');
  if (!payload || !signature || rest.length > 0) return null;

  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as unknown;
    if (
      typeof claims !== 'object' ||
      claims === null ||
      typeof (claims as DocumentClaims).quoteId !== 'string' ||
      typeof (claims as DocumentClaims).versionId !== 'string' ||
      typeof (claims as DocumentClaims).exp !== 'number'
    ) {
      return null;
    }
    const typed = claims as DocumentClaims;
    return typed.exp > nowSeconds ? typed : null;
  } catch {
    return null;
  }
}
