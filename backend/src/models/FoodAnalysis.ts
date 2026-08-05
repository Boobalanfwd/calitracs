import mongoose, { Document, Schema } from 'mongoose';

export interface IFoodItem {
  name: string;
  confidence: number;
}

export interface IFoodAnalysis extends Document {
  imageOriginalName: string;
  imageMimeType: string;
  imageSizeBytes: number;
  isFood: boolean;
  foods: IFoodItem[];
  rawGeminiResponse: string;
  analyzedAt: Date;
}

const FoodItemSchema = new Schema<IFoodItem>({
  name: { type: String, required: true },
  confidence: { type: Number, required: true, min: 0, max: 1 },
});

const FoodAnalysisSchema = new Schema<IFoodAnalysis>(
  {
    imageOriginalName: { type: String, required: true },
    imageMimeType: { type: String, required: true },
    imageSizeBytes: { type: Number, required: true },
    isFood: { type: Boolean, required: true },
    foods: { type: [FoodItemSchema], default: [] },
    rawGeminiResponse: { type: String, default: '' },
    analyzedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    collection: 'food_analyses',
  }
);

export const FoodAnalysis = mongoose.model<IFoodAnalysis>('FoodAnalysis', FoodAnalysisSchema);
