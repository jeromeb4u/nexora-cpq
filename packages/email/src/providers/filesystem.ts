import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import type { EmailProvider } from '../types';

/**
 * Writes each email to `.mail/` as an HTML file, for eyeballing rendered
 * templates during development without a mail server.
 *
 * Not for production: serverless filesystems are read-only or ephemeral, which
 * is why `resolveEmailProvider` refuses this provider when running on Vercel.
 */
export function createFilesystemProvider(directory = resolve(process.cwd(), '.mail')): EmailProvider {
  return {
    name: 'filesystem',
    async send(message) {
      await mkdir(directory, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const file = join(directory, `${stamp}-${randomUUID().slice(0, 8)}-${message.template}.html`);
      const document = `<!-- to: ${message.to} | from: ${message.from} | subject: ${message.subject} -->\n${message.html}`;
      await writeFile(file, document, 'utf8');
      return { provider: 'filesystem', id: file };
    },
  };
}
