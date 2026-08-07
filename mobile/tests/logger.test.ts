import { captureClientError } from '../src/utils/logger';

const fetchMock = jest.fn();
const originalError = console.error;

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true });
  global.fetch = fetchMock as unknown as typeof fetch;
  console.error = jest.fn();
});

afterEach(() => {
  console.error = originalError;
  jest.resetModules();
});

describe('captureClientError', () => {
  it('posts a sanitized payload to the client-error endpoint', () => {
    captureClientError(new Error('render boom'), 'render', { screen: 'Dashboard' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/log/client-error');
    expect(opts.method).toBe('POST');
    const body = JSON.parse(opts.body);
    expect(body.message).toBe('render boom');
    expect(body.source).toBe('render');
    expect(body.screen).toBe('Dashboard');
    expect(body.dev).toBeDefined();
  });

  it('normalizes non-Error inputs', () => {
    captureClientError('plain string failure', 'app');
    captureClientError(42, 'app');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const bodies = fetchMock.mock.calls.map((c) => JSON.parse((c as any)[1].body));
    expect(bodies[0].message).toBe('plain string failure');
    expect(bodies[1].message).toBe('42');
  });

  it('trims and bounds message length', () => {
    captureClientError(`  ${'x'.repeat(1000)}  `, 'app');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.message.length).toBe(500);
    expect(body.message.trim()).toBe(body.message);
  });

  it('deduplicates identical source+message within 60s', () => {
    captureClientError(new Error('same'), 'app');
    captureClientError(new Error('same'), 'app');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not report empty messages', () => {
    captureClientError(new Error('   '), 'app');
    captureClientError('', 'app');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('swallows network failures', () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    expect(() => captureClientError(new Error('x'), 'app')).not.toThrow();
  });

  it('defaults the source to app', () => {
    captureClientError(new Error('default-source-test'));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.source).toBe('app');
  });
});
