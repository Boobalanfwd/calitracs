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
    title: { type: String, required: true, maxlength: 300 },
    body: { type: String, required: true, maxlength: 2000 },
    expoPushToken: { type: String, required: true, maxlength: 200 },
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
// Receipt requeue after restart scans status='sent' older than 30s.
NotificationLogSchema.index({ status: 1, sentAt: 1 });
// Keep notification history bounded — auto-delete records older than 90 days.
NotificationLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

export const NotificationLog = mongoose.model<INotificationLog>('NotificationLog', NotificationLogSchema);
