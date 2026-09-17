import type { EmailProvider } from '../types';

/**
 * Real delivery through Resend's HTTP API.
 *
 * Deliberately a `fetch` call rather than the vendor SDK: one endpoint, no extra
 * dependency, and nothing in the bundle for the (default) case where real email
 * is never sent. The API key is read at call time and never logged.
 */
export function createResendProvider(apiKey: string): EmailProvider {
  return {
    name: 'resend',
    async send(message) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: message.from,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
      });

      if (!response.ok) {
        // Status only: the response body can echo the request, including the address.
        throw new Error(`Resend rejected the message with HTTP ${response.status}`);
      }

      const body = (await response.json()) as { id?: string };
      return { provider: 'resend', id: body.id ?? null };
    },
  };
}
