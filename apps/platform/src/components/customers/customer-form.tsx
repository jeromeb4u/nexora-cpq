'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Alert, Button, Field, Input, Select, Textarea } from '@nexora/ui';
import { CUSTOMER_STATUSES, INDUSTRIES } from '@nexora/types';
import type { CustomerStatus, Industry, Role } from '@nexora/types';
import { createCustomerSchema, updateCustomerSchema } from '@nexora/validation';

import { createCustomer, updateCustomer } from '@/lib/actions/customer-actions';
import { CUSTOMER_STATUS_LABELS, INDUSTRY_LABELS } from './labels';
import { formResolver, trimmedOrUndefined } from './form-utils';

export interface AssignableOwner {
  readonly id: string;
  readonly name: string;
  readonly role: Role;
}

interface CustomerFormValues {
  companyName: string;
  legalName: string;
  industry: Industry;
  vatNumber: string;
  status: CustomerStatus;
  email: string;
  phone: string;
  website: string;
  notes: string;
  accountOwnerId: string;
}

export interface CustomerDefaultValues {
  readonly companyName: string;
  readonly legalName: string;
  readonly industry: Industry;
  readonly vatNumber: string;
  readonly status: CustomerStatus;
  readonly email: string;
  readonly phone: string;
  readonly website: string | null;
  readonly notes: string | null;
  readonly accountOwnerId: string;
}

export interface CustomerFormProps {
  readonly mode: 'create' | 'edit';
  /** The signed-in user's id and role — a Sales Rep may only own what they create. */
  readonly actor: { readonly id: string; readonly role: Role };
  readonly owners: readonly AssignableOwner[];
  /** Required in edit mode; identifies the customer being changed. */
  readonly customerId?: string;
  /** Required in edit mode; the customer's current values. */
  readonly defaultValues?: CustomerDefaultValues;
}

const OPTIONAL_TEXT_KEYS: readonly (keyof CustomerFormValues)[] = ['website', 'notes'];

/**
 * The single option a disabled, rep-locked owner Select may show. Falls back
 * to a synthetic entry for the rare case where the customer's existing owner
 * is no longer in the assignable-owners list (deactivated, or moved to a
 * role that can no longer own customers) — the id still round-trips
 * correctly since it is only shown, never a choice the rep can change it to.
 */
function lockedOwnerOptions(
  owners: readonly AssignableOwner[],
  lockedOwnerId: string,
  actorId: string,
): readonly AssignableOwner[] {
  const match = owners.find((owner) => owner.id === lockedOwnerId);
  if (match) return [match];
  return [
    {
      id: lockedOwnerId,
      name: lockedOwnerId === actorId ? 'You' : 'Current owner',
      role: 'SALES_REP',
    },
  ];
}

/**
 * Create or edit a customer.
 *
 * One component for both flows: the fields are identical, only the schema
 * validated against (`createCustomerSchema` vs `updateCustomerSchema`) and
 * the server action called differ. A Sales Rep cannot hand a customer to a
 * colleague — the owner picker is preset to themselves and disabled — but the
 * server enforces that rule independently (`customer-service.ts`); hiding the
 * control here is a convenience, not the access control.
 */
