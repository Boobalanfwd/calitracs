import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { todayDateKey } from '../utils/dates';

// Storage keys for smart notification throttling & gap tracking
const STORAGE_KEYS = {
  LAST_WATER_LOG_TIME: 'calitracs_notif_last_water_log_time',
  LAST_WATER_GAP_NOTIF_TIME: 'calitracs_notif_last_water_gap_notif_time',
  LAST_WATER_GOAL_DATE: 'calitracs_notif_last_water_goal_date',
  LAST_PROTEIN_NOTIF_DATE: 'calitracs_notif_last_protein_notif_date',
  LAST_CALORIE_NOTIF_DATE: 'calitracs_notif_last_calorie_notif_date',
  LAST_MACRO_NOTIF_DATE: 'calitracs_notif_last_macro_notif_date',
};

// Configure notification behavior for SDK 54 foreground delivery
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface AppNotificationItem {
  id: string;
  title: string;
  body: string;
  timestamp: string;
  type: 'calorie_exceeded' | 'low_protein' | 'high_carbs' | 'high_fat' | 'water_reminder' | 'water_goal' | 'water_gap' | 'test';
  read: boolean;
}

export interface MacroAlertParams {
  consumedCalories: number;
  targetCalories: number;
  proteinG: number;
  targetProteinG: number;
  carbsG: number;
  targetCarbsG: number;
  fatG: number;
  targetFatG: number;
}

type NotificationListener = () => void;

class NotificationService {
  private hasPermission = false;
  private notifications: AppNotificationItem[] = [];
  private listeners: NotificationListener[] = [];

  subscribe(listener: NotificationListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((l) => l());
  }

  getNotifications(): AppNotificationItem[] {
    return this.notifications;
  }

  getUnreadCount(): number {
    return this.notifications.filter((n) => !n.read).length;
  }

  markAllAsRead() {
    this.notifications = this.notifications.map((n) => ({ ...n, read: true }));
    this.notifyListeners();
  }

  clearAll() {
    this.notifications = [];
    this.notifyListeners();
  }

  /**
   * Request push notification permissions and set up Android notification channel
   */
  async registerForPushNotifications(): Promise<boolean> {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('[NotificationService] Push notification permissions denied.');
        this.hasPermission = false;
        return false;
      }

