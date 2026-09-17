import { describe, expect, it, vi } from 'vitest';
import { cents } from '@nexora/types';

import {
  type EmailProvider,
  EmailTemplateId,
  approvalRejected,
  approvalRequested,
  escapeHtml,
  quoteSent,
  resolveEmailProvider,
  safeUrl,
  sendEmail,
} from './index';

describe('escaping', () => {
  it('neutralises markup in user-authored text', () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;',
    );
    expect(escapeHtml(`O'Brien & Sons`)).toBe('O&#39;Brien &amp; Sons');
  });

  it('only allows http(s) links', () => {
    expect(safeUrl('https://nexora.demo/quotes/1')).toBe('https://nexora.demo/quotes/1');
    expect(safeUrl('javascript:alert(1)')).toBeNull();
    expect(safeUrl('data:text/html,<b>x</b>')).toBeNull();
    expect(safeUrl('not a url')).toBeNull();
  });
});

describe('templates', () => {
  const base = {
    to: 'manager@nexora.demo',
    quoteNumber: 'QT-10482',
    customerName: 'ACME GmbH',
    requesterName: 'John Smith',
    requestedRate: 0.18,
    allowedRate: 0.1,
    mrr: cents(414_343),
    tcv: cents(15_761_348),
    justification: 'Competitive bid against the incumbent.',
    url: 'https://nexora.demo/approvals',
  };

  it('renders an approval request with the figures an approver needs', () => {
    const message = approvalRequested(base);

    expect(message.template).toBe(EmailTemplateId.APPROVAL_REQUESTED);
    expect(message.subject).toContain('QT-10482');
    expect(message.html).toContain('18%');
    expect(message.text).toContain('Competitive bid against the incumbent.');
    expect(message.text).toContain('https://nexora.demo/approvals');
  });

  it('escapes a hostile justification in the HTML body', () => {
    const message = approvalRequested({
      ...base,
      justification: '<a href="https://evil.example">Click to approve</a>',
    });

    expect(message.html).not.toContain('<a href="https://evil.example">');
    expect(message.html).toContain('&lt;a href=&quot;https://evil.example&quot;&gt;');
  });

  it('drops an action link that is not http(s)', () => {
    const message = approvalRequested({ ...base, url: 'javascript:alert(1)' });
    expect(message.html).not.toContain('javascript:');
  });

  it('includes the rejection reason, escaped', () => {
    const message = approvalRejected({
      to: 'sales@nexora.demo',
      quoteNumber: 'QT-10482',
      customerName: 'ACME GmbH',
      approverName: 'Sarah Klein',
      rate: 0.26,
      note: 'Margin below <floor>',
      url: 'https://nexora.demo/quotes/1',
    });

    expect(message.html).toContain('Margin below &lt;floor&gt;');
    expect(message.text).toContain('Margin below <floor>');
  });

  it('renders a customer-facing quote with validity when provided', () => {
    const message = quoteSent({
      to: 'buyer@acme.demo',
      contactName: 'Klaus Berger',
      customerName: 'ACME GmbH',
      quoteNumber: 'QT-10482',
      mrr: cents(414_343),
      otc: cents(845_000),
      tcv: cents(15_761_348),
      contractMonths: 36,
      validUntil: new Date('2026-10-16T00:00:00Z'),
      representativeName: 'John Smith',
      documentUrl: 'https://nexora.demo/api/quotes/1/document',
    });

    expect(message.template).toBe(EmailTemplateId.QUOTE_SENT);
    expect(message.text).toContain('36 months');
    expect(message.text).toContain('Valid until');
  });
});

describe('provider selection', () => {
  it('defaults to the console provider', () => {
    expect(resolveEmailProvider({}).name).toBe('console');
  });

  it('degrades to console when Resend is requested without a key', () => {
    expect(resolveEmailProvider({ EMAIL_PROVIDER: 'resend' }).name).toBe('console');
  });

  it('uses Resend when configured', () => {
    expect(resolveEmailProvider({ EMAIL_PROVIDER: 'resend', RESEND_API_KEY: 're_test' }).name).toBe(
      'resend',
    );
  });

  it('refuses the filesystem provider on Vercel', () => {
    expect(resolveEmailProvider({ EMAIL_PROVIDER: 'filesystem', VERCEL: '1' }).name).toBe('console');
  });
});

describe('sendEmail', () => {
  const message = approvalRequested({
    to: 'm@nexora.demo',
    quoteNumber: 'QT-1',
    customerName: 'C',
    requesterName: 'R',
    requestedRate: 0.2,
    allowedRate: 0.1,
    mrr: cents(100),
    tcv: cents(100),
    justification: 'Because reasons apply here.',
    url: 'https://nexora.demo',
  });

  it('passes the sender address to the provider', async () => {
    const send = vi.fn().mockResolvedValue({ provider: 'fake', id: 'abc' });
    const provider: EmailProvider = { name: 'fake', send };

    const result = await sendEmail(message, { provider, from: 'quotes@nexora.demo' });

    expect(result).toEqual({ provider: 'fake', id: 'abc' });
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ from: 'quotes@nexora.demo' }));
  });

  it('never throws when delivery fails', async () => {
    const provider: EmailProvider = {
      name: 'broken',
      send: vi.fn().mockRejectedValue(new Error('SMTP on fire')),
    };

    await expect(sendEmail(message, { provider })).resolves.toBeNull();
  });
});
