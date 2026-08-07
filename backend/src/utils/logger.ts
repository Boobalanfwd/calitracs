/**
 * Minimal structured logger + in-memory error capture.
 *
 * All log lines are single-line JSON so deployment platforms (Render logs,
 * etc.) can index them by field. `captureError` additionally keeps a bounded
 * ring buffer of sanitized recent errors that observability endpoints expose.
 */

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogFields {
  [key: string]: unknown;
}

export interface CapturedError {
  ts: string;
  source: string;
  message: string;
  name?: string;
  stack?: string;
  [key: string]: unknown;
}

const RECENT_ERRORS_MAX = 100;
const recentErrors: CapturedError[] = [];
let errorCount = 0;

/** Write one JSON line to stdout (info/warn) or stderr (error). */
export function log(level: LogLevel, msg: string, fields: LogFields = {}): void {
  const entry = { ts: new Date().toISOString(), level, msg, ...fields };
  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const info = (msg: string, fields?: LogFields): void => log('info', msg, fields);
export const warn = (msg: string, fields?: LogFields): void => log('warn', msg, fields);
export const error = (msg: string, fields?: LogFields): void => log('error', msg, fields);

/**
 * Record an error for observability and emit a JSON error line. Pass only safe
 * metadata — never tokens or credentials. Non-Error inputs (strings, thrown
 * values) are normalized so a handler can always rely on `.message`.
 */
export function captureError(err: unknown, source: string, meta: LogFields = {}): void {
  const e = err instanceof Error ? err : new Error(String(err));
  errorCount += 1;

  const entry: CapturedError = {
    ts: new Date().toISOString(),
    source,
    message: e.message || String(err),
    ...(e.name && e.name !== 'Error' ? { name: e.name } : {}),
    ...(typeof e.stack === 'string' ? { stack: e.stack.slice(0, 2000) } : {}),
    ...meta,
  };

  recentErrors.push(entry);
  if (recentErrors.length > RECENT_ERRORS_MAX) recentErrors.shift();

  log('error', `[${source}] ${entry.message}`, { source, errorName: entry.name });
}

/** Snapshot of the most recent captured errors (newest last, bounded). */
export function getRecentErrors(): CapturedError[] {
  return recentErrors.map((e) => ({ ...e }));
}

export function getErrorCount(): number {
  return errorCount;
}

export function resetErrorTracking(): void {
  recentErrors.length = 0;
  errorCount = 0;
}
