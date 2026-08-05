// Shared TypeScript types across the mobile app — Phase 2

// ── Auth ──────────────────────────────────────────────────────────────────────

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type Goal =
  | 'lose'          // legacy
  | 'maintain'      // legacy
  | 'gain'          // legacy
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
export type MealType = 'breakfast' | 'morning_snack' | 'lunch' | 'afternoon_snack' | 'dinner' | 'evening_snack';
export type NutritionSource = 'nutritionix' | 'usda' | 'openfoodfacts' | 'gemini_estimate' | 'manual';

export interface WeightEntry {
  weightKg: number;
  date: string;
}

export interface UserProfile {
  age?: number;
  weightKg?: number;
  targetWeightKg?: number;
  heightCm?: number;
  activityLevel?: ActivityLevel;
  goal?: Goal;
  goals?: Goal[];     // multi-select from onboarding
  gender?: Gender;
  unitSystem: UnitSystem;
  streakDays?: number;
  weightHistory?: WeightEntry[];
  avatarUrl?: string;  // Cloudinary profile picture URL
}


export interface User {
  id: string;
  name: string;
  email: string | null;
  isGuest: boolean;
  onboardingComplete: boolean;
  profile: UserProfile;
}

// ── Nutrition ─────────────────────────────────────────────────────────────────

export type PortionUnit =
  | 'g'
  | 'ml'
  | 'cup'
  | 'glass'
  | 'bowl'
  | 'piece'
  | 'slice'
  | 'scoop'
  | 'tbsp'
  | 'tsp';

export interface PortionOption {
  unit: PortionUnit;
  label: string;
  equivalentGramsOrMl: number;
}

export interface FoodItem {
  name: string;
  confidence: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  portionG: number;
  portionDescription: string;
  nutritionSource: NutritionSource;
  isLiquid?: boolean;
  portionUnit?: PortionUnit;
  portionQuantity?: number;
  weightGramsOrMl?: number;
  caloriesPer100gOrMl?: number;
  proteinGPer100gOrMl?: number;
  carbsGPer100gOrMl?: number;
  fatGPer100gOrMl?: number;
  portionOptions?: PortionOption[];
}

export interface AnalysisResult {
  success: boolean;
  is_food: boolean;
  foods: FoodItem[];
  analysisId?: string;
  error?: string;
}

// ── Food Log ──────────────────────────────────────────────────────────────────

export interface FoodEntry {
  _id: string;
  name: string;
  meal: MealType;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  portionUnit?: PortionUnit;
  portionQuantity?: number;
  weightGramsOrMl?: number;
  portionG?: number;
  portionDescription?: string;
  isLiquid?: boolean;
  source: 'ai' | 'manual';
  nutritionSource: NutritionSource;
  confidence?: number;
  imageUrl?: string;    // Cloudinary food photo URL
  addedAt: string;
}

export interface WaterLogEntry {
  _id: string;
  amountMl: number;
  addedAt: string;
}

export interface FoodLog {
  _id?: string;
  userId?: string;
  date: string;
  entries: FoodEntry[];
  waterIntakeMl?: number;
  waterLogs?: WaterLogEntry[];
  totalCalories: number;
  totalProteinG: number;
  totalCarbsG: number;
  totalFatG: number;
}

export interface DailyTarget {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  waterMl?: number;
}

// ── Calendar ──────────────────────────────────────────────────────────────────

export interface CalendarDay {
  date: string;
  totalCalories: number;
  totalProteinG: number;
  totalCarbsG: number;
  totalFatG: number;
  targetCalories: number;
  percentage: number;
}

// ── Navigation ────────────────────────────────────────────────────────────────

export type AuthStackParamList = {
  Splash: undefined;
  Login: undefined;
  Signup: undefined;
  Onboarding: undefined;
  OnboardingPlan: {
    targets: { calories: number; proteinG: number; carbsG: number; fatG: number };
    name: string;
    goals: Goal[];
  };
};

export type MainTabParamList = {
  Dashboard: undefined;
  Progress: undefined;
  AddFood: undefined;
  Calendar: undefined;
  Profile: undefined;
};

export type FoodStackParamList = {
  AddFoodChoice: undefined;
  Home: undefined;
  Camera: undefined;
  CameraScanner: undefined;
  Preview: { imageUri: string; base64?: string };
  Result: { imageUri: string; result: AnalysisResult };
  LogEntry: { food: FoodItem; imageUri?: string };
  ManualEntry: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  // Onboarding lives here so it works even when isAuthenticated = true
  Onboarding: undefined;
  OnboardingPlan: {
    targets: { calories: number; proteinG: number; carbsG: number; fatG: number };
    name: string;
    goals: Goal[];
  };
  CameraScanner: undefined;
  ManualEntry: undefined;
  LogEntry: { food: FoodItem; imageUri?: string };
  FoodDetailEdit: { foodEntry: FoodEntry; date?: string };
  // Legacy screens (kept for compat)
  Home: undefined;
  Preview: { imageUri: string; base64?: string };
  Result: { imageUri: string; result: AnalysisResult };
};




// ── Meal helpers ──────────────────────────────────────────────────────────────

export const MEAL_CONFIG: Record<MealType, { label: string; emoji: string; timeHint: string }> = {
  breakfast: { label: 'Breakfast', emoji: '🌅', timeHint: '6 AM – 11 AM' },
  morning_snack: { label: 'Morning Snack', emoji: '🍎', timeHint: '9 AM – 12 PM' },
  lunch: { label: 'Lunch', emoji: '☀️', timeHint: '11 AM – 3 PM' },
  afternoon_snack: { label: 'Afternoon Snack', emoji: '🧃', timeHint: '2 PM – 6 PM' },
  dinner: { label: 'Dinner', emoji: '🌙', timeHint: '6 PM – 10 PM' },
  evening_snack: { label: 'Evening Snack', emoji: '🌜', timeHint: '8 PM – 11 PM' },
};
