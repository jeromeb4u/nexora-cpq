/**
 * Application errors and the boundary between internal detail and what a user
 * is allowed to see.
 *
 * The rule (§31): a user never sees a stack trace, a SQL fragment, or a
 * connection string. They see a sentence describing what failed, and a short
 * reference code. That same code is attached to the server-side log line, so a
 * support conversation can start with "REQ-8F92A" and end at the exact event.
 */

export const ErrorCode = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION: 'VALIDATION',
  CONFLICT: 'CONFLICT',
  INVALID_TRANSITION: 'INVALID_TRANSITION',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL: 'INTERNAL',
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** HTTP status for each code, so route handlers do not each decide. */
export const ERROR_STATUS: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 422,
  CONFLICT: 409,
  INVALID_TRANSITION: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

const REFERENCE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford-ish: no I, L, O, U

/**
 * A short, human-transcribable reference. Deliberately not a UUID: the point is
 * that somebody can read it down a phone line without spelling out hyphens.
 */
export function newErrorReference(): string {
  let suffix = '';
  const bytes = new Uint8Array(5);
  globalThis.crypto.getRandomValues(bytes);
  for (const byte of bytes) {
    suffix += REFERENCE_ALPHABET[byte % REFERENCE_ALPHABET.length];
  }
  return `REQ-${suffix}`;
}

/**
 * An error whose message is safe to show a user.
 *
 * Anything that is NOT an AppError is treated as untrusted internal detail and
 * replaced with a generic message before it crosses the boundary.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly reference: string;
  /** Extra detail for the log only. Never serialised to the client. */
  readonly logContext: Record<string, unknown> | undefined;

  constructor(
    code: ErrorCode,
    message: string,
    options: { readonly cause?: unknown; readonly logContext?: Record<string, unknown> } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'AppError';
    this.code = code;
    this.status = ERROR_STATUS[code];
    this.reference = newErrorReference();
    this.logContext = options.logContext;
  }
}

export const unauthorized = (message = 'You must be signed in to do that.') =>
  new AppError(ErrorCode.UNAUTHORIZED, message);

export const forbidden = (message = 'You do not have permission to do that.') =>
  new AppError(ErrorCode.FORBIDDEN, message);

export const notFound = (what = 'The requested item') =>
  new AppError(ErrorCode.NOT_FOUND, `${what} could not be found.`);

export const conflict = (message: string) => new AppError(ErrorCode.CONFLICT, message);

export const validationFailed = (message = 'Some of the details entered are not valid.') =>
  new AppError(ErrorCode.VALIDATION, message);

/** The shape sent to the browser. Never contains internal detail. */
export interface SafeError {
  readonly code: ErrorCode;
  readonly message: string;
  readonly reference: string;
}

/**
 * Convert any thrown value into something safe to serialise.
 *
 * An unknown error keeps its reference code so the log can be correlated, but
 * its message is discarded — a Prisma error message can contain column names,
 * query fragments, and occasionally data.
 */
export function toSafeError(error: unknown): SafeError {
  if (error instanceof AppError) {
    return { code: error.code, message: error.message, reference: error.reference };
  }

  return {
    code: ErrorCode.INTERNAL,
    message: 'Something went wrong on our side. The issue has been logged.',
    reference: newErrorReference(),
  };
}

/** True when the value is an AppError with the given code. */
export function isAppError(error: unknown, code?: ErrorCode): error is AppError {
  return error instanceof AppError && (code === undefined || error.code === code);
}
