import React, { createContext, useContext } from 'react';

export type ThemeMode = 'light';

export interface ThemeColors {
  mode: ThemeMode;
  background: string;
  card: string;
  cardSecondary: string;
  cardBorder: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  primaryGradient: [string, string];
  primaryLight: string;
  accent: string;
  success: string;
  warning: string;
  info: string;
  tabBar: string;
  tabBarBorder: string;
  inputBg: string;
  inputBorder: string;
}

export const lightTheme: ThemeColors = {
  mode: 'light',
  background: '#F6F7F9',
  card: '#FFFFFF',
  cardSecondary: '#F1F3F6',
  cardBorder: '#E2E8F0',
  textPrimary: '#445E93',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  primary: '#F93943',
  primaryGradient: ['#F93943', '#FCB0B3'],
  primaryLight: '#FFF0F1',
  accent: '#F93943',
  success: '#22C55E',
  warning: '#FCECC9',
  info: '#7EB2DD',
  tabBar: '#1D2330',
  tabBarBorder: '#2A3142',
  inputBg: '#F1F3F6',
  inputBorder: '#CBD5E1',
};

interface ThemeContextType {
  theme: ThemeColors;
  themeMode: ThemeMode;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: lightTheme,
  themeMode: 'light',
  toggleTheme: () => {},
  setThemeMode: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ThemeContext.Provider
      value={{
        theme: lightTheme,
        themeMode: 'light',
        toggleTheme: () => {},
        setThemeMode: () => {},
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
