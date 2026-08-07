import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requestMetrics, getMetrics, resetRequestMetrics } from './requestMetrics';

function makeRes(statusCode = 200) {
  const listeners: Record<string, (() => void) | undefined> = {};
  return {
    statusCode,
    on(event: string, cb: () => void) {
      listeners[event] = cb;
      return this;
    },
    emit(event: string) {
      listeners[event]?.();
    },
  } as any;
}

function runRequest(req: any, res: any) {
  const next = vi.fn();
  requestMetrics(req, res, next);
  expect(next).toHaveBeenCalledTimes(1);
  res.emit('finish');
}

describe('requestMetrics', () => {
  beforeEach(() => resetRequestMetrics());

  it('counts requests, methods and status buckets, and tracks in-flight', () => {
    const res = makeRes(200);
    const next = vi.fn();
    requestMetrics({ method: 'GET', originalUrl: '/api/targets' }, res, next);
    expect(getMetrics().requests.inFlight).toBe(1);

    res.emit('finish');
    const m = getMetrics();
    expect(m.requests.total).toBe(1);
    expect(m.requests.inFlight).toBe(0);
    expect(m.requests.byMethod.GET).toBe(1);
    expect(m.requests.byStatus['2xx']).toBe(1);
    expect(m.requests.latencyMs['<50']).toBe(1);
  });

  it('flags 5xx responses as errors', () => {
    runRequest({ method: 'POST', originalUrl: '/api/auth/login' }, makeRes(500));
    const m = getMetrics();
    expect(m.requests.byStatus['5xx']).toBe(1);
    expect(m.requests.error5xx).toBe(1);
    expect(m.requests.byStatus['2xx']).toBeUndefined();
  });

  it('normalizes URLs to route patterns when no Express route is matched', () => {
    runRequest({ method: 'GET', originalUrl: '/api/logs/507f1f77bcf86cd799439011' }, makeRes(200));
    runRequest({ method: 'GET', originalUrl: '/api/logs/water/123' }, makeRes(200));
    const m = getMetrics();
    expect(m.requests.byPath['/api/logs/:id']).toBe(1);
    expect(m.requests.byPath['/api/logs/water/:num']).toBe(1);
  });

  it('prefers the matched Express route path', () => {
    runRequest(
      { method: 'GET', originalUrl: '/api/logs/2026-08-07', baseUrl: '/api/logs', route: { path: '/:date' } },
      makeRes(200)
    );
    const m = getMetrics();
    expect(m.requests.byPath['/api/logs/:date']).toBe(1);
    expect(m.requests.byPath['/api/logs/2026-08-07']).toBeUndefined();
  });

  it('resetRequestMetrics clears all counters', () => {
    runRequest({ method: 'GET', originalUrl: '/health' }, makeRes(200));
    resetRequestMetrics();
    const m = getMetrics();
    expect(m.requests.total).toBe(0);
    expect(m.requests.byMethod).toEqual({});
    expect(m.requests.latencyMs['<50']).toBe(0);
  });
});
