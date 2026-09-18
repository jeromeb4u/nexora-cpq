'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Switch } from '@nexora/ui';

import { setRuleActive } from '@/lib/actions/catalogue-actions';

export interface RuleActiveToggleProps {
  readonly ruleId: string;
  readonly isActive: boolean;
}

/**
 * Enable or disable a rule from the list.
 *
 * Not optimistic: a disabled rule stops blocking quotes the moment it is
 * saved, so the switch waits for the server rather than showing a state the
 * configurator might not agree with.
 */
export function RuleActiveToggle({ ruleId, isActive }: RuleActiveToggleProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function toggle(next: boolean) {
    startTransition(async () => {
      const result = await setRuleActive({ id: ruleId, isActive: next });

      if (result.ok) {
        toast.success(next ? 'Rule enabled' : 'Rule disabled');
        router.refresh();
      } else {
        toast.error(result.message, { description: `Reference ${result.reference}` });
      }
    });
  }

  return (
    <Switch
      checked={isActive}
      disabled={isPending}
      onCheckedChange={toggle}
      aria-label={isActive ? 'Disable this rule' : 'Enable this rule'}
    />
  );
}
