import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_PREFIX = 'local_notif_prefs_';

export interface LocalReminderPrefs {
  breakfastEnabled: boolean;
  breakfastHour: number;
  breakfastMinute: number;
  lunchEnabled: boolean;
  lunchHour: number;
  lunchMinute: number;
  dinnerEnabled: boolean;
  dinnerHour: number;
  dinnerMinute: number;
  waterEnabled: boolean;
  waterHours: number[]; // list of hours e.g. [9, 12, 15, 18]
  checkInEnabled: boolean;
  checkInHour: number;
  checkInMinute: number;
  snoozeMinutes: number; // 5 | 10 | 15 | 30
}

export const DEFAULT_PREFS: LocalReminderPrefs = {
  breakfastEnabled: true,
  breakfastHour: 8,
  breakfastMinute: 0,
  lunchEnabled: true,
  lunchHour: 13,
  lunchMinute: 0,
  dinnerEnabled: true,
  dinnerHour: 20,
  dinnerMinute: 0,
  waterEnabled: true,
  waterHours: [9, 12, 15, 18],
  checkInEnabled: true,
  checkInHour: 21,
  checkInMinute: 0,
  snoozeMinutes: 10,
};

const PREF_KEY = `${STORAGE_PREFIX}schedule`;

export async function saveReminderPrefs(prefs: LocalReminderPrefs): Promise<void> {
  await AsyncStorage.setItem(PREF_KEY, JSON.stringify(prefs));
}

export async function loadReminderPrefs(): Promise<LocalReminderPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PREF_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

/**
 * Cancel all previously scheduled local notifications and reschedule
 * from the provided preferences.
 */
export async function applyLocalNotificationSchedule(
  prefs: LocalReminderPrefs
): Promise<void> {
  // Cancel all first to avoid duplicate schedules
  await Notifications.cancelAllScheduledNotificationsAsync();

  const schedules: Array<{
    title: string;
    body: string;
    hour: number;
    minute: number;
    data: Record<string, string>;
  }> = [];

  if (prefs.breakfastEnabled) {
    schedules.push({
      title: '🍳 Breakfast time!',
      body: 'Don\'t skip breakfast — log what you eat to stay on track with your calorie goal.',
      hour: prefs.breakfastHour,
      minute: prefs.breakfastMinute,
      data: { screen: 'log', type: 'meal_reminder', meal: 'breakfast' },
    });
  }

  if (prefs.lunchEnabled) {
    schedules.push({
      title: '🥗 Lunch reminder',
      body: 'Time to fuel up! Log your lunch and keep your nutrition on point.',
      hour: prefs.lunchHour,
      minute: prefs.lunchMinute,
      data: { screen: 'log', type: 'meal_reminder', meal: 'lunch' },
    });
  }

  if (prefs.dinnerEnabled) {
    schedules.push({
      title: '🍽️ Dinner check-in',
      body: 'Log your dinner and review today\'s nutrition summary in Calitracs.',
      hour: prefs.dinnerHour,
      minute: prefs.dinnerMinute,
      data: { screen: 'log', type: 'meal_reminder', meal: 'dinner' },
    });
  }

  if (prefs.checkInEnabled) {
    schedules.push({
      title: '📊 Daily check-in',
      body: 'How did you do today? Review your calories, macros, and water intake now.',
      hour: prefs.checkInHour,
      minute: prefs.checkInMinute,
      data: { screen: 'dashboard', type: 'daily_checkin' },
    });
  }

  // Schedule meal + check-in reminders
  for (const item of schedules) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: item.title,
        body: item.body,
        data: item.data,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: item.hour,
        minute: item.minute,
        channelId: 'default',
      },
    });
  }

  // Schedule water reminders
  if (prefs.waterEnabled) {
    for (const hour of prefs.waterHours) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '💧 Stay hydrated!',
          body: 'Drink a glass of water now and log it in Calitracs.',
          data: { screen: 'dashboard', type: 'water_reminder' },
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute: 0,
          channelId: 'default',
        },
      });
    }
  }

  await saveReminderPrefs(prefs);
  console.log('[LocalScheduler] Reminders scheduled:', schedules.length, '+ water:', prefs.waterHours.length);
}

/**
 * Cancel all local scheduled notifications.
 */
export async function cancelAllLocalNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  console.log('[LocalScheduler] All local notifications cancelled');
}
