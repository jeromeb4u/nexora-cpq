'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, CircleAlert, Download, ExternalLink, FileText, LoaderCircle } from 'lucide-react';
import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Progress,
} from '@nexora/ui';

import { createServerSentEventParser } from '@/lib/sse';
import { cn } from '../cn';

/** Mirrors DOCUMENT_STEPS on the server; the server's events drive the state. */
const STEPS = [
  { id: 'prepare', label: 'Preparing quote' },
  { id: 'pricing', label: 'Calculating pricing' },
  { id: 'validate', label: 'Validating configuration' },
  { id: 'render', label: 'Generating document' },
  { id: 'finalize', label: 'Finalizing quote' },
] as const;

type StepId = (typeof STEPS)[number]['id'];
type StepState = 'pending' | 'active' | 'done' | 'failed';

interface CompletedDocument {
  readonly url: string;
  readonly fileName: string;
  readonly byteLength: number;
}

interface FailedGeneration {
  readonly message: string;
  readonly reference: string | null;
}

export interface DocumentGeneratorProps {
  readonly quoteId: string;
  readonly quoteNumber: string;
  /** Generate a specific historical version instead of the current one. */
  readonly versionId?: string;
  readonly label?: string;
  readonly variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  readonly size?: 'sm' | 'md';
}

function initialSteps(): Record<StepId, StepState> {
  return {
    prepare: 'pending',
    pricing: 'pending',
    validate: 'pending',
    render: 'pending',
    finalize: 'pending',
  };
}

function isStepId(value: unknown): value is StepId {
  return STEPS.some((step) => step.id === value);
}

function base64ToBlob(base64: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: 'application/pdf' });
}

/**
 * Generates a quote PDF and shows the server's progress as it happens.
 *
 * The steps are not a timed animation: each one ticks when the server reports
 * that stage finished, over a Server-Sent Events stream.
 */
export function DocumentGenerator({
  quoteId,
  quoteNumber,
  versionId,
  label = 'Generate PDF',
  variant = 'outline',
  size = 'md',
}: DocumentGeneratorProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState(initialSteps);
  const [result, setResult] = useState<CompletedDocument | null>(null);
  const [failure, setFailure] = useState<FailedGeneration | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Release the PDF held in memory when it is replaced or the component goes.
  useEffect(() => {
    return () => {
      if (result) URL.revokeObjectURL(result.url);
    };
  }, [result]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function generate() {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setOpen(true);
    setRunning(true);
    setSteps(initialSteps());
    setResult(null);
    setFailure(null);

    let finished = false;

    try {
      const response = await fetch(`/quotes/${quoteId}/document/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify(versionId ? { versionId } : {}),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? 'The document service could not be reached.');
      }

      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      const push = createServerSentEventParser();

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;

        for (const event of push(value)) {
          const data = JSON.parse(event.data) as Record<string, unknown>;

          if (event.event === 'step' && isStepId(data.id)) {
            const id = data.id;
            const state: StepState = data.status === 'done' ? 'done' : 'active';
            setSteps((current) => ({ ...current, [id]: state }));
          } else if (event.event === 'complete' && typeof data.pdfBase64 === 'string') {
            finished = true;
            setResult({
              url: URL.createObjectURL(base64ToBlob(data.pdfBase64)),
              fileName: typeof data.fileName === 'string' ? data.fileName : `${quoteNumber}.pdf`,
              byteLength: typeof data.byteLength === 'number' ? data.byteLength : 0,
            });
            // The audit trail on the page now has a new entry.
            router.refresh();
          } else if (event.event === 'error') {
            finished = true;
            const failedStep = data.step;
            if (isStepId(failedStep))
              setSteps((current) => ({ ...current, [failedStep]: 'failed' }));
            setFailure({
              message:
                typeof data.message === 'string'
                  ? data.message
                  : 'The document could not be generated.',
              reference: typeof data.reference === 'string' ? data.reference : null,
            });
          }
        }
      }

      if (!finished) throw new Error('The connection closed before the document was ready.');
    } catch (error) {
      if (controller.signal.aborted) return;
      setFailure({
        message: error instanceof Error ? error.message : 'The document could not be generated.',
        reference: null,
      });
    } finally {
      if (abortRef.current === controller) setRunning(false);
    }
  }

  const completed = STEPS.filter((step) => steps[step.id] === 'done').length;

  return (
    <>
      <Button variant={variant} size={size} onClick={() => void generate()} disabled={running}>
        <FileText aria-hidden />
        {label}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) abortRef.current?.abort();
          setOpen(next);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quote document — {quoteNumber}</DialogTitle>
            <DialogDescription>
              Priced figures are verified and the configuration re-checked before the PDF is
              produced.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-4 py-4">
            <Progress
              value={(completed / STEPS.length) * 100}
              aria-label="Document generation progress"
            />

            <ol className="space-y-2" aria-live="polite">
              {STEPS.map((step) => {
                const state = steps[step.id];
                return (
                  <li key={step.id} className="flex items-center gap-2.5 text-sm">
                    <span className="flex size-5 items-center justify-center" aria-hidden>
                      {state === 'done' ? (
                        <Check className="size-4 text-[var(--color-success-600)]" />
                      ) : state === 'active' ? (
                        <LoaderCircle className="size-4 animate-spin text-[var(--accent-solid)]" />
                      ) : state === 'failed' ? (
                        <CircleAlert className="size-4 text-[var(--color-danger-600)]" />
                      ) : (
                        <span className="size-1.5 rounded-full bg-[var(--border-strong)]" />
                      )}
                    </span>
                    <span
                      className={cn(
                        state === 'pending'
                          ? 'text-[var(--text-tertiary)]'
                          : 'text-[var(--text-primary)]',
                        state === 'failed' && 'text-[var(--color-danger-600)]',
                      )}
                    >
                      {step.label}
                    </span>
                    <span className="sr-only">
                      {state === 'done'
                        ? 'complete'
                        : state === 'active'
                          ? 'in progress'
                          : state === 'failed'
                            ? 'failed'
                            : 'waiting'}
                    </span>
                  </li>
                );
              })}
            </ol>

            {failure ? (
              <Alert variant="danger" title="The document was not generated">
                {failure.message}
                {failure.reference ? ` Reference ${failure.reference}.` : ''}
              </Alert>
            ) : null}

            {result ? (
              <Alert variant="success" title="Document ready">
                {result.fileName} · {Math.max(1, Math.round(result.byteLength / 1024))} KB
              </Alert>
            ) : null}
          </div>

          <DialogFooter>
            {failure ? (
              <Button variant="outline" onClick={() => void generate()} disabled={running}>
                Try again
              </Button>
            ) : null}
            {result ? (
              <>
                <Button variant="outline" asChild>
                  <a href={result.url} download={result.fileName}>
                    <Download aria-hidden />
                    Download
                  </a>
                </Button>
                <Button asChild>
                  <a href={result.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink aria-hidden />
                    Open PDF
                  </a>
                </Button>
              </>
            ) : (
              <Button variant="ghost" onClick={() => setOpen(false)}>
                {running ? 'Cancel' : 'Close'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
