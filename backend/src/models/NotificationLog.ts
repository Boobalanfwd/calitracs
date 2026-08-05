import mongoose, { Document, Schema } from 'mongoose';
import { NotificationCategory } from './NotificationPreference';

export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'delivered' | 'opened';

export interface INotificationLog extends Document {
  userId: mongoose.Types.ObjectId;
  category: NotificationCategory;
  title: string;
  body: string;
  expoPushToken: string;
  status: NotificationStatus;
  expoReceiptId?: string;
  sentAt?: Date;
  openedAt?: Date;
  createdAt: Date;
}

const NotificationLogSchema = new Schema<INotificationLog>(
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
    title: { type: String, required: true },
    body: { type: String, required: true },
    expoPushToken: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'sent', 'failed', 'delivered', 'opened'],
      default: 'pending',
    },
    expoReceiptId: { type: String },
    sentAt: { type: Date },
    openedAt: { type: Date },
  },
  {
    timestamps: true,
    collection: 'notification_logs',
  }
);

NotificationLogSchema.index({ userId: 1, createdAt: -1 });
NotificationLogSchema.index({ expoReceiptId: 1 });

export const NotificationLog = mongoose.model<INotificationLog>('NotificationLog', NotificationLogSchema);
