import { z } from 'zod';
import { cuidSchema } from './common';

export const requestApprovalSchema = z.object({
  quoteId: cuidSchema,
  quoteVersionId: cuidSchema,
  justification: z
    .string()
    .trim()
    .min(10, { error: 'Explain why this quote needs approval, in at least 10 characters.' })
    .max(2000, { error: 'Please shorten the justification to 2000 characters or fewer.' }),
});
export type RequestApprovalInput = z.infer<typeof requestApprovalSchema>;

/**
 * A real discriminated union on `decision`, not an optional `decisionNote`
 * with a manual check: approving a quote never needs a note, but rejecting
 * one always does, and the type system enforces that distinction at each
 * branch rather than relying on a `superRefine` that could drift out of sync.
 */
const approvedDecisionSchema = z.object({
  approvalId: cuidSchema,
  decision: z.literal('APPROVED'),
});

const rejectedDecisionSchema = z.object({
  approvalId: cuidSchema,
  decision: z.literal('REJECTED'),
  decisionNote: z
    .string()
    .trim()
    .min(10, { error: 'Explain why this quote is being rejected, in at least 10 characters.' })
    .max(2000, { error: 'Please shorten the rejection note to 2000 characters or fewer.' }),
});

export const approvalDecisionSchema = z.discriminatedUnion('decision', [
  approvedDecisionSchema,
  rejectedDecisionSchema,
]);
export type ApprovalDecisionInput = z.infer<typeof approvalDecisionSchema>;
