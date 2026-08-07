import mongoose, { Document, Schema } from 'mongoose';

export interface IDeviceToken extends Document {
  userId: mongoose.Types.ObjectId;
  expoPushToken: string;
  platform: 'ios' | 'android';
  isValid: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DeviceTokenSchema = new Schema<IDeviceToken>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    expoPushToken: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 200,
    },
    platform: {
      type: String,
      enum: ['ios', 'android'],
      required: true,
    },
    isValid: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'device_tokens',
  }
);

// Compound index for fast per-user token lookups
DeviceTokenSchema.index({ userId: 1, isValid: 1 });

export const DeviceToken = mongoose.model<IDeviceToken>('DeviceToken', DeviceTokenSchema);
