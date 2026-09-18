'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button, ConfirmDialog } from '@nexora/ui';

import { createRevisionFrom } from '@/lib/actions/quote-actions';

export interface RestoreVersionButtonProps {
  readonly quoteId: string;
  readonly versionId: string;
  readonly versionNumber: number;
}

/**
 * Bring an old version back as a NEW version on top of the history.
 *
 * The wording is deliberate — "restore as new version", not "revert" — because
 * nothing is rolled back: the source row is copied and every later version
 * stays exactly as it was.
 */
export function RestoreVersionButton({
  quoteId,
  versionId,
  versionNumber,
}: RestoreVersionButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function restore() {
    startTransition(async () => {
      const result = await createRevisionFrom({ quoteId, sourceVersionId: versionId });
      setOpen(false);
      if (result.ok) {
        toast.success(`Version ${versionNumber} restored as version ${result.data.versionNumber}`);
        router.refresh();
      } else {
        toast.error(result.message, { description: `Reference ${result.reference}` });
      }
    });
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} disabled={isPending}>
        Restore
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={(next) => {
          if (!isPending) setOpen(next);
        }}
        title={`Restore version ${versionNumber}?`}
        description="Its products, term and discount are copied into a new current version. Existing versions are not changed, and any approval must be obtained again."
        confirmLabel="Restore as new version"
        isLoading={isPending}
        onConfirm={restore}
      />
    </>
  );
}
