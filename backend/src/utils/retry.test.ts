import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withRetry, backoffDelay, sleep } from './retry';describe('backoffDelay', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('grows exponentially and caps at max', () => {
    expect(backoffDelay(1, 1000, 10000)).toBe(1000);
    expect(backoffDelay(2, 1000, 10000)).toBe(2000);
    expect(backoffDelay(3, 1000, 10000)).toBe(4000);
    // attempt 5 would be 16s — capped at max
    expect(backoffDelay(5, 1000, 10000)).toBe(10000);
  });

  it('respects custom base/max', () => {
    expect(backoffDelay(3, 100, 1000)).toBe(400);
  });
});

describe('withRetry', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('returns the value on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    await expect(withRetry(fn)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and eventually succeeds', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue('recovered');
    vi.useFakeTimers();
    const promise = withRetry(fn, { retries: 3 });
    await vi.advanceTimersByTimeAsync(10_000);
    await expect(promise).resolves.toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('re-throws when retries are exhausted', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('permanent'));
    vi.useFakeTimers();
    const promise = withRetry(fn, { retries: 2 });
    // Attach the rejection handler BEFORE advancing timers so the final throw
    // is never observed as an unhandled rejection.
    const assertion = expect(promise).rejects.toThrow('permanent');
    await vi.advanceTimersByTimeAsync(30_000);
    await assertion;
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('invokes onRetry with the error and attempt number', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValue('ok');
    const onRetry = vi.fn();
    vi.useFakeTimers();
    const promise = withRetry(fn, { retries: 2, onRetry });
    await vi.advanceTimersByTimeAsync(10_000);
    await expect(promise).resolves.toBe('ok');
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(expect.objectContaining({ message: 'x' }), 1);
  });
});

describe('sleep', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves after the delay', async () => {
    vi.useFakeTimers();
    const p = sleep(50);
    const marker = vi.fn();
    p.then(marker);
    await vi.advanceTimersByTimeAsync(50);
    expect(marker).toHaveBeenCalledTimes(1);
  });
});
