import { Platform } from 'react-native';

const LOCAL_IP = '192.168.5.9';
const PORT = 3001;

export const getApiBaseUrl = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    const host = window.location.hostname || 'localhost';
    return `http://${host}:${PORT}`;
  }
  return `http://${LOCAL_IP}:${PORT}`;
};

export const API_BASE_URL = getApiBaseUrl();

export const ENDPOINTS = {
  analyzeFood: `${getApiBaseUrl()}/api/food/analyze`,
  health: `${getApiBaseUrl()}/health`,
} as const;
