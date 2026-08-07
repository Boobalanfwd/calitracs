export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export const backoffDelay = (attempt: number, baseMs = 1000, maxMs = 10000): number =>
  Math.min(baseMs * Math.pow(2, attempt - 1) + Math.random() * 200, maxMs);

/**
 * Run `fn`, retrying up to `retries` extra times on any thrown (transient) error
 * with exponential backoff + jitter. Only network/timeout/5xx-style throw paths
 * should flow through here — HTTP error responses are handled by callers.
 */
export const withRetry = async <T>(
  fn: () => Promise<T>,
  opts: { retries?: number; onRetry?: (err: unknown, attempt: number) => void } = {}
): Promise<T> => {
  const { retries = 2, onRetry } = opts;
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= retries) throw err;
      attempt += 1;
      onRetry?.(err, attempt);
      await sleep(backoffDelay(attempt));
    }
  }
};
