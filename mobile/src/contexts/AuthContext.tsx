import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { User, DailyTarget, UserProfile } from '../types';
import { saveToken, getToken, saveUser, getUser, clearAuth } from '../services/authStorage';
import { API, setAuthToken } from '../services/api';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  targets: DailyTarget | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  loginAsGuest: () => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile> & { name?: string; onboardingComplete?: boolean }) => Promise<{ suggestedTargets?: DailyTarget }>;
  updateTargets: (targets: DailyTarget) => Promise<void>;
  convertGuestToUser: (name: string, email: string, password: string) => Promise<void>;
  refreshTargets: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [targets, setTargets] = useState<DailyTarget | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize: load cached auth state
  useEffect(() => {
    const bootstrap = async () => {
      try {
        const [storedToken, cachedUser] = await Promise.all([getToken(), getUser()]);
        if (storedToken && cachedUser) {
          setToken(storedToken);
          setUser(cachedUser);
          setAuthToken(storedToken);
          // Validate token in background — fetch profile + targets in parallel.
          try {
            const [me, t] = await Promise.all([
              API.getMe(storedToken),
              API.getTargets(storedToken),
            ]);
            setUser(me);
            await saveUser(me);
            setTargets(t);
          } catch (err: any) {
            // Only clear the session on an explicit auth failure (401). A
            // transient network error must NOT log the user out.
            if (err?.status === 401) {
              setAuthToken(null);
              await clearAuth();
              setToken(null);
              setUser(null);
            }
          }
        }
      } finally {
        setIsLoading(false);
      }
    };
    bootstrap();
  }, []);

  const handleAuthResponse = useCallback(async (data: { token: string; user: User }) => {
    await saveToken(data.token);
    await saveUser(data.user);
    setAuthToken(data.token);
    setToken(data.token);
    setUser(data.user);
    // Load targets
    try {
      const t = await API.getTargets(data.token);
      setTargets(t);
    } catch {
      setTargets({ calories: 2000, proteinG: 150, carbsG: 225, fatG: 65 });
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await API.login(email, password);
    await handleAuthResponse(data);
  }, [handleAuthResponse]);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const data = await API.register(name, email, password);
    await handleAuthResponse(data);
  }, [handleAuthResponse]);

  const loginAsGuest = useCallback(async () => {
    const data = await API.guestLogin();
    await handleAuthResponse(data);
  }, [handleAuthResponse]);

  const logout = useCallback(async () => {
    setAuthToken(null);
    await clearAuth();
    setToken(null);
    setUser(null);
    setTargets(null);
  }, []);

  const updateProfile = useCallback(async (data: Partial<UserProfile> & { name?: string; onboardingComplete?: boolean }) => {
    if (!token) throw new Error('Not authenticated');

    const { name, onboardingComplete, ...profileFields } = data as any;
    const payload: any = {};
    if (name) payload.name = name;
    if (typeof onboardingComplete === 'boolean') payload.onboardingComplete = onboardingComplete;
    if (Object.keys(profileFields).length > 0) {
      payload.profile = profileFields;
    }

    const result = await API.updateProfile(token, payload);
    const updatedUser = result.user;
    setUser(updatedUser);
    await saveUser(updatedUser);
    return { suggestedTargets: result.suggestedTargets };
  }, [token]);

  const updateTargets = useCallback(async (newTargets: DailyTarget) => {
    if (!token) throw new Error('Not authenticated');
    const t = await API.updateTargets(token, newTargets);
    setTargets(t);
  }, [token]);

  const convertGuestToUser = useCallback(async (name: string, email: string, password: string) => {
    if (!token) throw new Error('Not authenticated');
    const data = await API.convertGuest(token, name, email, password);
    await handleAuthResponse(data);
  }, [token, handleAuthResponse]);

  const refreshTargets = useCallback(async () => {
    if (!token) return;
    const t = await API.getTargets(token);
    setTargets(t);
  }, [token]);

  const contextValue = useMemo<AuthContextValue>(() => ({
    user, token, targets, isLoading,
    isAuthenticated: !!user && !!token,
    login, register, loginAsGuest, logout,
    updateProfile, updateTargets, convertGuestToUser, refreshTargets,
  }), [user, token, targets, isLoading, login, register, loginAsGuest, logout, updateProfile, updateTargets, convertGuestToUser, refreshTargets]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};
