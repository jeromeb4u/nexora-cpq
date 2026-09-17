'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signInSchema, type SignInInput } from '@nexora/validation';
import { Alert, Button, Field, Input } from '@nexora/ui';
import { authClient } from '@nexora/auth/client';

const DEMO_ACCOUNTS = [
  {
    email: 'sales@nexora.demo',
    label: 'Sales Representative',
    detail: 'John Smith — owns QT-10482, 10% discount authority',
  },
  {
    email: 'salesmanager@nexora.demo',
    label: 'Sales Manager',
    detail: 'Sarah Klein — approves up to 20%, has a quote waiting',
  },
  {
    email: 'pricing@nexora.demo',
    label: 'Pricing Administrator',
    detail: 'Priya Raman — owns the catalogue and the rules',
  },
  { email: 'admin@nexora.demo', label: 'Administrator', detail: 'Alex Turner — full access' },
] as const;

const DEMO_PASSWORD = 'NexoraDemo123!';

export function SignInForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  const busy = isPending || isSubmitting;

  async function onSubmit(values: SignInInput) {
    setFormError(null);

    const { error } = await authClient.signIn.email({
      email: values.email,
      password: values.password,
    });

    if (error) {
      // Deliberately generic: distinguishing "no such account" from "wrong
      // password" hands an attacker a user-enumeration oracle.
      setFormError('That email and password combination was not recognised.');
      return;
    }

    startTransition(() => {
      router.push(nextPath);
      router.refresh();
    });
  }

  function fillDemoAccount(email: string) {
    setValue('email', email, { shouldValidate: true });
    setValue('password', DEMO_PASSWORD, { shouldValidate: true });
    setFormError(null);
  }

  return (
    <div className="w-full max-w-sm">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {formError ? (
          <Alert variant="danger" title="Sign-in failed">
            {formError}
          </Alert>
        ) : null}

        <Field label="Work email" error={errors.email?.message} required>
          <Input
            type="email"
            autoComplete="username"
            placeholder="you@nexora.demo"
            autoFocus
            {...register('email')}
          />
        </Field>

        <Field label="Password" error={errors.password?.message} required>
          <Input type="password" autoComplete="current-password" {...register('password')} />
        </Field>

        <Button type="submit" className="w-full" isLoading={busy}>
          Sign in
        </Button>
      </form>

      <div className="mt-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-4">
        <p className="text-xs font-medium text-[var(--text-primary)]">Demo accounts</p>
        <p className="text-2xs mt-1 leading-relaxed text-[var(--text-tertiary)]">
          This is a fictional demonstration system. Choose a role to sign in — each sees a different
          slice of the product.
        </p>

        <ul className="mt-3 space-y-1.5">
          {DEMO_ACCOUNTS.map((account) => (
            <li key={account.email}>
              <button
                type="button"
                onClick={() => fillDemoAccount(account.email)}
                disabled={busy}
                className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-2 text-left transition-colors hover:border-[var(--accent-border)] hover:bg-[var(--surface-selected)] disabled:opacity-50"
              >
                <span className="block text-xs font-medium text-[var(--text-primary)]">
                  {account.label}
                </span>
                <span className="text-2xs block text-[var(--text-tertiary)]">{account.detail}</span>
              </button>
            </li>
          ))}
        </ul>

        <p className="text-2xs mt-3 font-mono text-[var(--text-tertiary)]">
          Password for all accounts: {DEMO_PASSWORD}
        </p>
      </div>
    </div>
  );
}
