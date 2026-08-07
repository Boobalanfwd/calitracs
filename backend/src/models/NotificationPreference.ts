import mongoose, { Document, Schema } from 'mongoose';

export type NotificationCategory =
  | 'meal_reminder'
  | 'water_reminder'
  | 'daily_checkin'
  | 'calorie_goal'
  | 'streak'
  | 'weekly_summary'
  | 'inactivity';

export interface INotificationPreference extends Document {
  userId: mongoose.Types.ObjectId;
  category: NotificationCategory;
  enabled: boolean;
  quietHoursStart: number; // 0-23, e.g. 22 = 10 PM
  quietHoursEnd: number;   // 0-23, e.g. 7 = 7 AM
  timezone: string;        // e.g. "Asia/Kolkata"
  updatedAt: Date;
}

const NotificationPreferenceSchema = new Schema<INotificationPreference>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: ['meal_reminder', 'water_reminder', 'daily_checkin', 'calorie_goal', 'streak', 'weekly_summary', 'inactivity'],
      required: true,
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    quietHoursStart: {
      type: Number,
      default: 22, // 10 PM
      min: 0,
      max: 23,
    },
    quietHoursEnd: {
      type: Number,
      default: 7,  // 7 AM
      min: 0,
      max: 23,
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata',
      maxlength: 64,
    },
  },
  {
    timestamps: true,
    collection: 'notification_preferences',
  }
);

// One preference per user per category
NotificationPreferenceSchema.index({ userId: 1, category: 1 }, { unique: true });

export const NotificationPreference = mongoose.model<INotificationPreference>(
  'NotificationPreference',
  NotificationPreferenceSchema
);
