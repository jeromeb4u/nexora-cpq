'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Alert, Button, Field, Input } from '@nexora/ui';
import { type UpdateProfileInput, updateProfileSchema } from '@nexora/validation';

import { updateOwnProfile } from '@/lib/actions/profile-actions';

export interface ProfileFormProps {
  readonly name: string;
  readonly jobTitle: string | null;
}

/**
 * Edit your own display name and job title.
 *
 * Uses the same Zod schema as the server action, so the form cannot accept
 * anything the server would then reject. The save is not optimistic: the
 * header shows the name everywhere, and flashing a value the server then
 * refused would be confusing for no benefit.
 */
export function ProfileForm({ name, jobTitle }: ProfileFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { name, jobTitle: jobTitle ?? undefined },
  });

  function onSubmit(values: UpdateProfileInput) {
    setError(null);
    startTransition(async () => {
      const result = await updateOwnProfile({
        name: values.name.trim(),
        jobTitle: values.jobTitle?.trim() || undefined,
      });

      if (result.ok) {
        toast.success('Profile updated');
        // Reset the dirty baseline to the saved values.
        reset({ name: values.name.trim(), jobTitle: values.jobTitle?.trim() || undefined });
        router.refresh();
      } else {
        setError(`${result.message} (Reference ${result.reference})`);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {error ? (
        <Alert variant="danger" title="Could not save your profile">
          {error}
        </Alert>
      ) : null}

      <Field label="Display name" required error={errors.name?.message}>
        <Input autoComplete="name" maxLength={200} {...register('name')} />
      </Field>

      <Field
        label="Job title"
        description="Shown to colleagues on quotes and approvals."
        error={errors.jobTitle?.message}
      >
        <Input autoComplete="organization-title" maxLength={200} {...register('jobTitle')} />
      </Field>

      <div className="flex justify-end">
        <Button type="submit" isLoading={isPending} disabled={!isDirty || isPending}>
          Save changes
        </Button>
      </div>
    </form>
  );
}