export function CustomerForm({
  mode,
  actor,
  owners,
  customerId,
  defaultValues,
}: CustomerFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const isRep = actor.role === 'SALES_REP';
  // A rep's locked owner is the customer's EXISTING owner when editing (which
  // may not be them — `CUSTOMER_UPDATE` is not owner-scoped, so a rep can fix
  // a phone number on a colleague's customer) and themselves only when
  // creating, where there is no existing owner yet. Forcing this to
  // `actor.id` unconditionally would silently reassign someone else's
  // customer to the editing rep on every save.
  const lockedOwnerId = mode === 'edit' && defaultValues ? defaultValues.accountOwnerId : actor.id;
  const initialOwnerId = isRep
    ? lockedOwnerId
    : (defaultValues?.accountOwnerId ?? owners[0]?.id ?? actor.id);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<CustomerFormValues>({
    resolver: formResolver<CustomerFormValues>(
      mode === 'create' ? createCustomerSchema : updateCustomerSchema,
      {
        optionalKeys: OPTIONAL_TEXT_KEYS,
        extra: mode === 'edit' && customerId ? { id: customerId } : undefined,
      },
    ),
    defaultValues: {
      companyName: defaultValues?.companyName ?? '',
      legalName: defaultValues?.legalName ?? '',
      industry: defaultValues?.industry ?? INDUSTRIES[0],
      vatNumber: defaultValues?.vatNumber ?? '',
      status: defaultValues?.status ?? 'PROSPECT',
      email: defaultValues?.email ?? '',
      phone: defaultValues?.phone ?? '',
      website: defaultValues?.website ?? '',
      notes: defaultValues?.notes ?? '',
      accountOwnerId: initialOwnerId,
    },
  });

  function onSubmit(values: CustomerFormValues) {
    setServerError(null);

    // Creating: a blank optional field is simply omitted. Editing: it is sent as
    // null, which the update schema reads as "clear this value".
    const cleared = (value: string) =>
      trimmedOrUndefined(value) ?? (mode === 'edit' ? null : undefined);

    const payload: Record<string, unknown> = {
      ...(mode === 'edit' && customerId ? { id: customerId } : {}),
      companyName: values.companyName.trim(),
      legalName: values.legalName.trim(),
      industry: values.industry,
      vatNumber: values.vatNumber.trim(),
      status: values.status,
      email: values.email.trim(),
      phone: values.phone.trim(),
      website: cleared(values.website),
      notes: cleared(values.notes),
      accountOwnerId: isRep ? lockedOwnerId : values.accountOwnerId,
    };

    startTransition(async () => {
      const result =
        mode === 'create' ? await createCustomer(payload) : await updateCustomer(payload);

      if (result.ok) {
        const targetId =
          mode === 'create' ? result.data.customerId : (customerId ?? result.data.customerId);
        toast.success(mode === 'create' ? 'Customer created' : 'Customer updated');
        router.push(`/customers/${targetId}`);
        router.refresh();
      } else {
        setServerError(`${result.message} (Reference ${result.reference})`);
      }
    });
  }

  const cancelHref = mode === 'edit' && customerId ? `/customers/${customerId}` : '/customers';

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {serverError ? (
        <Alert variant="danger" title="Could not save this customer">
          {serverError}
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company name" required error={errors.companyName?.message}>
          <Input autoComplete="organization" maxLength={200} {...register('companyName')} />
        </Field>

        <Field label="Legal name" required error={errors.legalName?.message}>
          <Input maxLength={200} {...register('legalName')} />
        </Field>

        <Field label="Industry" required error={errors.industry?.message}>
          <Select {...register('industry')}>
            {INDUSTRIES.map((industry) => (
              <option key={industry} value={industry}>
                {INDUSTRY_LABELS[industry]}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="VAT number"
          required
          error={errors.vatNumber?.message}
          description="e.g. DE123456789"
        >
          <Input maxLength={14} {...register('vatNumber')} />
        </Field>

        <Field label="Status" required error={errors.status?.message}>
          <Select {...register('status')}>
            {CUSTOMER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {CUSTOMER_STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Account owner"
          required
          error={errors.accountOwnerId?.message}
          description={
            isRep ? 'Sales representatives can only own the customers they create.' : undefined
          }
        >
          <Select {...register('accountOwnerId')} disabled={isRep}>
            {(isRep ? lockedOwnerOptions(owners, lockedOwnerId, actor.id) : owners).map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Email" required error={errors.email?.message}>
          <Input type="email" autoComplete="email" {...register('email')} />
        </Field>

        <Field label="Phone" required error={errors.phone?.message}>
          <Input type="tel" autoComplete="tel" {...register('phone')} />
        </Field>

        <Field
          label="Website"
          error={errors.website?.message}
          description="Optional. Include https://"
        >
          <Input type="url" placeholder="https://example.com" {...register('website')} />
        </Field>
      </div>

      <Field label="Notes" error={errors.notes?.message} description="Optional.">
        <Textarea rows={4} maxLength={4000} {...register('notes')} />
      </Field>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" asChild>
          <Link href={cancelHref}>Cancel</Link>
        </Button>
        <Button
          type="submit"
          isLoading={isPending}
          disabled={mode === 'edit' && !isDirty && !isPending}
        >
          {mode === 'create' ? 'Create customer' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
