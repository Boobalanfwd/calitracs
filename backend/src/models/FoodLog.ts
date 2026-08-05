import mongoose, { Document, Schema } from 'mongoose';
import { PortionUnit } from '../services/nutritionCalculator';

export type MealType = 'breakfast' | 'morning_snack' | 'lunch' | 'afternoon_snack' | 'dinner' | 'evening_snack';
export type EntrySource = 'ai' | 'manual';
export type NutritionSource = 'nutritionix' | 'openfoodfacts' | 'usda' | 'gemini_estimate' | 'manual';

export interface IWaterLogEntry {
  _id: mongoose.Types.ObjectId;
  amountMl: number;
  addedAt: Date;
}

export interface IFoodEntry {
  _id: mongoose.Types.ObjectId;
  name: string;
  meal: MealType;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  portionUnit: PortionUnit;
  portionQuantity: number;
  weightGramsOrMl: number;
  portionG?: number; // legacy compat
  portionDescription?: string;
  isLiquid?: boolean;
  source: EntrySource;
  nutritionSource: NutritionSource;
  confidence?: number;
  imageUrl?: string;   // Cloudinary food photo URL
  addedAt: Date;
}

export interface IFoodLog extends Document {
  userId: mongoose.Types.ObjectId;
  date: string; // YYYY-MM-DD
  entries: IFoodEntry[];
  waterIntakeMl: number;
  waterLogs: IWaterLogEntry[];
  totalCalories: number;
  totalProteinG: number;
  totalCarbsG: number;
  totalFatG: number;
  updatedAt: Date;
}

const WaterLogSchema = new Schema<IWaterLogEntry>(
  {
    amountMl: { type: Number, required: true, min: 1 },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const FoodEntrySchema = new Schema<IFoodEntry>(
  {
    name: { type: String, required: true, trim: true },
    meal: {
      type: String,
      required: true,
      enum: ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'evening_snack'],
    },
    calories: { type: Number, required: true, min: 0 },
    proteinG: { type: Number, required: true, min: 0, default: 0 },
    carbsG: { type: Number, required: true, min: 0, default: 0 },
    fatG: { type: Number, required: true, min: 0, default: 0 },
    portionUnit: {
      type: String,
      default: 'g',
      enum: ['g', 'ml', 'cup', 'glass', 'bowl', 'piece', 'slice', 'scoop', 'tbsp', 'tsp'],
    },
    portionQuantity: { type: Number, default: 1, min: 0.1 },
    weightGramsOrMl: { type: Number, default: 100, min: 1 },
    portionG: { type: Number, min: 1 },
    portionDescription: { type: String },
    isLiquid: { type: Boolean, default: false },
    source: { type: String, enum: ['ai', 'manual'], required: true },
    nutritionSource: {
      type: String,
      enum: ['nutritionix', 'openfoodfacts', 'usda', 'gemini_estimate', 'manual'],
      required: true,
      default: 'manual',
    },
    confidence: { type: Number, min: 0, max: 1 },
    imageUrl: { type: String },  // Cloudinary food photo URL
    addedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const FoodLogSchema = new Schema<IFoodLog>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    date: {
      type: String,
      required: true,
      index: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    entries: { type: [FoodEntrySchema], default: [] },
    waterIntakeMl: { type: Number, default: 0, min: 0 },
    waterLogs: { type: [WaterLogSchema], default: [] },
    totalCalories: { type: Number, default: 0 },
    totalProteinG: { type: Number, default: 0 },
    totalCarbsG: { type: Number, default: 0 },
    totalFatG: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    collection: 'food_logs',
  }
);

// Compound index: one log per user per day
FoodLogSchema.index({ userId: 1, date: 1 }, { unique: true });

// Auto-calculate totals before save
FoodLogSchema.pre('save', function (next) {
  const round2 = (val: number) => Math.round((val + Number.EPSILON) * 100) / 100;
  this.totalCalories = Math.round(this.entries.reduce((sum, e) => sum + (e.calories || 0), 0));
  this.totalProteinG = round2(this.entries.reduce((sum, e) => sum + (e.proteinG || 0), 0));
  this.totalCarbsG = round2(this.entries.reduce((sum, e) => sum + (e.carbsG || 0), 0));
  this.totalFatG = round2(this.entries.reduce((sum, e) => sum + (e.fatG || 0), 0));
  if (Array.isArray(this.waterLogs) && this.waterLogs.length > 0) {
    this.waterIntakeMl = this.waterLogs.reduce((sum, w) => sum + (w.amountMl || 0), 0);
  } else if (!this.waterIntakeMl) {
    this.waterIntakeMl = 0;
  }
  next();
});

export const FoodLog = mongoose.model<IFoodLog>('FoodLog', FoodLogSchema);
