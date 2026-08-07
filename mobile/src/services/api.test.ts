import { API, setAuthToken } from './api';
import { API_BASE_URL } from '../config';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

function jsonResponse(data: any, ok = true, status = 200) {
  return { ok, status, json: async () => data } as Response;
}

function lastFetch() {
  return mockFetch.mock.calls[mockFetch.mock.calls.length - 1] as [string, RequestInit];
}

beforeEach(() => {
  mockFetch.mockReset();
  setAuthToken(null);
});

describe('API.login', () => {
  it('posts credentials and returns the session', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ success: true, token: 'jwt', user: { id: 'u1', email: 'a@b.c' } }));
    const res = await API.login('a@b.c', 'secret1');

    expect(res.token).toBe('jwt');
    const [url, init] = lastFetch();
    expect(url).toBe(`${API_BASE_URL}/api/auth/login`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ email: 'a@b.c', password: 'secret1' });
  });

  it('throws the server error when login fails', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ success: false, error: 'Invalid email or password.' }, false, 401));
    await expect(API.login('a@b.c', 'wrong')).rejects.toThrow('Invalid email or password.');
  });
});

describe('API.getMe', () => {
  it('returns the user and attaches a bearer token', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ success: true, user: { id: 'u1', name: 'A' } }));
    const user = await API.getMe('my-token');
    expect(user).toMatchObject({ id: 'u1' });
    const [url, init] = lastFetch();
    expect(url).toBe(`${API_BASE_URL}/api/auth/me`);
    expect(init.headers).toMatchObject({ Authorization: 'Bearer my-token' });
  });

  it('exposes the HTTP status on a 401 so callers can clear the session', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ success: false, error: 'Session is no longer valid. Please log in again.' }, false, 401));
    const err = await API.getMe('stale-token').catch((e: any) => e);
    expect(err.status).toBe(401);
    expect(err.message).toContain('Session is no longer valid');
  });
});

describe('withAuth token injection', () => {
  it('adds the Authorization header once a token is set', async () => {
    setAuthToken('abc123');
    mockFetch.mockResolvedValue(jsonResponse({ success: true, result: {} }));
    await API.quickTextLookup([{ name: 'apple', quantity: '100', unit: 'g' }]);
    const [, init] = lastFetch();
    expect(init.headers).toMatchObject({ Authorization: 'Bearer abc123' });
  });

  it('omits the Authorization header when no token is set', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ success: true, result: {} }));
    await API.quickTextLookup([{ name: 'apple' }]);
    const [, init] = lastFetch();
    expect(init.headers).not.toHaveProperty('Authorization');
  });
});

describe('API.analyzeFoodImage error handling', () => {
  it('returns a timeout result when the request aborts', async () => {
    const abortErr = new Error('Aborted');
    abortErr.name = 'AbortError';
    mockFetch.mockRejectedValue(abortErr);

    const res = await API.analyzeFoodImage('/tmp/photo.jpg', 'rawbase64');
    expect(res.success).toBe(false);
    expect(res.error).toBe('Request timed out. Please check your connection and try again.');
  });

  it('returns a connectivity error on network failure', async () => {
    mockFetch.mockRejectedValue(new Error('Network request failed'));
    const res = await API.analyzeFoodImage('/tmp/photo.jpg', 'rawbase64');
    expect(res.success).toBe(false);
    expect(res.error).toBe('Cannot connect to server. Make sure the backend is running.');
  });

  it('surfaces a server error message from a non-ok response', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ success: false, error: 'Analysis failed' }, false, 500));
    const res = await API.analyzeFoodImage('/tmp/photo.jpg', 'rawbase64');
    expect(res.success).toBe(false);
    expect(res.error).toBe('Analysis failed');
  });
});

describe('API.uploadFoodImage', () => {
  it('returns null (not throw) when the network fails', async () => {
    mockFetch.mockRejectedValue(new Error('Network request failed'));
    await expect(API.uploadFoodImage('/tmp/photo.jpg', 'rawbase64')).resolves.toBeNull();
  });

  it('returns the image url on success', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ success: true, imageUrl: 'https://img/1.jpg' }));
    await expect(API.uploadFoodImage('/tmp/photo.jpg', 'rawbase64')).resolves.toBe('https://img/1.jpg');
  });
});
