'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button, ConfirmDialog } from '@nexora/ui';

import { setProductActive } from '@/lib/actions/catalogue-actions';

export interface ProductRowActionsProps {
  readonly productId: string;
  readonly sku: string;
  readonly isActive: boolean;
}

/**
 * Per-product actions for a catalogue administrator.
 *
 * Withdrawing asks first and then reports how many in-progress quotes include
 * the product — the server counts them, because only it can. Quotes already
 * sent are unaffected: their line items are snapshots.
 */
export function ProductRowActions({ productId, sku, isActive }: ProductRowActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function toggle() {
    startTransition(async () => {
      const result = await setProductActive({ id: productId, isActive: !isActive });
      setConfirming(false);

      if (!result.ok) {
        toast.error(result.message, { description: `Reference ${result.reference}` });
        return;
      }

      if (result.data.isActive) {
        toast.success(`${sku} is available to sell again`);
      } else if (result.data.affectedQuotes > 0) {
        toast.success(`${sku} withdrawn`, {
          description:
            result.data.affectedQuotes === 1
              ? '1 quote still being worked on includes it and will show an error.'
              : `${result.data.affectedQuotes} quotes still being worked on include it and will show an error.`,
        });
      } else {
        toast.success(`${sku} withdrawn from sale`);
      }
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex items-center justify-end gap-1">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/products/${productId}/edit`}>Edit</Link>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={isPending}
          onClick={() => (isActive ? setConfirming(true) : toggle())}
        >
          {isActive ? 'Withdraw' : 'Restore'}
        </Button>
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={(open) => {
          if (!isPending) setConfirming(open);
        }}
        title={`Withdraw ${sku} from sale?`}
        description="Reps will no longer be able to add it to a quote. Quotes that already include it keep their prices, but will show it as withdrawn until it is removed."
        confirmLabel="Withdraw product"
        tone="destructive"
        isLoading={isPending}
        onConfirm={toggle}
      />
    </>
  );
}
