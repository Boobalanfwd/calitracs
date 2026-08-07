import { saveToken, getToken, removeToken, saveUser, getUser, removeUser, clearAuth } from './authStorage';

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: jest.fn(),
    getItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

const SecureStore = require('expo-secure-store');
const AsyncStorage = require('@react-native-async-storage/async-storage').default;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('saveToken', () => {
  it('stores the token in SecureStore by default', async () => {
    await saveToken('tok123');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('foodlens_token', 'tok123');
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('falls back to AsyncStorage when SecureStore fails', async () => {
    SecureStore.setItemAsync.mockRejectedValueOnce(new Error('secure store unavailable'));
    await saveToken('tok123');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('foodlens_token', 'tok123');
  });
});

describe('getToken', () => {
  it('reads from SecureStore', async () => {
    SecureStore.getItemAsync.mockResolvedValue('tok123');
    await expect(getToken()).resolves.toBe('tok123');
  });

  it('falls back to AsyncStorage on SecureStore failure', async () => {
    SecureStore.getItemAsync.mockRejectedValueOnce(new Error('denied'));
    AsyncStorage.getItem.mockResolvedValue('fallback-token');
    await expect(getToken()).resolves.toBe('fallback-token');
  });
});

describe('removeToken', () => {
  it('clears both stores', async () => {
    await removeToken();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('foodlens_token');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('foodlens_token');
  });
});

describe('user persistence', () => {
  it('round-trips a serialized user object', async () => {
    const user = { id: 'u1', name: 'Ada', profile: { unitSystem: 'metric' } };
    await saveUser(user);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('foodlens_user', JSON.stringify(user));

    AsyncStorage.getItem.mockResolvedValue(JSON.stringify(user));
    await expect(getUser()).resolves.toEqual(user);
  });

  it('returns null when no user is stored', async () => {
    AsyncStorage.getItem.mockResolvedValue(null);
    await expect(getUser()).resolves.toBeNull();
  });

  it('removes the stored user', async () => {
    await removeUser();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('foodlens_user');
  });
});

describe('clearAuth', () => {
  it('clears token and user together', async () => {
    await clearAuth();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('foodlens_token');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('foodlens_token');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('foodlens_user');
  });
});
