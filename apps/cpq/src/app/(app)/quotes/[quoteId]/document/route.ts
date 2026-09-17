import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getActor } from '@nexora/auth/session';
import { ERROR_STATUS, logger, toSafeError } from '@nexora/observability';
import { cuidSchema } from '@nexora/validation';

import { type DocumentAccess, generateQuoteDocument } from '@/lib/services/document-service';

export const dynamic = 'force-dynamic';

/**
 * The quote document as a PDF.
 *
 * Two ways in:
 *  - `?token=…` — the signed, expiring, version-bound link from a customer
 *    email. No session needed; the token is the authorization.
 *  - a signed-in user who can read the quote, optionally `?version=<id>` for a
 *    historical version.
 *
 * Served `inline` so it opens in the browser's viewer, and never cached: the
 * response is per-user and may be a draft.
 */
export async function GET(request: Request, { params }: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = await params;
  const url = new URL(request.url);
  const token = url.searchParams.get('token');

  try {
    let access: DocumentAccess;

    if (token) {
      access = { kind: 'token', token };
    } else {
      const actor = await getActor(await headers());
      if (!actor) {
        return NextResponse.json({ error: 'You must be signed in to do that.' }, { status: 401 });
      }
      const version = url.searchParams.get('version');
      const parsedVersion = version === null ? null : cuidSchema.safeParse(version);
      if (parsedVersion && !parsedVersion.success) {
        return NextResponse.json({ error: 'Quote document could not be found.' }, { status: 404 });
      }
      access = { kind: 'actor', actor, ...(parsedVersion ? { versionId: parsedVersion.data } : {}) };
    }

    const document = await generateQuoteDocument(access, quoteId);

    return new Response(new Uint8Array(document.bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(document.bytes.length),
        'Content-Disposition': `inline; filename="${document.fileName}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    const safe = toSafeError(error);
    logger.warn('quote document request failed', { quoteId, code: safe.code, reference: safe.reference });
    return NextResponse.json(
      { error: safe.message, reference: safe.reference },
      { status: ERROR_STATUS[safe.code] },
    );
  }
}
