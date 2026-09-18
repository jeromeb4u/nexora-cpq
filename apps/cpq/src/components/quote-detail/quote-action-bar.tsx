'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button, ConfirmDialog } from '@nexora/ui';

import { createRevisionFrom, transitionQuoteStatus } from '@/lib/actions/quote-actions';
import type { QuoteAction } from '@/lib/quote-action-model';

export interface QuoteActionBarProps {
  readonly quoteId: string;
  readonly quoteNumber: string;
  readonly currentVersionId: string | null;
  readonly actions: readonly QuoteAction[];
}

const VARIANT = {
  primary: 'primary',
  secondary: 'outline',
  destructive: 'ghost',
} as const;

/**
 * Lifecycle actions for one quote.
 *
 * Not optimistic: every action here changes what a customer or approver sees,
 * so the buttons wait for the server and the page refreshes from the database
 * afterwards (§32). Irreversible or externally visible actions confirm first.
 */
export function QuoteActionBar({
  quoteId,
  quoteNumber,
  currentVersionId,
  actions,
}: QuoteActionBarProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Extract<QuoteAction, { kind: 'transition' }> | null>(
    null,
  );

  function run(action: Exclude<QuoteAction, { kind: 'link' }>) {
    setPendingId(action.id);
    startTransition(async () => {
      const result =
        action.kind === 'revise'
          ? currentVersionId
            ? await createRevisionFrom({ quoteId, sourceVersionId: currentVersionId })
            : null
          : await transitionQuoteStatus({ quoteId, toStatus: action.to });

      setPendingId(null);
      setConfirming(null);

      if (!result) {
        toast.error('This quote has no version to revise.');
        return;
      }
      if (result.ok) {
        toast.success(`${quoteNumber}: ${action.label.toLowerCase()} — done`);
        router.refresh();
      } else {
        toast.error(result.message, { description: `Reference ${result.reference}` });
      }
    });
  }

  if (actions.length === 0) return null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {actions.map((action) => {
          if (action.kind === 'link') {
            return (
              <Button key={action.id} variant={VARIANT[action.emphasis]} asChild>
                <Link href={action.href}>{action.label}</Link>
              </Button>
            );
          }

          return (
            <Button
              key={action.id}
              variant={VARIANT[action.emphasis]}
              className={
                action.emphasis === 'destructive' ? 'text-[var(--color-danger-600)]' : undefined
              }
              isLoading={isPending && pendingId === action.id}
              disabled={isPending}
              onClick={() => {
                if (action.kind === 'transition' && action.confirm) setConfirming(action);
                else run(action);
              }}
            >
              {action.label}
            </Button>
          );
        })}
      </div>

      {confirming?.confirm ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open && !isPending) setConfirming(null);
          }}
          title={confirming.confirm.title}
          description={confirming.confirm.description}
          confirmLabel={confirming.confirm.confirmLabel}
          tone={confirming.confirm.tone}
          isLoading={isPending}
          onConfirm={() => run(confirming)}
        />
      ) : null}
    </>
  );
}
