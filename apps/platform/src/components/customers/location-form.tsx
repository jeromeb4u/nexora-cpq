'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Alert, Button, Field, Input, Label, Select, Switch, Textarea } from '@nexora/ui';
import { SERVICEABILITIES } from '@nexora/types';
import type { Serviceability } from '@nexora/types';
import { createLocationSchema, updateLocationSchema } from '@nexora/validation';

import { createLocation, updateLocation } from '@/lib/actions/customer-actions';
import { formResolver, trimmedOrUndefined } from './form-utils';

/**
 * `StatusBadge` (packages/ui) already carries this mapping for read-only
 * display; this is the editable-form equivalent. Kept local rather than
 * added to `./labels.ts`, which this task does not touch.
 */
const SERVICEABILITY_LABELS: Record<Serviceability, string> = {
  AVAILABLE: 'Available',
  LIMITED: 'Limited',
  UNAVAILABLE: 'Unavailable',
  PENDING_CHECK: 'Pending check',
};

interface LocationFormValues {
  name: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postalCode: string;
  country: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  existingConnectivity: string;
  serviceability: Serviceability;
  maxBandwidthMbps: string;
  isPrimary: boolean;
}

export interface LocationDefaultValues {
  readonly name: string;
  readonly addressLine1: string;
  readonly addressLine2: string | null;
  readonly city: string;
  readonly postalCode: string;
  readonly country: string;
  readonly contactName: string;
  readonly contactEmail: string;
  readonly contactPhone: string | null;
  readonly existingConnectivity: string | null;
  readonly serviceability: Serviceability;
  readonly maxBandwidthMbps: number | null;
  readonly isPrimary: boolean;
}

export interface LocationFormProps {
  readonly mode: 'create' | 'edit';
  readonly customerId: string;
  /** Required in edit mode; identifies the location being changed. */
  readonly locationId?: string;
  readonly defaultValues?: LocationDefaultValues;
}

const OPTIONAL_TEXT_KEYS: readonly (keyof LocationFormValues)[] = [
  'addressLine2',
  'contactPhone',
  'existingConnectivity',
];

