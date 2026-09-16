'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Alert, Button, Card, CardContent, Field, Input, Select, StatusBadge } from '@nexora/ui';
import type { Serviceability } from '@nexora/types';

import { createQuote } from '@/lib/actions/quote-actions';
import type { CustomerForPicker } from '@/lib/customers';

export interface NewQuoteFormProps {
  readonly customers: readonly CustomerForPicker[];
}

/**
 * Create a quote.
 *
 * Only identity is captured here — customer, site, and an optional deal name.
 * Products, term and discount all belong to the configurator, which is where
 * the rules can actually be evaluated against a chosen location.
 */
export function NewQuoteForm({ customers }: NewQuoteFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [customerId, setCustomerId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  const customer = useMemo(
    () => customers.find((candidate) => candidate.id === customerId),
    [customers, customerId],
  );

  const location = customer?.locations.find((candidate) => candidate.id === locationId);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!customerId) {
      setError('Choose the customer this quote is for.');
      return;
    }

    startTransition(async () => {
      const result = await createQuote({
        customerId,
        locationId: locationId || undefined,
        title: title.trim() || undefined,
      });

      if (result.ok) {
        toast.success('Quote created');
        router.push(`/quotes/${result.data.quoteId}/configure`);
      } else {
        setError(result.message);
        toast.error(result.message, { description: `Reference ${result.reference}` });
      }
    });
  }

  return (
    <Card>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {error ? (
            <Alert variant="danger" title="Could not create the quote">
              {error}
            </Alert>
          ) : null}

          <Field
            label="Customer"
            required
            description="Only prospects and active customers can be quoted."
          >
            <Select
              value={customerId}
              onChange={(event) => {
                setCustomerId(event.target.value);
                // The previous site belongs to a different customer.
                setLocationId('');
              }}
            >
              <option value="">Select a customer…</option>
              {customers.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.companyName}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Location"
            description="The site being served. Serviceability there decides what can be configured."
          >
            <Select
              value={locationId}
              onChange={(event) => setLocationId(event.target.value)}
              disabled={!customer}
            >
              <option value="">
                {customer ? 'Select a location…' : 'Choose a customer first'}
              </option>
              {customer?.locations.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name} — {candidate.city}
                </option>
              ))}
            </Select>
          </Field>

          {location ? <ServiceabilityNote location={location} /> : null}

          <Field
            label="Deal name"
            description="Optional. Helps you find this quote later, e.g. “Munich HQ network modernisation”."
          >
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Munich HQ network modernisation"
              maxLength={200}
            />
          </Field>

          <div className="flex justify-end gap-2 border-t border-[var(--border-subtle)] pt-4">
            <Button type="button" variant="ghost" onClick={() => router.push('/quotes')}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isPending}>
              Create and configure
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/**
 * Surface serviceability before the user invests time configuring.
 *
 * Telling someone at step 9 that the site cannot be served is a waste of their
 * afternoon; the configuration engine will block it, but the honest place to
 * say so is here.
 */
function ServiceabilityNote({
  location,
}: {
  readonly location: {
    readonly serviceability: Serviceability;
    readonly maxBandwidthMbps: number | null;
  };
}) {
  const bandwidth =
    location.maxBandwidthMbps === null
      ? null
      : location.maxBandwidthMbps >= 1000
        ? `${location.maxBandwidthMbps / 1000} Gbps`
        : `${location.maxBandwidthMbps} Mbps`;

  if (location.serviceability === 'UNAVAILABLE') {
    return (
      <Alert variant="danger" title="This location cannot be served">
        Nexora has no delivery capability at this address, so a quote for it cannot be completed.
        Choose another site, or raise a build request first.
      </Alert>
    );
  }

  if (location.serviceability === 'PENDING_CHECK') {
    return (
      <Alert variant="warning" title="Serviceability not yet confirmed">
        You can prepare a quote, but delivery dates stay provisional until the site survey
        completes.
      </Alert>
    );
  }

  return (
    <Alert variant="info" title="Serviceability">
      <span className="flex flex-wrap items-center gap-2">
        <StatusBadge status={location.serviceability} />
        {bandwidth ? <>Up to {bandwidth} deliverable at this site.</> : null}
      </span>
    </Alert>
  );
}
