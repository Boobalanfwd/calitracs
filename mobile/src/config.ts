import { Platform } from 'react-native';
import Constants from 'expo-constants';

const PRODUCTION_API_URL = 'https://calitracs-backend.onrender.com';
const LOCAL_IP = '192.168.5.9';
const PORT = 3002;

export const getApiBaseUrl = (): string => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  // In standalone / production builds (__DEV__ === false), default to Render production backend
  if (typeof __DEV__ !== 'undefined' && !__DEV__) {
    return PRODUCTION_API_URL;
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    const host = window.location.hostname || 'localhost';
    return `http://${host}:${PORT}`;
  }

  // In development, use the same LAN host Metro advertises to the device.
  // This avoids a stale hard-coded IP when the computer changes networks.
  const hostUri = Constants.expoConfig?.hostUri;
  const metroHost = hostUri
    ? new URL(`http://${hostUri}`).hostname.replace(/^\[|\]$/g, '')
    : undefined;
  return `http://${metroHost || LOCAL_IP}:${PORT}`;
};

export const API_BASE_URL = getApiBaseUrl();

console.log(`[Calitracs API Config] Active API Base URL: ${API_BASE_URL}`);

export const ENDPOINTS = {
  analyzeFood: `${API_BASE_URL}/api/food/analyze`,
  health: `${API_BASE_URL}/health`,
} as const;

