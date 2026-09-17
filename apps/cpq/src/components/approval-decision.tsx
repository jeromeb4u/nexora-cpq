'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Textarea,
} from '@nexora/ui';

import { decideApproval } from '@/lib/actions/quote-actions';

export interface ApprovalDecisionProps {
  readonly approvalId: string;
  readonly quoteNumber: string;
  /**
   * Whether this approver's own authority covers the requested discount. When
   * it does not they may still reject, and the server refuses an approval anyway.
   */
  readonly canApprove: boolean;
}

/**
 * Approve / reject controls.
 *
 * Deliberately NOT optimistic (§32). An approval is a financial authorisation:
 * rolling one back in the UI after the server refused would mean briefly
 * telling a manager they had approved a discount that they had not. The buttons
 * disable and wait for the server's answer instead.
 *
 * Rejection opens a dialog because a reason is mandatory — the schema is a
 * discriminated union where REJECTED requires a note, so the server would
 * refuse a rejection without one regardless.
 */
export function ApprovalDecision({ approvalId, quoteNumber, canApprove }: ApprovalDecisionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);

  function handleApprove() {
    startTransition(async () => {
      const result = await decideApproval({ approvalId, decision: 'APPROVED' });

      if (result.ok) {
        toast.success(`${quoteNumber} approved`);
        router.refresh();
      } else {
        toast.error(result.message, { description: `Reference ${result.reference}` });
      }
    });
  }

  function handleReject() {
    if (note.trim().length < 10) {
      setNoteError('Explain the rejection in at least 10 characters so the rep can act on it.');
      return;
    }
    setNoteError(null);

    startTransition(async () => {
      const result = await decideApproval({
        approvalId,
        decision: 'REJECTED',
        decisionNote: note.trim(),
      });

      if (result.ok) {
        toast.success(`${quoteNumber} rejected`);
        setRejectOpen(false);
        setNote('');
        router.refresh();
      } else {
        toast.error(result.message, { description: `Reference ${result.reference}` });
      }
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {canApprove ? (
          <Button onClick={handleApprove} isLoading={isPending} disabled={isPending}>
            Approve
          </Button>
        ) : (
          <span className="text-2xs text-[var(--text-tertiary)]">Above your approval authority</span>
        )}
        <Button
          variant="outline"
          onClick={() => setRejectOpen(true)}
          disabled={isPending}
        >
          Reject
        </Button>
      </div>

      <Dialog
        open={rejectOpen}
        onOpenChange={(open) => {
          setRejectOpen(open);
          if (!open) setNoteError(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject {quoteNumber}</DialogTitle>
            <DialogDescription>
              The sales representative sees this reason. Be specific enough that they can re-bid
              without guessing.
            </DialogDescription>
          </DialogHeader>

          <Field
            label="Reason for rejection"
            required
            error={noteError}
            description="Minimum 10 characters."
          >
            <Textarea
              rows={4}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="e.g. Margin at 26% is below the floor for this segment. Re-bid at no more than 20%, or extend to a 60-month term."
            />
          </Field>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject} isLoading={isPending}>
              Reject quote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
