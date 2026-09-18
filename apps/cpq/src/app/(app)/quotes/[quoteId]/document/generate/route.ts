import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getActor } from '@nexora/auth/session';
import { logger, toSafeError } from '@nexora/observability';
import { generateDocumentSchema } from '@nexora/validation';

import { type DocumentStepId, generateQuoteDocument } from '@/lib/services/document-service';
import { encodeServerSentEvent } from '@/lib/sse';

export const dynamic = 'force-dynamic';

/**
 * Generate a quote document, streaming progress as Server-Sent Events.
 *
 * POST, consumed with `fetch` rather than `EventSource`: generation is an
 * explicit user action that records an audit event, not a resource to link to
 * (the plain GET route serves that purpose), and a cross-site POST does not
 * carry the SameSite=Lax session cookie.
 *
 * Events:
 *   step      { id, status: 'active' | 'done' }
 *   complete  { fileName, sha256, byteLength, pdfBase64 }
 *   error     { step, message, reference }
 */
export async function POST(request: Request, { params }: { params: Promise<{ quoteId: string }> }) {
  const actor = await getActor(await headers());
  if (!actor) {
    return NextResponse.json({ error: 'You must be signed in to do that.' }, { status: 401 });
  }

  const { quoteId } = await params;
  const parsed = generateDocumentSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'The request was not valid.' }, { status: 422 });
  }
  const { versionId } = parsed.data;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encodeServerSentEvent(event, data));
      let current: DocumentStepId | null = null;

      try {
        const document = await generateQuoteDocument(
          { kind: 'actor', actor, ...(versionId ? { versionId } : {}) },
          quoteId,
          (step) => {
            if (current) send('step', { id: current, status: 'done' });
            current = step;
            send('step', { id: step, status: 'active' });
          },
        );
        if (current) send('step', { id: current, status: 'done' });

        send('complete', {
          fileName: document.fileName,
          sha256: document.sha256,
          byteLength: document.bytes.length,
          pdfBase64: document.bytes.toString('base64'),
        });
      } catch (error) {
        const safe = toSafeError(error);
        logger.warn('quote document generation failed', {
          quoteId,
          step: current,
          code: safe.code,
          reference: safe.reference,
          ...(safe.code === 'INTERNAL' && error instanceof Error ? { error: error.message } : {}),
        });
        send('error', { step: current, message: safe.message, reference: safe.reference });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      Connection: 'keep-alive',
      // Stops intermediary proxies holding the stream back until it ends.
      'X-Accel-Buffering': 'no',
    },
  });
}