      this.hasPermission = true;

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Calitracs Reminders',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF6B00',
          sound: 'default',
        });
      }

      return true;
    } catch (error) {
      console.log('[NotificationService] In-app notification center active.');
      return false;
    }
  }

  /**
   * Send notification: stores in notification drawer & fires OS push notification
   */
  async sendLocalNotification(title: string, body: string, data: Record<string, any> = {}) {
    const newItem: AppNotificationItem = {
      id: Date.now().toString() + Math.random().toString().slice(2, 6),
      title,
      body,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: data.type || 'test',
      read: false,
    };

    // 1. Store in-app notification item for Notification Center Modal
    this.notifications = [newItem, ...this.notifications];
    this.notifyListeners();

    // 2. Fire native device push notification alert
    try {
      if (!this.hasPermission) {
        await this.registerForPushNotifications();
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: true,
        },
        trigger: null, // null trigger fires immediately
      });
    } catch (error) {
      console.log('[NotificationService] Notification active in-app:', title);
    }
  }

  /**
   * Test push notification trigger
   */
  async sendTestNotification() {
    await this.sendLocalNotification(
      '🧪 Test Push Notification',
      'Calitracs push notification system is working perfectly!',
      { type: 'test' }
    );
  }

  /**
   * Evaluate user macro totals after logging a meal and send smart, non-spammy reminders.
   * - Protein reminders are sent in a friendly, encouraging tone with specific food suggestions.
   * - Throttled so notifications are sent at most ONCE per day (not on every food log).
   */
  async evaluateMacroAlerts(params: MacroAlertParams) {
    const {
      consumedCalories,
      targetCalories,
      proteinG,
      targetProteinG,
      carbsG,
      targetCarbsG,
      fatG,
      targetFatG,
    } = params;

    const todayStr = todayDateKey();
    const currentHour = new Date().getHours();

    // 1. Calorie Goal / Limit Alert — Sent at most ONCE per day when crossing target
    if (targetCalories > 0 && consumedCalories >= targetCalories) {
      try {
        const lastCalorieDate = await AsyncStorage.getItem(STORAGE_KEYS.LAST_CALORIE_NOTIF_DATE);
        if (lastCalorieDate !== todayStr) {
          const overCal = Math.round(consumedCalories - targetCalories);
          if (overCal > 50) {
            await this.sendLocalNotification(
              '🎯 Calorie Goal Exceeded',
              `You've logged ${Math.round(consumedCalories)} kcal today (${overCal} kcal over your daily target of ${targetCalories} kcal).`,
              { type: 'calorie_exceeded', overCal }
            );
          } else {
            await this.sendLocalNotification(
              '🎉 Daily Calorie Goal Reached!',
              `Great job! You reached your target of ${targetCalories} kcal for today.`,
              { type: 'calorie_exceeded', overCal: 0 }
            );
          }
          await AsyncStorage.setItem(STORAGE_KEYS.LAST_CALORIE_NOTIF_DATE, todayStr);
        }
      } catch (err) {
        console.warn('[NotificationService] Calorie notif check error:', err);
      }
    }

    // 2. Low Protein Reminder (Friendly tone + high-protein food suggestions)
    // Evaluated in the evening (after 5 PM) when dinner planning occurs, and sent AT MOST ONCE per day.
    if (currentHour >= 17 && targetProteinG > 0) {
      try {
        const proteinPct = (proteinG / targetProteinG) * 100;
        const lastProteinDate = await AsyncStorage.getItem(STORAGE_KEYS.LAST_PROTEIN_NOTIF_DATE);

        if (proteinPct < 65 && lastProteinDate !== todayStr) {
          const remainingProtein = Math.round(targetProteinG - proteinG);
          await this.sendLocalNotification(
            '💡 Mind Your Protein Goal',
            `Your protein is at ${Math.round(proteinG)}g / ${targetProteinG}g today. Adding chicken breast, eggs, paneer, tofu, fish, lentils, or a protein shake to dinner can help you hit your goal! 💪`,
            { type: 'low_protein', remainingProtein }
          );
          await AsyncStorage.setItem(STORAGE_KEYS.LAST_PROTEIN_NOTIF_DATE, todayStr);
        }
      } catch (err) {
        console.warn('[NotificationService] Protein notif check error:', err);
      }
    }

    // 3. High Carbs / Fat Balance Notice — Sent at most ONCE per day
    if ((targetCarbsG > 0 && carbsG > targetCarbsG * 1.35) || (targetFatG > 0 && fatG > targetFatG * 1.35)) {
      try {
        const lastMacroDate = await AsyncStorage.getItem(STORAGE_KEYS.LAST_MACRO_NOTIF_DATE);
        if (lastMacroDate !== todayStr) {
          const macroType = carbsG > targetCarbsG * 1.35 ? 'carbs' : 'fat';
          await this.sendLocalNotification(
            '🥗 Balanced Nutrition Tip',
            `Your ${macroType} intake is a bit high today. Try pairing remaining meals with extra lean protein and fiber!`,
            { type: macroType === 'carbs' ? 'high_carbs' : 'high_fat' }
          );
          await AsyncStorage.setItem(STORAGE_KEYS.LAST_MACRO_NOTIF_DATE, todayStr);
        }
      } catch (err) {
        console.warn('[NotificationService] Macro balance notif error:', err);
      }
    }
  }

  /**
   * Called whenever user logs water.
   * - Records timestamp so we know user just drank water.
   * - Does NOT send a "Drink water now" alert immediately when logging water!
   * - Triggers goal celebration when daily water goal is achieved (once per day).
   */
  async recordWaterLogged(loggedWaterMl: number, targetWaterMl: number = 2000) {
    const now = Date.now();
    const todayStr = todayDateKey();

    try {
      // 1. Update last water log timestamp
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_WATER_LOG_TIME, now.toString());

      // 2. Goal reached celebration notification (once per day)
      if (targetWaterMl > 0 && loggedWaterMl >= targetWaterMl) {
        const lastGoalDate = await AsyncStorage.getItem(STORAGE_KEYS.LAST_WATER_GOAL_DATE);
        if (lastGoalDate !== todayStr) {
          await this.sendLocalNotification(
            '🎉 Hydration Goal Achieved!',
            `Awesome effort! You reached your daily hydration goal of ${targetWaterMl.toLocaleString()} ml today. Keep staying hydrated! 💧`,
            { type: 'water_reminder', loggedWaterMl }
          );
          await AsyncStorage.setItem(STORAGE_KEYS.LAST_WATER_GOAL_DATE, todayStr);
        }
      }
    } catch (err) {
      console.warn('[NotificationService] recordWaterLogged error:', err);
    }
  }

  /**
   * Legacy alias for recordWaterLogged
   */
  async evaluateWaterAlert(loggedWaterMl: number, targetWaterMl: number = 2000) {
    await this.recordWaterLogged(loggedWaterMl, targetWaterMl);
  }

  /**
   * Check for a long gap since the user last drank water (e.g. >3 hours during daytime).
   * Reminds the user only when they haven't logged water for a significant period.
   */
  async checkWaterGapReminder(loggedWaterMl: number, targetWaterMl: number = 2000) {
    if (targetWaterMl > 0 && loggedWaterMl >= targetWaterMl) return; // Goal already hit today

    const now = Date.now();
    const currentHour = new Date().getHours();

    // Only remind during daytime hours (9 AM - 9 PM)
    if (currentHour < 9 || currentHour >= 21) return;

    try {
      const rawLastLogTime = await AsyncStorage.getItem(STORAGE_KEYS.LAST_WATER_LOG_TIME);
      const lastLogTime = rawLastLogTime ? parseInt(rawLastLogTime, 10) : 0;

      // If no log recorded yet today, set baseline
      if (lastLogTime === 0) {
        await AsyncStorage.setItem(STORAGE_KEYS.LAST_WATER_LOG_TIME, now.toString());
        return;
      }

      const hoursSinceLastLog = (now - lastLogTime) / (1000 * 60 * 60);

      // Check if 3+ hours have passed since last water log
      if (hoursSinceLastLog >= 3.0) {
        const rawLastGapNotifTime = await AsyncStorage.getItem(STORAGE_KEYS.LAST_WATER_GAP_NOTIF_TIME);
        const lastGapNotifTime = rawLastGapNotifTime ? parseInt(rawLastGapNotifTime, 10) : 0;
        const hoursSinceLastNotif = (now - lastGapNotifTime) / (1000 * 60 * 60);

        // Send gap reminder at most once every 3 hours
        if (hoursSinceLastNotif >= 3.0) {
          const remainingMl = Math.max(0, targetWaterMl - loggedWaterMl);
          await this.sendLocalNotification(
            '💧 Time for a Water Break!',
            `It's been over ${Math.floor(hoursSinceLastLog)} hours since your last water log. Take a quick sip to stay on track (${remainingMl} ml remaining)! 🥤`,
            { type: 'water_reminder', hoursSinceLastLog }
          );
          await AsyncStorage.setItem(STORAGE_KEYS.LAST_WATER_GAP_NOTIF_TIME, now.toString());
        }
      }
    } catch (err) {
      console.warn('[NotificationService] checkWaterGapReminder error:', err);
    }
  }

  /**
   * Schedule recurring daily water reminders
   */
  async scheduleDailyWaterReminders() {
    try {
      if (!this.hasPermission) {
        await this.registerForPushNotifications();
      }

      await Notifications.cancelAllScheduledNotificationsAsync();

      // Reminder 1: 11:00 AM
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '💧 Mid-Morning Water Reminder',
          body: "Don't forget to stay hydrated! Log a glass of water in Calitracs.",
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          channelId: 'default',
          hour: 11,
          minute: 0,
        },
      });

      // Reminder 2: 3:30 PM
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '💧 Afternoon Hydration Boost',
          body: 'Boost your energy with a glass of water! Track your intake on the dashboard.',
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          channelId: 'default',
          hour: 15,
          minute: 30,
        },
      });

      // Reminder 3: 8:00 PM
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🌙 Evening Water & Nutrition Check',
          body: 'Check your daily calorie & water goals before winding down today!',
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          channelId: 'default',
          hour: 20,
          minute: 0,
        },
      });

      console.log('[NotificationService] Expo push reminders scheduled.');
    } catch (error) {
      console.log('[NotificationService] Hydration reminders active.');
    }
  }
}

export const notificationService = new NotificationService();
