import mongoose, { Document, Schema } from 'mongoose';

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

// Extended 9-goal system (maps to calorie strategies in DailyTarget)
export type Goal =
  | 'lose'         // legacy
  | 'maintain'     // legacy
  | 'gain'         // legacy
  | 'lose_fat'
  | 'gain_weight'
  | 'more_energy'
  | 'event_prep'
  | 'muscle_up'
  | 'control_sugar'
  | 'eat_healthier'
  | 'just_track';

export type Gender = 'male' | 'female' | 'other';
export type UnitSystem = 'metric' | 'imperial';

export interface WeightEntry {
  weightKg: number;
  date: string;
}

export interface IUserProfile {
  age?: number;
  weightKg?: number;
  targetWeightKg?: number;
  heightCm?: number;
  activityLevel?: ActivityLevel;
  goal?: Goal;
  goals?: Goal[];       // multi-select goals from onboarding
  gender?: Gender;
  unitSystem: UnitSystem;
  streakDays?: number;
  weightHistory?: WeightEntry[];
  avatarUrl?: string;   // Cloudinary profile picture URL
}

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  isGuest: boolean;
  tokenVersion: number;
  profile: IUserProfile;
  onboardingComplete: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const GOAL_VALUES = [
  'lose', 'maintain', 'gain',
  'lose_fat', 'gain_weight', 'more_energy', 'event_prep',
  'muscle_up', 'control_sugar', 'eat_healthier', 'just_track',
];

const UserProfileSchema = new Schema<IUserProfile>(
  {
    age: { type: Number, min: 10, max: 120 },
    weightKg: { type: Number, min: 20, max: 500 },
    targetWeightKg: { type: Number, min: 20, max: 500 },
    heightCm: { type: Number, min: 50, max: 300 },
    activityLevel: {
      type: String,
      enum: ['sedentary', 'light', 'moderate', 'active', 'very_active'],
    },
    goal: { type: String, enum: GOAL_VALUES },
    goals: [{ type: String, enum: GOAL_VALUES }],
    gender: { type: String, enum: ['male', 'female', 'other'] },
    unitSystem: { type: String, enum: ['metric', 'imperial'], default: 'metric' },
    streakDays: { type: Number, default: 1, min: 0, max: 36500 },
    weightHistory: [
      {
        weightKg: { type: Number, min: 1, max: 500 },
        date: {
          type: String,
          match: /^\d{4}-\d{2}-\d{2}$/,
        },
      },
    ],
    avatarUrl: { type: String, maxlength: 500 },
  },
  { _id: false }
);


const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true },
    isGuest: { type: Boolean, default: false },
    tokenVersion: { type: Number, default: 0 },
    profile: { type: UserProfileSchema, default: () => ({ unitSystem: 'metric' }) },
    onboardingComplete: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    collection: 'users',
  }
);

export const User = mongoose.model<IUser>('User', UserSchema);
