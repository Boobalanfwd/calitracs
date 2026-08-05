import mongoose, { Document, Schema } from 'mongoose';
import { NotificationCategory } from './NotificationPreference';

export type QueueStatus = 'pending' | 'processing' | 'done' | 'failed';

export interface INotificationQueue extends Document {
  userId: mongoose.Types.ObjectId;
  category: NotificationCategory;
  title: string;
  body: string;
  data?: Record<string, any>;
  status: QueueStatus;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationQueueSchema = new Schema<INotificationQueue>(
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
    data: { type: Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ['pending', 'processing', 'done', 'failed'],
      default: 'pending',
      index: true,
    },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 3 },
    nextAttemptAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'notification_queue',
  }
);

NotificationQueueSchema.index({ status: 1, nextAttemptAt: 1 });

export const NotificationQueue = mongoose.model<INotificationQueue>('NotificationQueue', NotificationQueueSchema);
