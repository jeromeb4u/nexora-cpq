import { logger } from '@nexora/observability';

import type { EmailProvider } from '../types';

/**
 * Logs emails instead of sending them. The default.
 *
 * Only metadata is logged — recipient domain, subject, template — never the
 * body. Quote emails carry commercial figures, and a log aggregator is not an
 * appropriate place to copy customer pricing into (§40).
 */
export function createConsoleProvider(): EmailProvider {
  return {
    name: 'console',
    async send(message) {
      const recipientDomain = message.to.split('@')[1] ?? 'unknown';
      logger.info('email (console provider — not delivered)', {
        template: message.template,
        subject: message.subject,
        recipientDomain,
        textLength: message.text.length,
      });
      return { provider: 'console', id: null };
    },
  };
}
