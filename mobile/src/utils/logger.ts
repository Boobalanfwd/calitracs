import { Platform } from 'react-native';
import { API_BASE_URL } from '../config';

/**
 * Client-side error reporting. Logs to console AND forwards a sanitized copy to
 * the backend (`POST /api/log/client-error`) so device crashes/render errors are
 * visible in the backend's error ring buffer + logs.
 *
 * Non-blocking: fire-and-forget with a short timeout; a dead network must never
 * affect the UI thread. Identical (source, message) pairs are throttled to once
 * per 60s so a repeat render error can't flood the endpoint.
 */

const DEDUPE_WINDOW_MS = 60_000;
const MAX_DEDUPE_KEYS = 100;
const REPORT_TIMEOUT_MS = 5000;

let lastReportAt: Record<string, number> = {};

const clearDedupeMapIfFull = (): void => {
  if (Object.keys(lastReportAt).length >= MAX_DEDUPE_KEYS) {
    lastReportAt = {};
  }
};

export const captureClientError = (
  error: unknown,
  source = 'app',
  meta: Record<string, unknown> = {}
): void => {
  const message = (error instanceof Error ? error.message : String(error)).trim().slice(0, 500);
  if (!message) return;

  const dedupeKey = `${source}:${message}`;
  const now = Date.now();
  if (lastReportAt[dedupeKey] && now - lastReportAt[dedupeKey] < DEDUPE_WINDOW_MS) {
    return;
  }
  clearDedupeMapIfFull();
  lastReportAt[dedupeKey] = now;

  console.error(`[${source}] ${message}`);

  const payload = {
    message,
    source: source.slice(0, 60),
    stack: error instanceof Error && error.stack ? error.stack.slice(0, 2000) : undefined,
    platform: Platform.OS,
    dev: __DEV__,
    ...meta,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REPORT_TIMEOUT_MS);
  fetch(`${API_BASE_URL}/api/log/client-error`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: controller.signal,
  })
    .catch(() => {})
    .finally(() => clearTimeout(timeoutId));
};
