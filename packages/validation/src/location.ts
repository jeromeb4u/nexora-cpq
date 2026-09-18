import { z } from 'zod';
import {
  countryCodeSchema,
  cuidSchema,
  emailSchema,
  nonEmptyString,
  phoneSchema,
  postalCodeSchema,
} from './common';
import { serviceabilitySchema } from './enums';

export const createLocationSchema = z.object({
  name: nonEmptyString(200),
  addressLine1: nonEmptyString(200),
  addressLine2: nonEmptyString(200).optional(),
  city: nonEmptyString(100),
  postalCode: postalCodeSchema,
  country: countryCodeSchema,
  contactName: nonEmptyString(200),
  contactEmail: emailSchema,
  contactPhone: phoneSchema.optional(),
  existingConnectivity: nonEmptyString(1000).optional(),
  serviceability: serviceabilitySchema.default('PENDING_CHECK'),
  maxBandwidthMbps: z
    .int({ error: 'Enter bandwidth as a whole number of Mbps.' })
    .positive({ error: 'Bandwidth must be greater than 0 Mbps.' })
    .optional(),
  isPrimary: z.boolean().default(false),
  customerId: cuidSchema,
});
export type CreateLocationInput = z.infer<typeof createLocationSchema>;

/**
 * Omitted key = leave unchanged; `null` on an optional column = clear it
 * (see `updateCustomerSchema`).
 */
export const updateLocationSchema = createLocationSchema.partial().extend({
  id: cuidSchema,
  // Redeclared without create-time defaults (see updateCustomerSchema).
  country: countryCodeSchema.optional(),
  serviceability: serviceabilitySchema.optional(),
  isPrimary: z.boolean().optional(),
  addressLine2: createLocationSchema.shape.addressLine2.unwrap().nullable().optional(),
  contactPhone: createLocationSchema.shape.contactPhone.unwrap().nullable().optional(),
  existingConnectivity: createLocationSchema.shape.existingConnectivity
    .unwrap()
    .nullable()
    .optional(),
  maxBandwidthMbps: createLocationSchema.shape.maxBandwidthMbps.unwrap().nullable().optional(),
});
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;
