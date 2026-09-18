/**
 * Structured application logging.
 *
 * One JSON line per event, which is what production log aggregators expect and
 * what makes a log searchable rather than merely readable. In development the
 * same events print in a compact human form.
 *
 * The redaction pass is the important part: this module refuses to emit
 * anything whose key looks like a credential, no matter who passes it in.
 * Relying on every call site to remember not to log a token is how tokens end
 * up in logs (§40).
 */

export const LogLevel = {
  error: 'error',
  warn: 'warn',
  info: 'info',
  debug: 'debug',
} as const;
export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];

const LEVEL_SEVERITY: Record<LogLevel, number> = {
  error: 40,
  warn: 30,
  info: 20,
  debug: 10,
};

/** Values that may appear in structured log context. */
export type LogValue =
  string | number | boolean | null | undefined | LogValue[] | { [key: string]: LogValue };
export type LogContext = Record<string, LogValue>;

/**
 * Keys whose values are never emitted, matched case-insensitively as
 * substrings so `userPassword` and `X-Auth-Token` are both caught.
 */
const REDACTED_KEY_PATTERNS = [
  'password',
  'secret',
  'token',
  'authorization',
  'cookie',
  'session',
  'apikey',
  'api_key',
  'credential',
  'signature',
  'connectionstring',
  'database_url',
] as const;

const REDACTED = '[redacted]';
const MAX_DEPTH = 6;

function shouldRedact(key: string): boolean {
  const normalised = key.toLowerCase().replace(/[-_]/g, '');
  return REDACTED_KEY_PATTERNS.some((pattern) => normalised.includes(pattern.replace(/[-_]/g, '')));
}

/** Recursively strip credential-shaped fields from log context. */
export function redact(value: LogValue, depth = 0): LogValue {
  if (depth > MAX_DEPTH) return '[truncated]';
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    return value.map((item) => redact(item, depth + 1));
  }

  if (typeof value === 'object') {
    const output: Record<string, LogValue> = {};
    for (const [key, nested] of Object.entries(value)) {
      output[key] = shouldRedact(key) ? REDACTED : redact(nested, depth + 1);
    }
    return output;
  }

  return value;
}

function configuredLevel(): LogLevel {
  const raw = process.env.LOG_LEVEL?.toLowerCase();
  if (raw === 'error' || raw === 'warn' || raw === 'info' || raw === 'debug') {
    return raw;
  }
  return process.env.NODE_ENV === 'production' ? LogLevel.info : LogLevel.debug;
}

function isEnabled(level: LogLevel): boolean {
  return LEVEL_SEVERITY[level] >= LEVEL_SEVERITY[configuredLevel()];
}

export interface Logger {
  error(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  debug(message: string, context?: LogContext): void;
  /** A logger that attaches `bindings` to every subsequent event. */
  child(bindings: LogContext): Logger;
}

function emit(level: LogLevel, message: string, bindings: LogContext, context?: LogContext): void {
  if (!isEnabled(level)) return;

  const merged = redact({ ...bindings, ...context }) as LogContext;

  const event = {
    level,
    time: new Date().toISOString(),
    message,
    ...merged,
  };

  const line =
    process.env.NODE_ENV === 'production'
      ? JSON.stringify(event)
      : `${level.toUpperCase().padEnd(5)} ${message}${
          Object.keys(merged).length > 0 ? ` ${JSON.stringify(merged)}` : ''
        }`;

  if (level === LogLevel.error) {
    console.error(line);
  } else if (level === LogLevel.warn) {
    console.warn(line);
  } else {
    // `no-console` is disabled only for this file; it is the single wrapper.
    console.log(line);
  }
}

function build(bindings: LogContext): Logger {
  return {
    error: (message, context) => emit(LogLevel.error, message, bindings, context),
    warn: (message, context) => emit(LogLevel.warn, message, bindings, context),
    info: (message, context) => emit(LogLevel.info, message, bindings, context),
    debug: (message, context) => emit(LogLevel.debug, message, bindings, context),
    child: (extra) => build({ ...bindings, ...extra }),
  };
}

export const logger: Logger = build({});
