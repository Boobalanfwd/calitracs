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
  name: { type: String, required: true, maxlength: 200 },
  confidence: { type: Number, required: true, min: 0, max: 1 },
});

const FoodAnalysisSchema = new Schema<IFoodAnalysis>(
  {
    imageOriginalName: { type: String, required: true, maxlength: 200 },
    imageMimeType: { type: String, required: true, maxlength: 100 },
    imageSizeBytes: { type: Number, required: true, min: 0, max: 50 * 1024 * 1024 },
    isFood: { type: Boolean, required: true },
    foods: { type: [FoodItemSchema], default: [] },
    rawGeminiResponse: { type: String, default: '', maxlength: 100000 },
    analyzedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    collection: 'food_analyses',
  }
);

// Keep analysis history bounded — auto-delete records older than 30 days.
FoodAnalysisSchema.index({ analyzedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

export const FoodAnalysis = mongoose.model<IFoodAnalysis>('FoodAnalysis', FoodAnalysisSchema);
