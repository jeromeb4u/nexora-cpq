import { logger } from '@nexora/observability';

import { createConsoleProvider } from './providers/console';
import { createFilesystemProvider } from './providers/filesystem';
import { createResendProvider } from './providers/resend';
import type { EmailMessage, EmailProvider, EmailSendResult } from './types';

export * from './types';
export {
  approvalGranted,
  approvalRejected,
  approvalRequested,
  escapeHtml,
  quoteSent,
  safeUrl,
  type ApprovalDecidedInput,
  type ApprovalRequestedInput,
  type QuoteSentInput,
} from './templates';

export interface EmailEnvironment {
  readonly EMAIL_PROVIDER?: string;
  readonly RESEND_API_KEY?: string;
  readonly VERCEL?: string;
}

/**
 * Choose a provider from the environment.
 *
 * Falls back to the console provider rather than throwing whenever real
 * delivery is misconfigured. A missing API key on a public demo must degrade to
 * "email is logged, not sent" — not to "approving a quote crashes".
 */
export function resolveEmailProvider(env: EmailEnvironment = process.env): EmailProvider {
  const requested = (env.EMAIL_PROVIDER ?? 'console').toLowerCase();

  if (requested === 'resend') {
    if (env.RESEND_API_KEY) return createResendProvider(env.RESEND_API_KEY);
    logger.warn('EMAIL_PROVIDER=resend but RESEND_API_KEY is not set; using console provider');
    return createConsoleProvider();
  }

  if (requested === 'filesystem') {
    if (env.VERCEL) {
      logger.warn('filesystem email provider is not usable on Vercel; using console provider');
      return createConsoleProvider();
    }
    return createFilesystemProvider();
  }

  return createConsoleProvider();
}

/**
 * Send a message without ever throwing.
 *
 * Email is a side effect of a business action, not part of it. Callers send
 * AFTER their database transaction commits, and a delivery failure is logged
 * and reported as `null` — it must never roll back an approval that has already
 * been recorded, nor surface to the user as though the approval failed.
 *
 * The trade-off, stated plainly: delivery is at-most-once. A crash between
 * commit and send loses that one email. The robust alternative is a
 * transactional outbox table drained by a worker, which this demo deliberately
 * avoids to stay inside free-tier limits (docs/DECISIONS.md).
 */
export async function sendEmail(
  message: EmailMessage,
  options: { readonly provider?: EmailProvider; readonly from?: string } = {},
): Promise<EmailSendResult | null> {
  const provider = options.provider ?? resolveEmailProvider();
  const from = options.from ?? process.env.EMAIL_FROM ?? 'quotes@nexora-telecom.demo';

  try {
    return await provider.send({ ...message, from });
  } catch (error) {
    logger.error('email delivery failed', {
      provider: provider.name,
      template: message.template,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
