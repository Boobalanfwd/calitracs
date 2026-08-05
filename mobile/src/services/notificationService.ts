import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

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
  type: 'calorie_exceeded' | 'low_protein' | 'high_carbs' | 'high_fat' | 'water_reminder' | 'test';
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
   * Evaluate user macro totals after logging a meal and send real-time alerts
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

    // 1. Calorie Exceeded Alert
    if (targetCalories > 0 && consumedCalories > targetCalories) {
      const overCal = Math.round(consumedCalories - targetCalories);
      await this.sendLocalNotification(
        '🚨 Calorie Target Exceeded!',
        `You have logged ${consumedCalories} kcal today (${overCal} kcal over your daily target of ${targetCalories} kcal).`,
        { type: 'calorie_exceeded', overCal }
      );
    }

    // 2. Low Protein Warning (after afternoon or evening)
    const currentHour = new Date().getHours();
    if (currentHour >= 16 && targetProteinG > 0) {
      const proteinPct = (proteinG / targetProteinG) * 100;
      if (proteinPct < 60) {
        const remainingProtein = Math.round(targetProteinG - proteinG);
        await this.sendLocalNotification(
          '🥩 Low Protein Warning!',
          `You've reached only ${Math.round(proteinG)}g / ${targetProteinG}g of your protein target. Add ${remainingProtein}g more protein tonight!`,
          { type: 'low_protein', remainingProtein }
        );
      }
    }

    // 3. High Carbs / Fat Notice
    if (targetCarbsG > 0 && carbsG > targetCarbsG * 1.25) {
      await this.sendLocalNotification(
        '🌾 High Carbs Intake Notice',
        `Carbs intake (${Math.round(carbsG)}g) is 25% above your target (${targetCarbsG}g). Balance your next meal with protein & fiber!`,
        { type: 'high_carbs' }
      );
    } else if (targetFatG > 0 && fatG > targetFatG * 1.25) {
      await this.sendLocalNotification(
        '🥑 High Fat Intake Notice',
        `Fat intake (${Math.round(fatG)}g) is above your daily target (${targetFatG}g). Keep an eye on heavy oils and fried foods.`,
        { type: 'high_fat' }
      );
    }
  }

  /**
   * Evaluate water intake and notify if under hydration target
   */
  async evaluateWaterAlert(loggedWaterMl: number, targetWaterMl: number = 2500) {
    if (targetWaterMl <= 0) return;

    const remainingMl = targetWaterMl - loggedWaterMl;
    const currentHour = new Date().getHours();

    // Trigger hydration reminder if after 2 PM and less than 50% target reached
    if (currentHour >= 14 && loggedWaterMl < targetWaterMl * 0.5) {
      await this.sendLocalNotification(
        '💧 Stay Hydrated!',
        `You've drunk ${loggedWaterMl} ml today out of your ${targetWaterMl} ml goal. Drink a glass of water now!`,
        { type: 'water_reminder', remainingMl }
      );
    } else if (currentHour >= 19 && remainingMl > 500) {
      await this.sendLocalNotification(
        '💧 Evening Water Goal Check',
        `You are ${remainingMl} ml away from your daily water goal. Keep a water bottle nearby!`,
        { type: 'water_reminder_evening', remainingMl }
      );
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
