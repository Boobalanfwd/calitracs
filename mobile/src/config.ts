import { Platform } from 'react-native';

const PRODUCTION_API_URL = 'https://calitracs-backend.onrender.com';
const LOCAL_IP = '192.168.5.9';
const PORT = 3001;

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
  return `http://${LOCAL_IP}:${PORT}`;
};

export const API_BASE_URL = getApiBaseUrl();

console.log(`[Calitracs API Config] Active API Base URL: ${API_BASE_URL}`);

export const ENDPOINTS = {
  analyzeFood: `${API_BASE_URL}/api/food/analyze`,
  health: `${API_BASE_URL}/health`,
} as const;

