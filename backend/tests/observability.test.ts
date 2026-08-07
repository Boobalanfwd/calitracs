import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  healthHandler,
  metricsHandler,
  errorsHandler,
  clientErrorHandler,
} from '../src/routes/observability';
import { resetErrorTracking, getRecentErrors } from '../src/utils/logger';
import { resetRequestMetrics } from '../src/middlewares/requestMetrics';

function makeRes() {
  let statusCode = 200;
  let body: any = null;
  const res: any = {
    status(c: number) {
      statusCode = c;
      return { json: (b: any) => { body = b; } };
    },
    json(b: any) {
      body = b;
    },
  };
  return {
    res,
    get status() {
      return statusCode;
    },
    get body() {
      return body;
    },
  };
}

function makeReq(query: Record<string, unknown> = {}, body: Record<string, unknown> = {}) {
  return { query, body } as any;
}

describe('observability routes', () => {
  beforeEach(() => {
    resetErrorTracking();
    resetRequestMetrics();
  });

  afterEach(() => {
    delete process.env.OBSERVABILITY_KEY;
    vi.restoreAllMocks();
  });

  describe('healthHandler', () => {
    it('reports ok/degraded status, db, worker and uptime', () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});
      const result = makeRes();
      healthHandler(makeReq(), result.res);
      expect(result.status).toBe(200);
      expect(result.body.service).toBe('Calitracs Backend');
      expect(result.body.db.connected).toBe(false); // no Mongo in tests
      expect(result.body.db.readyState).toBe(0);
      expect(result.body.worker.running).toBe(false);
      expect(result.body.worker.ticks).toBe(0);
      expect(result.body.uptimeSec).toBeGreaterThanOrEqual(0);
      expect(result.body.metrics.totalRequests).toBe(0);
      expect(['ok', 'degraded']).toContain(result.body.status);
    });
  });

  describe('metricsHandler', () => {
    it('returns counters and memory snapshot', () => {
      const result = makeRes();
      metricsHandler(makeReq(), result.res);
      expect(result.status).toBe(200);
      expect(result.body.success).toBe(true);
      expect(result.body.requests.total).toBe(0);
      expect(result.body.memory.heapUsedBytes).toBeGreaterThan(0);
      expect(result.body.errors.count).toBe(0);
    });
  });

  describe('errorsHandler', () => {
    it('returns 404 when no OBSERVABILITY_KEY is configured', () => {
      delete process.env.OBSERVABILITY_KEY;
      const result = makeRes();
      errorsHandler(makeReq({ key: 'anything' }), result.res);
      expect(result.status).toBe(404);
    });

    it('returns 404 on a wrong key', () => {
      process.env.OBSERVABILITY_KEY = 'secret';
      const result = makeRes();
      errorsHandler(makeReq({ key: 'wrong' }), result.res);
      expect(result.status).toBe(404);
    });

    it('serves recent errors when the key matches', () => {
      process.env.OBSERVABILITY_KEY = 'secret';
      const result = makeRes();
      errorsHandler(makeReq({ key: 'secret' }), result.res);
      expect(result.status).toBe(200);
      expect(result.body.success).toBe(true);
      expect(result.body.errors).toEqual([]);
      expect(result.body.count).toBe(0);
    });
  });

  describe('clientErrorHandler', () => {
    it('ingests a client error into the ring buffer', () => {
      const result = makeRes();
      clientErrorHandler(makeReq({}, { message: 'render crash', source: 'render', screen: 'Dashboard' }), result.res);
      expect(result.status).toBe(200);
      expect(result.body.success).toBe(true);
      const [entry] = getRecentErrors();
      expect(entry.message).toBe('render crash');
      expect(entry.source).toBe('render');
      expect(entry.client).toBe(true);
      expect(entry.screen).toBe('Dashboard');
    });

    it('defaults the source to mobile and message when missing', () => {
      const result = makeRes();
      clientErrorHandler(makeReq({}, {}), result.res);
      expect(result.status).toBe(200);
      const [entry] = getRecentErrors();
      expect(entry.source).toBe('mobile');
      expect(entry.message).toBe('Unknown client error');
    });

    it('trims and bounds message/source/stack lengths', () => {
      const result = makeRes();
      clientErrorHandler(
        makeReq(
          {},
          {
            message: `  ${'x'.repeat(1000)}  `,
            source: `  ${'y'.repeat(200)}  `,
            stack: 'z'.repeat(5000),
            platform: 'ios',
          }
        ),
        result.res
      );
      const [entry] = getRecentErrors();
      expect(entry.message.length).toBeLessThanOrEqual(500);
      expect(entry.source.length).toBeLessThanOrEqual(60);
      expect(entry.platform).toBe('ios');
      expect(typeof entry.stack === 'string' && entry.stack.length).toBeLessThanOrEqual(2000);
    });
  });
});
