import { z } from 'zod';
import { emailSchema, nonEmptyString } from './common';

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, { error: 'Your password must be at least 8 characters long.' }),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const updateProfileSchema = z.object({
  name: nonEmptyString(200),
  jobTitle: nonEmptyString(200).optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
