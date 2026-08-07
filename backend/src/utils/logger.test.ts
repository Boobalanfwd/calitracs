import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  captureError,
  getErrorCount,
  getRecentErrors,
  resetErrorTracking,
  error,
  info,
} from './logger';

describe('captureError', () => {
  beforeEach(() => resetErrorTracking());
  afterEach(() => vi.restoreAllMocks());

  it('captures a sanitized entry with source, message and timestamp', () => {
    captureError(new Error('boom'), 'test-service', { context: 42 });
    expect(getErrorCount()).toBe(1);
    const [entry] = getRecentErrors();
    expect(entry.message).toBe('boom');
    expect(entry.source).toBe('test-service');
    expect(entry.context).toBe(42);
    expect(entry.ts).toBeDefined();
  });

  it('stores the error name only for non-generic error types', () => {
    const err = new Error('unreachable');
    err.name = 'NetworkError';
    captureError(err, 'svc');
    const [entry] = getRecentErrors();
    expect(entry.name).toBe('NetworkError');
    expect(entry.message).toBe('unreachable');
  });

  it('normalizes non-Error inputs (strings, thrown values)', () => {
    captureError('plain string failure', 'svc');
    captureError(42, 'svc');
    const errors = getRecentErrors();
    expect(errors[0].message).toBe('plain string failure');
    expect(errors[1].message).toBe('42');
    expect(errors[1].name).toBeUndefined(); // plain strings have no Error name
  });

  it('keeps a bounded ring buffer of 100 entries', () => {
    for (let i = 0; i < 105; i++) captureError(new Error(`err-${i}`), 'svc');
    expect(getRecentErrors()).toHaveLength(100);
    expect(getRecentErrors()[0].message).toBe('err-5'); // oldest dropped
    expect(getRecentErrors()[99].message).toBe('err-104');
  });

  it('returns defensive copies from getRecentErrors', () => {
    captureError(new Error('x'), 'svc');
    const snapshot = getRecentErrors();
    snapshot[0].message = 'mutated';
    expect(getRecentErrors()[0].message).toBe('x');
  });

  it('resetErrorTracking clears counters and history', () => {
    captureError(new Error('x'), 'svc');
    resetErrorTracking();
    expect(getErrorCount()).toBe(0);
    expect(getRecentErrors()).toHaveLength(0);
  });
});

describe('structured log output', () => {
  afterEach(() => vi.restoreAllMocks());

  it('error() emits a single JSON line with level, msg and extra fields', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    error('something failed', { code: 500 });
    expect(spy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.level).toBe('error');
    expect(parsed.msg).toBe('something failed');
    expect(parsed.code).toBe(500);
    expect(parsed.ts).toBeDefined();
  });

  it('info() emits a JSON line', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    info('request', { status: 200 });
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.level).toBe('info');
    expect(parsed.msg).toBe('request');
    expect(parsed.status).toBe(200);
  });
});
