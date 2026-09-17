'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Alert, Button, Field, Textarea } from '@nexora/ui';
import type { DiscountEvaluation } from '@nexora/types';

import { requestApproval, transitionQuoteStatus } from '@/lib/actions/quote-actions';

export interface SubmitStepProps {
  readonly quoteId: string;
  readonly quoteNumber: string;
  readonly canProceed: boolean;
  readonly evaluation: DiscountEvaluation;
  readonly discountReason: string;
  readonly hasUnsavedWork: boolean;
  readonly onSaveFirst: () => Promise<boolean>;
  readonly onDone: () => void;
}

/**
 * The final step: hand the quote on.
 *
 * Which action is offered is derived from the discount evaluation, not chosen
 * by the user — a quote that needs approval cannot be marked "ready for review"
 * to sidestep the approver. The server enforces the same thing through the
 * state machine; this just avoids offering a button that would be refused.
 */
export function SubmitStep({
  quoteId,
  quoteNumber,
  canProceed,
  evaluation,
  discountReason,
  hasUnsavedWork,
  onSaveFirst,
  onDone,
}: SubmitStepProps) {
  const [isPending, startTransition] = useTransition();
  const [justification, setJustification] = useState(discountReason);
  const [error, setError] = useState<string | null>(null);

  /** Never submit a version the server has not seen. */
  async function ensureSaved(): Promise<boolean> {
    if (!hasUnsavedWork) return true;
    return onSaveFirst();
  }

  function handleRequestApproval() {
    setError(null);

    if (justification.trim().length < 10) {
      setError('Give the approver at least 10 characters explaining the request.');
      return;
    }

    startTransition(async () => {
      if (!(await ensureSaved())) return;

      // The version id is resolved server-side from the quote's current
      // version, so the client cannot request approval for a stale one.
      const result = await requestApproval({
        quoteId,
        quoteVersionId: await currentVersionId(quoteId),
        justification: justification.trim(),
      });

      if (result.ok) {
        toast.success(`${quoteNumber} sent for approval`);
        onDone();
      } else {
        setError(result.message);
      }
    });
  }

  function handleReadyForReview() {
    setError(null);

    startTransition(async () => {
      if (!(await ensureSaved())) return;

      const result = await transitionQuoteStatus({
        quoteId,
        toStatus: 'READY_FOR_REVIEW',
      });

      if (result.ok) {
        toast.success(`${quoteNumber} is ready for review`);
        onDone();
      } else {
        setError(result.message);
      }
    });
  }

  if (!canProceed) {
    return (
      <Alert variant="danger" title="This quote cannot be submitted yet">
        The configuration has blocking issues, or nothing has been selected. Go back and resolve
        the errors listed against each step.
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <Alert variant="danger" title="Could not submit">
          {error}
        </Alert>
      ) : null}

      {evaluation.exceedsAllRoles ? (
        <Alert variant="danger" title="Discount is above the maximum anyone may approve">
          {evaluation.explanation}
        </Alert>
      ) : evaluation.requiresApproval ? (
        <>
          <Alert variant="warning" title="This quote needs approval">
            {evaluation.explanation}
          </Alert>

          <Field
            label="Justification for the approver"
            required
            description="This is what an approver sees first, and it stays on the audit trail."
          >
            <Textarea
              rows={4}
              value={justification}
              onChange={(event) => setJustification(event.target.value)}
              maxLength={2000}
            />
          </Field>

          <Button onClick={handleRequestApproval} isLoading={isPending}>
            Send for approval
          </Button>
        </>
      ) : (
        <>
          <Alert variant="success" title="Within your authority">
            {evaluation.explanation} No approval is needed — mark it ready for review to move it
            forward.
          </Alert>

          <Button onClick={handleReadyForReview} isLoading={isPending}>
            Mark ready for review
          </Button>
        </>
      )}
    </div>
  );
}

/**
 * Resolve the quote's current version id.
 *
 * Fetched fresh rather than held in client state: autosave may have created a
 * newer version since this component mounted, and requesting approval for a
 * superseded version would approve figures nobody is looking at.
 */
async function currentVersionId(quoteId: string): Promise<string> {
  const response = await fetch(`/quotes/${quoteId}/current-version`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Could not determine the current version of this quote.');
  }

  const body = (await response.json()) as { versionId: string };
  return body.versionId;
}
