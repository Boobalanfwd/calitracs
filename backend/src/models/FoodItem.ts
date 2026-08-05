import mongoose, { Document, Schema } from 'mongoose';

export interface IFoodItemDoc extends Document {
  name: string;
  category?: string;
  isLiquid: boolean;
  caloriesPer100gOrMl: number;
  proteinGPer100gOrMl: number;
  carbsGPer100gOrMl: number;
  fatGPer100gOrMl: number;
  fiberGPer100gOrMl?: number;
  typicalServingSizeGramsOrMl: number;
  source: 'usda' | 'openfoodfacts' | 'system' | 'user_created';
  barcode?: string;
  createdAt: Date;
  updatedAt: Date;
}

const FoodItemSchema = new Schema<IFoodItemDoc>(
  {
    name: { type: String, required: true, trim: true, index: true },
    category: { type: String, default: 'General' },
    isLiquid: { type: Boolean, default: false },
    caloriesPer100gOrMl: { type: Number, required: true, min: 0 },
    proteinGPer100gOrMl: { type: Number, required: true, min: 0, default: 0 },
    carbsGPer100gOrMl: { type: Number, required: true, min: 0, default: 0 },
    fatGPer100gOrMl: { type: Number, required: true, min: 0, default: 0 },
    fiberGPer100gOrMl: { type: Number, min: 0, default: 0 },
    typicalServingSizeGramsOrMl: { type: Number, default: 150 },
    source: {
      type: String,
      enum: ['usda', 'openfoodfacts', 'system', 'user_created'],
      default: 'system',
    },
    barcode: { type: String, index: true, sparse: true },
  },
  {
    timestamps: true,
    collection: 'food_items',
  }
);

FoodItemSchema.index({ name: 'text' });

export const FoodItem = mongoose.model<IFoodItemDoc>('FoodItem', FoodItemSchema);
