import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { prisma } from '@nexora/db';
import { getActor } from '@nexora/auth/session';
import { teamIdsFor } from '@nexora/auth/scope';
import { canReadQuote } from '@nexora/auth/permissions';
import { ERROR_STATUS, toSafeError } from '@nexora/observability';

/**
 * The id of a quote's current version.
 *
 * Exists because autosave may create a new version after the configurator
 * mounted; requesting approval against a stale version would send figures
 * nobody is looking at to an approver.
 *
 * Lives under `/quotes/*` rather than `/api/*` on purpose: only the paths listed
 * in microfrontends.json reach this zone, and `/api/*` belongs to Platform.
 *
 * Authorized like every other read: an invisible quote reports as not-found, so
 * this endpoint cannot be used to probe which quote ids exist.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ quoteId: string }> }) {
  try {
    const actor = await getActor(await headers());
    if (!actor) {
      return NextResponse.json({ error: 'You must be signed in to do that.' }, { status: 401 });
    }

    const { quoteId } = await params;
    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      select: { id: true, ownerId: true, currentVersionId: true },
    });

    const visible =
      quote !== null &&
      canReadQuote({
        actorId: actor.id,
        actorRole: actor.role,
        quoteOwnerId: quote.ownerId,
        teamMemberIds: await teamIdsFor(actor),
      });

    if (!quote || !visible || !quote.currentVersionId) {
      return NextResponse.json({ error: 'Quote not found.' }, { status: 404 });
    }

    return NextResponse.json(
      { versionId: quote.currentVersionId },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const safe = toSafeError(error);
    return NextResponse.json(
      { error: safe.message, reference: safe.reference },
      { status: ERROR_STATUS[safe.code] },
    );
  }
}
