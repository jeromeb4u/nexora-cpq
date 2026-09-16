import { describe, expect, it } from 'vitest';

import { redact } from './logger';
import { AppError, ErrorCode, isAppError, newErrorReference, toSafeError } from './errors';

describe('log redaction', () => {
  it('strips obviously credential-shaped keys', () => {
    const result = redact({
      email: 'sales@nexora.demo',
      password: 'hunter2',
      apiKey: 'sk-live-123',
      authorization: 'Bearer abc',
    }) as Record<string, unknown>;

    expect(result.email).toBe('sales@nexora.demo');
    expect(result.password).toBe('[redacted]');
    expect(result.apiKey).toBe('[redacted]');
    expect(result.authorization).toBe('[redacted]');
  });

  it('matches regardless of casing, hyphens or underscores', () => {
    const result = redact({
      'X-Auth-Token': 'abc',
      DATABASE_URL: 'postgres://user:pw@host/db',
      userPassword: 'x',
      api_key: 'y',
    }) as Record<string, unknown>;

    expect(Object.values(result).every((value) => value === '[redacted]')).toBe(true);
  });

  it('redacts through nested objects and arrays', () => {
    const result = redact({
      user: { name: 'Jerome', session: { token: 'abc' } },
      items: [{ secret: 'one' }, { safe: 'two' }],
    }) as Record<string, Record<string, unknown>>;

    expect(result.user?.session).toBe('[redacted]');
    expect((result.items as unknown as Record<string, unknown>[])[0]?.secret).toBe('[redacted]');
    expect((result.items as unknown as Record<string, unknown>[])[1]?.safe).toBe('two');
  });

  it('leaves ordinary values untouched', () => {
    expect(redact({ count: 3, ok: true, nothing: null })).toEqual({
      count: 3,
      ok: true,
      nothing: null,
    });
  });

  it('stops recursing on deeply nested structures', () => {
    let deep: Record<string, unknown> = { value: 'bottom' };
    for (let i = 0; i < 12; i += 1) deep = { nested: deep };

    expect(() => redact(deep as never)).not.toThrow();
  });
});

describe('error boundary', () => {
  it('passes an AppError message through to the user', () => {
    const error = new AppError(ErrorCode.FORBIDDEN, 'You cannot approve your own quote.');
    const safe = toSafeError(error);

    expect(safe.code).toBe(ErrorCode.FORBIDDEN);
    expect(safe.message).toBe('You cannot approve your own quote.');
    expect(safe.reference).toBe(error.reference);
  });

  it('never leaks an unknown error’s message', () => {
    const leaky = new Error(
      'Invalid `prisma.quote.findUnique()` invocation: connection string postgres://user:pw@host',
    );
    const safe = toSafeError(leaky);

    expect(safe.code).toBe(ErrorCode.INTERNAL);
    expect(safe.message).not.toContain('prisma');
    expect(safe.message).not.toContain('postgres://');
    expect(safe.reference).toMatch(/^REQ-[0-9A-Z]{5}$/);
  });

  it('keeps log context off the safe error', () => {
    const error = new AppError(ErrorCode.NOT_FOUND, 'Quote not found.', {
      logContext: { quoteId: 'q_123', actorId: 'u_456' },
    });

    expect(Object.keys(toSafeError(error))).toEqual(['code', 'message', 'reference']);
  });

  it('maps codes to the right HTTP status', () => {
    expect(new AppError(ErrorCode.UNAUTHORIZED, 'x').status).toBe(401);
    expect(new AppError(ErrorCode.FORBIDDEN, 'x').status).toBe(403);
    expect(new AppError(ErrorCode.NOT_FOUND, 'x').status).toBe(404);
    expect(new AppError(ErrorCode.VALIDATION, 'x').status).toBe(422);
    expect(new AppError(ErrorCode.INTERNAL, 'x').status).toBe(500);
  });

  it('produces transcribable references without ambiguous characters', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(newErrorReference()).toMatch(/^REQ-[0-9ABCDEFGHJKMNPQRSTVWXYZ]{5}$/);
    }
  });

  it('narrows with isAppError', () => {
    const error = new AppError(ErrorCode.CONFLICT, 'x');

    expect(isAppError(error)).toBe(true);
    expect(isAppError(error, ErrorCode.CONFLICT)).toBe(true);
    expect(isAppError(error, ErrorCode.NOT_FOUND)).toBe(false);
    expect(isAppError(new Error('x'))).toBe(false);
  });
});
