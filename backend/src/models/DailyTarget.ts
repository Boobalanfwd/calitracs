import mongoose, { Document, Schema } from 'mongoose';

export interface IDailyTarget extends Document {
  userId: mongoose.Types.ObjectId;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  waterMl: number;
  updatedAt: Date;
}

const DailyTargetSchema = new Schema<IDailyTarget>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    calories: { type: Number, required: true, min: 500, max: 10000, default: 2000 },
    proteinG: { type: Number, required: true, min: 0, max: 500, default: 150 },
    carbsG: { type: Number, required: true, min: 0, max: 1000, default: 225 },
    fatG: { type: Number, required: true, min: 0, max: 500, default: 65 },
    waterMl: { type: Number, required: true, min: 500, max: 10000, default: 2000 },
  },
  {
    timestamps: true,
    collection: 'daily_targets',
  }
);

export const DailyTarget = mongoose.model<IDailyTarget>('DailyTarget', DailyTargetSchema);

type GoalInput =
  | 'lose' | 'maintain' | 'gain'
  | 'lose_fat' | 'gain_weight' | 'more_energy' | 'event_prep'
  | 'muscle_up' | 'control_sugar' | 'eat_healthier' | 'just_track';

/**
 * Maps new extended goal values to calorie adjustment categories.
 */
function resolveGoalCategory(goal: GoalInput): 'lose' | 'maintain' | 'gain' {
  switch (goal) {
    case 'lose':
    case 'lose_fat':
      return 'lose';
    case 'gain':
    case 'gain_weight':
    case 'muscle_up':
      return 'gain';
    default:
      return 'maintain';
  }
}

/**
 * Returns a macro ratio strategy based on the goal.
 * Protein / Carbs / Fat ratios — all must sum to 1.0
 */
function getMacroRatios(goal: GoalInput): { protein: number; carbs: number; fat: number } {
  switch (goal) {
    case 'lose_fat':
    case 'lose':
      // Higher protein to preserve muscle during cut
      return { protein: 0.35, carbs: 0.40, fat: 0.25 };

    case 'muscle_up':
    case 'gain':
    case 'gain_weight':
      // Higher protein + moderate carbs for muscle building
      return { protein: 0.35, carbs: 0.45, fat: 0.20 };

    case 'more_energy':
    case 'event_prep':
      // More carbs for energy/performance
      return { protein: 0.25, carbs: 0.55, fat: 0.20 };

    case 'control_sugar':
      // Low carb, higher protein + fat for blood sugar control
      return { protein: 0.35, carbs: 0.30, fat: 0.35 };

    case 'eat_healthier':
    case 'just_track':
    case 'maintain':
    default:
      // Balanced macros — standard nutritionist recommendation
      return { protein: 0.30, carbs: 0.45, fat: 0.25 };
  }
}

/**
 * Calculate TDEE-based daily targets using Mifflin-St Jeor + activity multiplier.
 * Supports all 9 extended goal types with nutritionist-grade macro ratios.
 */
export function calculateSuggestedTargets(
  age: number,
  weightKg: number,
  heightCm: number,
  gender: 'male' | 'female' | 'other',
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active',
  goal: GoalInput
): { calories: number; proteinG: number; carbsG: number; fatG: number; waterMl: number } {
  // Mifflin-St Jeor BMR equation
  let bmr: number;
  if (gender === 'male') {
    bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  } else {
    // Female and 'other' use female formula (conservative)
    bmr = 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
  }

  // Harris-Benedict activity multipliers
  const multipliers: Record<string, number> = {
    sedentary: 1.2,    // Little or no exercise
    light: 1.375,      // 1-3 days/week
    moderate: 1.55,    // 3-5 days/week
    active: 1.725,     // 6-7 days/week
    very_active: 1.9,  // Athlete / intense daily training
  };

  let tdee = bmr * multipliers[activityLevel];

  // Calorie adjustment based on goal category
  const category = resolveGoalCategory(goal);
  if (category === 'lose') {
    tdee -= 500;  // Standard 0.5 kg/week deficit
  } else if (category === 'gain') {
    tdee += 300;  // Lean bulk surplus
  }

  // Enforce minimum floor (no crash dieting)
  const minCalories = gender === 'male' ? 1500 : 1200;
  const calories = Math.round(Math.max(tdee, minCalories));

  // Macro breakdown using goal-specific ratios
  const ratios = getMacroRatios(goal);
  const proteinG = Math.round((calories * ratios.protein) / 4);   // 4 kcal/g
  const carbsG = Math.round((calories * ratios.carbs) / 4);        // 4 kcal/g
  const fatG = Math.round((calories * ratios.fat) / 9);             // 9 kcal/g

  const waterMl = Math.max(2000, Math.round(weightKg * 35));

  return { calories, proteinG, carbsG, fatG, waterMl };
}
