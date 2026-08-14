import React, { useEffect } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { RootStackParamList } from '../types';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { LogProvider } from '../contexts/LogContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { FONT_ASSETS, FONTS } from '../theme/fonts';
import AuthNavigator from './AuthNavigator';
import MainTabNavigator from './MainTabNavigator';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { applyLocalNotificationSchedule, loadReminderPrefs } from '../services/localNotificationScheduler';

import HomeScreen from '../screens/HomeScreen';
import PreviewScreen from '../screens/PreviewScreen';
import ResultScreen from '../screens/ResultScreen';
import CameraScannerScreen from '../screens/food/CameraScannerScreen';
import ManualEntryScreen from '../screens/food/ManualEntryScreen';
import LogEntryScreen from '../screens/food/LogEntryScreen';
import FoodDetailEditScreen from '../screens/food/FoodDetailEditScreen';

// Onboarding screens — imported here so they work in BOTH auth and post-auth flows
import OnboardingScreen from '../screens/auth/OnboardingScreen';
import OnboardingPlanScreen from '../screens/auth/OnboardingPlanScreen';

import { PaperProvider, MD3LightTheme } from 'react-native-paper';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Module-level navigation ref.
 * Allows usePushNotifications (and other out-of-tree code) to navigate
 * without needing to call useNavigation() inside NavigationContainer.
 */
import { navigationRef } from './navigationRef';

// Keep the native splash visible until fonts + auth bootstrap are ready so the
// user never sees a blank/spinner bridge frame between splash and first screen.
SplashScreen.preventAutoHideAsync().catch(() => {});

const lightPaperTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#FF6B2C',
    background: '#FAFAFB',
    surface: '#FFFFFF',
    surfaceVariant: '#F8FAFC',
    outline: '#E2E8F0',
    onSurface: '#1E293B',
    onSurfaceVariant: '#64748B',
  },
  fonts: {
    ...MD3LightTheme.fonts,
    displayLarge: { fontFamily: FONTS.heading.bold },
    displayMedium: { fontFamily: FONTS.heading.bold },
    displaySmall: { fontFamily: FONTS.heading.bold },
    headlineLarge: { fontFamily: FONTS.heading.bold },
    headlineMedium: { fontFamily: FONTS.heading.semiBold },
    headlineSmall: { fontFamily: FONTS.heading.semiBold },
    titleLarge: { fontFamily: FONTS.heading.bold },
    titleMedium: { fontFamily: FONTS.heading.semiBold },
    titleSmall: { fontFamily: FONTS.heading.medium },
    bodyLarge: { fontFamily: FONTS.body.regular },
    bodyMedium: { fontFamily: FONTS.body.regular },
    bodySmall: { fontFamily: FONTS.body.regular },
    labelLarge: { fontFamily: FONTS.body.medium },
    labelMedium: { fontFamily: FONTS.body.medium },
    labelSmall: { fontFamily: FONTS.body.regular },
  },
};

/**
 * NotificationBridge — rendered INSIDE NavigationContainer so that
 * usePushNotifications can safely read the navigation state.
 * We also pass the token down so token changes trigger re-registration.
 */
const NotificationBridge: React.FC<{ token: string | null }> = ({ token }) => {
  usePushNotifications(token);
  return null;
};

const AppNavigatorContent: React.FC = () => {
  const [fontsLoaded, fontError] = useFonts(FONT_ASSETS);
  const { isAuthenticated, isLoading, user, token } = useAuth();

  // If the custom fonts fail to load, treat the app as ready anyway — otherwise
  // `fontsLoaded` stays false forever and the native splash never hides (the app
  // looks dead at launch). Text falls back to system fonts.
  const fontsReady = fontsLoaded || Boolean(fontError);
  const ready = !isLoading && fontsReady;

  // Log the font failure once so it's debuggable, but don't block startup on it.
  useEffect(() => {
    if (fontError) {
      console.warn('[Fonts] Failed to load font assets:', fontError);
    }
  }, [fontError]);

  // Hide the native splash once fonts + auth state are ready.
  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready]);

  // Track 1 — local offline reminders. Apply schedule once on mount.
  useEffect(() => {
    loadReminderPrefs().then((prefs) => {
      applyLocalNotificationSchedule(prefs).catch(() => {});
    });
  }, []);

  if (!ready) {
    return null;
  }

  // Determine if the authenticated user still needs to complete onboarding
  const needsOnboarding =
    isAuthenticated && user && !user.onboardingComplete;

  return (
    <PaperProvider theme={lightPaperTheme}>
      <NavigationContainer ref={navigationRef}>
        {/*
          Track 2 — NotificationBridge lives INSIDE NavigationContainer so the
          notification tap handler can navigate without the "no navigation object" error.
        */}
        <NotificationBridge token={token ?? null} />

        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            animation: 'fade',
          }}
        >
          {!isAuthenticated ? (
            // ── Unauthenticated: show login / signup / splash
            <Stack.Screen name="Auth" component={AuthNavigator} />
          ) : needsOnboarding ? (
            // ── Authenticated but not onboarded: show onboarding wizard
            <>
              <Stack.Screen
                name="Onboarding"
                component={OnboardingScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="OnboardingPlan"
                component={OnboardingPlanScreen}
                options={{ animation: 'fade' }}
              />
              <Stack.Screen name="Main" component={MainTabNavigator} />
            </>
          ) : (
            // ── Authenticated + onboarding complete: full app
            <>
              <Stack.Screen name="Main" component={MainTabNavigator} />
              <Stack.Screen name="CameraScanner" component={CameraScannerScreen} />
              <Stack.Screen name="ManualEntry" component={ManualEntryScreen} />
              <Stack.Screen name="LogEntry" component={LogEntryScreen} />
              <Stack.Screen name="FoodDetailEdit" component={FoodDetailEditScreen} />

              {/* Legacy compatibility routes */}
              <Stack.Screen name="Home" component={HomeScreen} />
              <Stack.Screen name="Preview" component={PreviewScreen} />
              <Stack.Screen name="Result" component={ResultScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>
  );
};

const AppNavigator: React.FC = () => {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <LogProvider>
            <AppNavigatorContent />
          </LogProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
};

export default AppNavigator;
