import { z } from 'zod';
import { countryCodeSchema, cuidSchema, emailSchema, nonEmptyString, phoneSchema, postalCodeSchema } from './common';
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

export const updateLocationSchema = createLocationSchema.partial().extend({
  id: cuidSchema,
});
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;
