import Link from 'next/link';
import { Button, Card, CardHeader, CardTitle, EmptyState, StatusBadge } from '@nexora/ui';
import type { Serviceability } from '@nexora/types';

import { formatBandwidth } from './labels';

export interface LocationRow {
  readonly id: string;
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

export interface LocationsSectionProps {
  readonly locations: readonly LocationRow[];
  readonly customerId: string;
  /** Render "Add location" / per-location "Edit" only for viewers who hold `LOCATION_MANAGE`. */
  readonly canManageLocations: boolean;
}

/** Sites on file for this customer, primary first — see `getCustomerDetail`. */
export function LocationsSection({
  locations,
  customerId,
  canManageLocations,
}: LocationsSectionProps) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Locations</CardTitle>
        {canManageLocations ? (
          <Button asChild variant="secondary" size="sm">
            <Link href={`/customers/${customerId}/locations/new`}>Add location</Link>
          </Button>
        ) : null}
      </CardHeader>
      {locations.length === 0 ? (
        <EmptyState
          title="No locations on file"
          description="Sites added for this customer will appear here."
        />
      ) : (
        <ul className="divide-y divide-[var(--border-subtle)]">
          {locations.map((location) => (
            <li key={location.id} className="flex flex-col gap-2 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-[var(--text-primary)]">{location.name}</p>
                  {location.isPrimary ? (
                    <span className="text-2xs rounded-full border border-[var(--accent-border)] bg-[var(--surface-selected)] px-2 py-0.5 font-medium text-[var(--text-link)]">
                      Primary
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={location.serviceability} />
                  {canManageLocations ? (
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/customers/${customerId}/locations/${location.id}/edit`}>
                        Edit
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </div>

              <p className="text-xs text-[var(--text-secondary)]">
                {location.addressLine1}
                {location.addressLine2 ? `, ${location.addressLine2}` : ''}, {location.city}{' '}
                {location.postalCode}, {location.country}
              </p>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-tertiary)]">
                <span>
                  Contact: {location.contactName} ({location.contactEmail})
                </span>
                <span>
                  Max bandwidth:{' '}
                  {location.maxBandwidthMbps !== null
                    ? formatBandwidth(location.maxBandwidthMbps)
                    : 'Unknown'}
                </span>
                {location.existingConnectivity ? (
                  <span>Existing: {location.existingConnectivity}</span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