/** Create or edit a customer site. Mirrors `CustomerForm`'s create/edit split. */
export function LocationForm({ mode, customerId, locationId, defaultValues }: LocationFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isDirty },
  } = useForm<LocationFormValues>({
    resolver: formResolver<LocationFormValues>(
      mode === 'create' ? createLocationSchema : updateLocationSchema,
      {
        optionalKeys: OPTIONAL_TEXT_KEYS,
        numericKeys: ['maxBandwidthMbps'],
        extra: {
          customerId,
          ...(mode === 'edit' && locationId ? { id: locationId } : {}),
        },
      },
    ),
    defaultValues: {
      name: defaultValues?.name ?? '',
      addressLine1: defaultValues?.addressLine1 ?? '',
      addressLine2: defaultValues?.addressLine2 ?? '',
      city: defaultValues?.city ?? '',
      postalCode: defaultValues?.postalCode ?? '',
      country: defaultValues?.country ?? 'DE',
      contactName: defaultValues?.contactName ?? '',
      contactEmail: defaultValues?.contactEmail ?? '',
      contactPhone: defaultValues?.contactPhone ?? '',
      existingConnectivity: defaultValues?.existingConnectivity ?? '',
      serviceability: defaultValues?.serviceability ?? 'PENDING_CHECK',
      maxBandwidthMbps: defaultValues?.maxBandwidthMbps
        ? String(defaultValues.maxBandwidthMbps)
        : '',
      isPrimary: defaultValues?.isPrimary ?? false,
    },
  });

  function onSubmit(values: LocationFormValues) {
    setServerError(null);

    // Creating: blank optional fields are omitted. Editing: they are sent as null
    // so the update schema clears them.
    const cleared = (value: string) =>
      trimmedOrUndefined(value) ?? (mode === 'edit' ? null : undefined);

    const trimmedBandwidth = values.maxBandwidthMbps.trim();

    const payload: Record<string, unknown> = {
      ...(mode === 'edit' && locationId ? { id: locationId } : {}),
      customerId,
      name: values.name.trim(),
      addressLine1: values.addressLine1.trim(),
      addressLine2: cleared(values.addressLine2),
      city: values.city.trim(),
      postalCode: values.postalCode.trim(),
      country: values.country.trim(),
      contactName: values.contactName.trim(),
      contactEmail: values.contactEmail.trim(),
      contactPhone: cleared(values.contactPhone),
      existingConnectivity: cleared(values.existingConnectivity),
      serviceability: values.serviceability,
      maxBandwidthMbps:
        trimmedBandwidth.length > 0 ? Number(trimmedBandwidth) : mode === 'edit' ? null : undefined,
      isPrimary: values.isPrimary,
    };

    startTransition(async () => {
      const result =
        mode === 'create' ? await createLocation(payload) : await updateLocation(payload);

      if (result.ok) {
        toast.success(mode === 'create' ? 'Location added' : 'Location updated');
        router.push(`/customers/${customerId}`);
        router.refresh();
      } else {
        setServerError(`${result.message} (Reference ${result.reference})`);
      }
    });
  }

  const cancelHref = `/customers/${customerId}`;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {serverError ? (
        <Alert variant="danger" title="Could not save this location">
          {serverError}
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Location name" required error={errors.name?.message}>
          <Input maxLength={200} {...register('name')} />
        </Field>

        <Field label="Address line 1" required error={errors.addressLine1?.message}>
          <Input maxLength={200} {...register('addressLine1')} />
        </Field>

        <Field label="Address line 2" error={errors.addressLine2?.message} description="Optional.">
          <Input maxLength={200} {...register('addressLine2')} />
        </Field>

        <Field label="City" required error={errors.city?.message}>
          <Input maxLength={100} {...register('city')} />
        </Field>

        <Field label="Postal code" required error={errors.postalCode?.message}>
          <Input maxLength={11} {...register('postalCode')} />
        </Field>

        <Field
          label="Country"
          required
          error={errors.country?.message}
          description="2-letter code, e.g. DE"
        >
          <Input maxLength={2} className="uppercase" {...register('country')} />
        </Field>

        <Field label="Contact name" required error={errors.contactName?.message}>
          <Input maxLength={200} {...register('contactName')} />
        </Field>

        <Field label="Contact email" required error={errors.contactEmail?.message}>
          <Input type="email" {...register('contactEmail')} />
        </Field>

        <Field label="Contact phone" error={errors.contactPhone?.message} description="Optional.">
          <Input type="tel" {...register('contactPhone')} />
        </Field>

        <Field label="Serviceability" required error={errors.serviceability?.message}>
          <Select {...register('serviceability')}>
            {SERVICEABILITIES.map((serviceability) => (
              <option key={serviceability} value={serviceability}>
                {SERVICEABILITY_LABELS[serviceability]}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Max bandwidth (Mbps)"
          error={errors.maxBandwidthMbps?.message}
          description="Optional. Leave blank if unknown."
        >
          <Input type="number" min={1} step={1} {...register('maxBandwidthMbps')} />
        </Field>
      </div>

      <Field
        label="Existing connectivity"
        error={errors.existingConnectivity?.message}
        description="Optional. What is already installed at this site."
      >
        <Textarea rows={3} maxLength={1000} {...register('existingConnectivity')} />
      </Field>

      <Controller
        control={control}
        name="isPrimary"
        render={({ field }) => (
          <div className="flex items-center gap-2">
            <Switch id="isPrimary" checked={field.value} onCheckedChange={field.onChange} />
            <Label htmlFor="isPrimary">Set as primary location</Label>
          </div>
        )}
      />

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" asChild>
          <Link href={cancelHref}>Cancel</Link>
        </Button>
        <Button
          type="submit"
          isLoading={isPending}
          disabled={mode === 'edit' && !isDirty && !isPending}
        >
          {mode === 'create' ? 'Add location' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
