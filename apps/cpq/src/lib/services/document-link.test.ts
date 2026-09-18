import { beforeAll, describe, expect, it } from 'vitest';

import { createDocumentToken, verifyDocumentToken } from './document-link';

const NOW = 1_800_000_000;
const claims = {
  quoteId: 'cquote0000000000000000001',
  versionId: 'cversion00000000000000001',
  exp: NOW + 3600,
};

beforeAll(() => {
  process.env.BETTER_AUTH_SECRET = 'unit-tests-only-not-a-real-secret';
});

describe('document links', () => {
  it('round-trips valid claims', () => {
    expect(verifyDocumentToken(createDocumentToken(claims), NOW)).toEqual(claims);
  });

  it('rejects an expired token', () => {
    expect(verifyDocumentToken(createDocumentToken(claims), NOW + 3601)).toBeNull();
  });

  it('rejects a token whose claims were edited', () => {
    const [, signature] = createDocumentToken(claims).split('.');
    const forged = Buffer.from(
      JSON.stringify({ ...claims, quoteId: 'cother00000000000000000001' }),
    ).toString('base64url');
    expect(verifyDocumentToken(`${forged}.${signature}`, NOW)).toBeNull();
  });

  it('rejects a token signed with a different secret', () => {
    const token = createDocumentToken(claims);
    process.env.BETTER_AUTH_SECRET = 'a-different-secret-entirely';
    try {
      expect(verifyDocumentToken(token, NOW)).toBeNull();
    } finally {
      process.env.BETTER_AUTH_SECRET = 'unit-tests-only-not-a-real-secret';
    }
  });

  it.each(['', 'abc', 'a.b.c', '.', 'not-base64.sig'])(
    'rejects malformed input %j without throwing',
    (token) => {
      expect(verifyDocumentToken(token, NOW)).toBeNull();
    },
  );
});
