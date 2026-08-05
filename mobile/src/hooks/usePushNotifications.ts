import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';
import { navigationRef } from '../navigation/navigationRef';

const STORAGE_KEY = 'expo_push_token';

async function registerTokenWithBackend(
  token: string,
  platform: 'ios' | 'android',
  authToken: string
): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/notifications/register-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ expoPushToken: token, platform }),
    });

    if (!response.ok) {
      const err = await response.json();
      console.warn('[usePushNotifications] Backend registration failed:', err.error);
    } else {
      console.log('[usePushNotifications] Push token registered with backend');
    }
  } catch (err: any) {
    console.warn('[usePushNotifications] Network error registering token:', err.message);
  }
}

/**
 * usePushNotifications
 *
 * Must be rendered INSIDE <NavigationContainer> (via NotificationBridge in AppNavigator).
 * Uses the module-level navigationRef so navigation works safely from notification handlers.
 *
 * Handles:
 *  - Permission request (iOS + Android 13+)
 *  - Expo push token retrieval + backend registration
 *  - Token refresh detection (only re-registers when token changes)
 *  - Foreground notification handler
 *  - Notification tap → deep link navigation via navigationRef
 */
export function usePushNotifications(authToken: string | null) {
  const notificationTapListener = useRef<Notifications.Subscription | undefined>(undefined);
  const notificationReceivedListener = useRef<Notifications.Subscription | undefined>(undefined);

  useEffect(() => {
    if (!authToken) return;

    let isMounted = true;

    const setup = async () => {
      try {
        // 1. Request permissions
        const { status: existing } = await Notifications.getPermissionsAsync();
        let finalStatus = existing;

        if (existing !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== 'granted') {
          console.log('[usePushNotifications] Notification permissions not granted');
          return;
        }

        // 2. Android notification channel
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'Calitracs',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF6B00',
            sound: 'default',
          });
        }

        // 3. Get Expo push token
        // Note: On Expo Go (SDK 53+) remote push tokens are not supported.
        // Use a development build (npx expo run:android / run:ios) for full push support.
        let pushToken: string | undefined;
        try {
          const tokenResult = await Notifications.getExpoPushTokenAsync({
            // Uncomment and set your projectId if you have a custom Expo project:
            // projectId: 'your-expo-project-id',
          });
          pushToken = tokenResult.data;
        } catch (err: any) {
          // Expected on Expo Go SDK 53+ — silently skip
          console.log('[usePushNotifications] Push token unavailable (Expo Go):', err.message);
          return;
        }

        if (!isMounted || !pushToken) return;

        // 4. Only re-register if token changed
        const cachedToken = await AsyncStorage.getItem(STORAGE_KEY);
        if (pushToken !== cachedToken) {
          const platform: 'ios' | 'android' = Platform.OS === 'ios' ? 'ios' : 'android';
          await registerTokenWithBackend(pushToken, platform, authToken);
          await AsyncStorage.setItem(STORAGE_KEY, pushToken);
        }
      } catch (err: any) {
        console.error('[usePushNotifications] Setup error:', err.message);
      }
    };

    setup();

    // 5. Foreground notification handler
    notificationReceivedListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log(
          '[usePushNotifications] Foreground notification received:',
          notification.request.content.title
        );
      }
    );

    // 6. Notification tap handler → navigate using module-level ref
    notificationTapListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as Record<string, any>;
        const screen = data?.screen as string | undefined;

        console.log('[usePushNotifications] Notification tapped, target screen:', screen);

        if (!navigationRef.isReady()) {
          console.warn('[usePushNotifications] Navigation not ready yet, skipping navigate');
          return;
        }

        if (screen === 'log') {
          navigationRef.navigate('LogEntry' as never);
        } else if (screen === 'dashboard') {
          navigationRef.dispatch({ type: 'NAVIGATE', payload: { name: 'Main', params: { screen: 'Dashboard' } } });
        } else if (screen === 'profile') {
          navigationRef.dispatch({ type: 'NAVIGATE', payload: { name: 'Main', params: { screen: 'Profile' } } });
        } else {
          navigationRef.dispatch({ type: 'NAVIGATE', payload: { name: 'Main', params: { screen: 'Dashboard' } } });
        }
      }
    );

    return () => {
      isMounted = false;
      notificationReceivedListener.current?.remove();
      notificationTapListener.current?.remove();
    };
  }, [authToken]);
}
