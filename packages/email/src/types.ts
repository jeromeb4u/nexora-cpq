/**
 * Transactional email contract.
 *
 * The application depends on this interface, never on a vendor SDK. That is
 * what lets the demo run with no credentials at all (§22, §44): the default
 * provider writes to the log, and swapping to real delivery is a configuration
 * change rather than a code change.
 */

export interface EmailMessage {
  readonly to: string;
  readonly subject: string;
  /** Rendered HTML body. */
  readonly html: string;
  /** Plain-text alternative. Always provided — some clients and filters require it. */
  readonly text: string;
  /** Machine-readable template id, for logs and test assertions. */
  readonly template: EmailTemplateId;
}

export interface EmailSendResult {
  readonly provider: string;
  /** Provider message id, when the provider returns one. */
  readonly id: string | null;
}

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage & { readonly from: string }): Promise<EmailSendResult>;
}

export const EmailTemplateId = {
  APPROVAL_REQUESTED: 'approval-requested',
  APPROVAL_GRANTED: 'approval-granted',
  APPROVAL_REJECTED: 'approval-rejected',
  QUOTE_SENT: 'quote-sent',
} as const;
export type EmailTemplateId = (typeof EmailTemplateId)[keyof typeof EmailTemplateId];
