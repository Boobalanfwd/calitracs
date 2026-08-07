/**
 * Zero-dependency request metrics. Counts requests, buckets them by status /
 * method / normalized route, and measures latency. Exposed via GET /metrics.
 */

import { Request, Response, NextFunction } from 'express';

export type LatencyBucket =
  | '<50'
  | '<100'
  | '<250'
  | '<500'
  | '<1000'
  | '<3000'
  | '>=3000';

interface MetricsState {
  totalRequests: number;
  inFlight: number;
  statusCounts: Record<string, number>;
  methodCounts: Record<string, number>;
  pathCounts: Record<string, number>;
  latencyBuckets: Record<LatencyBucket, number>;
  error5xx: number;
}

const startedAt = Date.now();

const state: MetricsState = {
  totalRequests: 0,
  inFlight: 0,
  statusCounts: {},
  methodCounts: {},
  pathCounts: {},
  latencyBuckets: {
    '<50': 0,
    '<100': 0,
    '<250': 0,
    '<500': 0,
    '<1000': 0,
    '<3000': 0,
    '>=3000': 0,
  },
  error5xx: 0,
};

function bucketLatency(ms: number): LatencyBucket {
  if (ms < 50) return '<50';
  if (ms < 100) return '<100';
  if (ms < 250) return '<250';
  if (ms < 500) return '<500';
  if (ms < 1000) return '<1000';
  if (ms < 3000) return '<3000';
  return '>=3000';
}

/**
 * Normalize a URL into a stable route key: prefer the matched Express route
 * path (`/api/logs/:date`), else strip ObjectIds / numeric ids from the URL.
 */
function normalizePath(req: Request): string {
  const routePath = req.route?.path;
  if (routePath) return `${req.baseUrl || ''}${routePath}`;
  const raw = (req.originalUrl || req.path || '/').split('?')[0];
  return raw
    .replace(/\/[0-9a-f]{24}/gi, '/:id')
    .replace(/\/\d+/g, '/:num')
    .replace(/\/+$/, '') || '/';
}

export const requestMetrics = (req: Request, res: Response, next: NextFunction): void => {
  state.totalRequests += 1;
  state.inFlight += 1;
  state.methodCounts[req.method] = (state.methodCounts[req.method] || 0) + 1;

  const start = process.hrtime();
  res.on('finish', () => {
    state.inFlight -= 1;
    const [s, ns] = process.hrtime(start);
    const durationMs = Math.round(s * 1000 + ns / 1e6);
    state.latencyBuckets[bucketLatency(durationMs)] += 1;

    const statusBucket = `${Math.floor(res.statusCode / 100)}xx`;
    state.statusCounts[statusBucket] = (state.statusCounts[statusBucket] || 0) + 1;
    if (res.statusCode >= 500) state.error5xx += 1;

    const pathKey = normalizePath(req);
    state.pathCounts[pathKey] = (state.pathCounts[pathKey] || 0) + 1;
  });
  next();
};

export interface MetricsSnapshot {
  uptimeSec: number;
  requests: {
    total: number;
    inFlight: number;
    byStatus: Record<string, number>;
    byMethod: Record<string, number>;
    byPath: Record<string, number>;
    latencyMs: Record<LatencyBucket, number>;
    error5xx: number;
  };
  memory: {
    heapUsedBytes: number;
    rssBytes: number;
  };
}

export function getMetrics(): MetricsSnapshot {
  return {
    uptimeSec: Math.round((Date.now() - startedAt) / 1000),
    requests: {
      total: state.totalRequests,
      inFlight: state.inFlight,
      byStatus: { ...state.statusCounts },
      byMethod: { ...state.methodCounts },
      byPath: { ...state.pathCounts },
      latencyMs: { ...state.latencyBuckets },
      error5xx: state.error5xx,
    },
    memory: {
      heapUsedBytes: process.memoryUsage().heapUsed,
      rssBytes: process.memoryUsage().rss,
    },
  };
}

export function resetRequestMetrics(): void {
  state.totalRequests = 0;
  state.inFlight = 0;
  state.statusCounts = {};
  state.methodCounts = {};
  state.pathCounts = {};
  state.latencyBuckets = {
    '<50': 0,
    '<100': 0,
    '<250': 0,
    '<500': 0,
    '<1000': 0,
    '<3000': 0,
    '>=3000': 0,
  };
  state.error5xx = 0;
}
