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

export interface BaseNutrition {
  name: string;
  caloriesPer100gOrMl: number;
  proteinGPer100gOrMl: number;
  carbsGPer100gOrMl: number;
  fatGPer100gOrMl: number;
  isLiquid?: boolean;
  densityGPerMl?: number; // default 1.0
}

export interface CalculatedNutrition {
  unit: PortionUnit;
  quantity: number;
  weightGramsOrMl: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  portionDescription: string;
}

/**
 * Standard unit conversion defaults (in grams or ml)
 */
export const STANDARD_UNIT_EQUIVALENTS: Record<PortionUnit, { label: string; defaultEquiv: number }> = {
  g: { label: 'Grams (g)', defaultEquiv: 1 },
  ml: { label: 'Milliliters (ml)', defaultEquiv: 1 },
  cup: { label: 'Cup (approx 240ml / 195g)', defaultEquiv: 200 },
  glass: { label: 'Glass (approx 250ml)', defaultEquiv: 250 },
  bowl: { label: 'Bowl (approx 300g / 350ml)', defaultEquiv: 300 },
  piece: { label: 'Piece / Item', defaultEquiv: 100 },
  slice: { label: 'Slice', defaultEquiv: 40 },
  scoop: { label: 'Scoop (approx 45g)', defaultEquiv: 45 },
  tbsp: { label: 'Tablespoon (15g / 15ml)', defaultEquiv: 15 },
  tsp: { label: 'Teaspoon (5g / 5ml)', defaultEquiv: 5 },
};

/**
 * Calculate exact calories and macronutrients for any portion unit & quantity.
 */
export function calculatePortionNutrition(
  base: BaseNutrition,
  unit: PortionUnit,
  quantity: number,
  customEquivGramsOrMl?: number
): CalculatedNutrition {
  const safeQty = Math.max(0.1, isNaN(quantity) ? 1 : quantity);
  
  // Determine standard multiplier for 1 unit
  let singleUnitWeight = customEquivGramsOrMl || STANDARD_UNIT_EQUIVALENTS[unit]?.defaultEquiv || 100;
  
  // Total weight or volume in grams/ml
  const totalWeightGramsOrMl = Math.round(singleUnitWeight * safeQty);

  // Compute metrics based on 100g / 100ml base
  const multiplier = totalWeightGramsOrMl / 100;

  const calories = Math.round(Math.max(0, base.caloriesPer100gOrMl * multiplier));
  const proteinG = Math.round((Math.max(0, base.proteinGPer100gOrMl * multiplier)) * 10) / 10;
  const carbsG = Math.round((Math.max(0, base.carbsGPer100gOrMl * multiplier)) * 10) / 10;
  const fatG = Math.round((Math.max(0, base.fatGPer100gOrMl * multiplier)) * 10) / 10;

  const unitLabel = STANDARD_UNIT_EQUIVALENTS[unit]?.label || unit;
  const unitSuffix = base.isLiquid ? 'ml' : 'g';
  const portionDescription = `${safeQty} ${unit === 'g' || unit === 'ml' ? unitSuffix : unit}${safeQty > 1 && unit !== 'g' && unit !== 'ml' ? 's' : ''} (${totalWeightGramsOrMl}${unitSuffix})`;

  return {
    unit,
    quantity: safeQty,
    weightGramsOrMl: totalWeightGramsOrMl,
    calories,
    proteinG,
    carbsG,
    fatG,
    portionDescription,
  };
}

/**
 * Generates all available portion options for a given food item
 */
export function getAvailablePortionOptions(
  isLiquid: boolean = false,
  typicalPortionG: number = 150
): PortionOption[] {
  if (isLiquid) {
    return [
      { unit: 'ml', label: 'Milliliters (ml)', equivalentGramsOrMl: 1 },
      { unit: 'glass', label: 'Glass (250 ml)', equivalentGramsOrMl: 250 },
      { unit: 'cup', label: 'Cup (240 ml)', equivalentGramsOrMl: 240 },
      { unit: 'bowl', label: 'Bowl (350 ml)', equivalentGramsOrMl: 350 },
      { unit: 'tbsp', label: 'Tablespoon (15 ml)', equivalentGramsOrMl: 15 },
    ];
  }

  return [
    { unit: 'g', label: 'Grams (g)', equivalentGramsOrMl: 1 },
    { unit: 'piece', label: `Serving / Piece (${typicalPortionG}g)`, equivalentGramsOrMl: typicalPortionG },
    { unit: 'cup', label: 'Cup (approx 195g)', equivalentGramsOrMl: 195 },
    { unit: 'bowl', label: 'Bowl (approx 300g)', equivalentGramsOrMl: 300 },
    { unit: 'scoop', label: 'Scoop (45g)', equivalentGramsOrMl: 45 },
    { unit: 'slice', label: 'Slice (40g)', equivalentGramsOrMl: 40 },
    { unit: 'tbsp', label: 'Tablespoon (15g)', equivalentGramsOrMl: 15 },
  ];
}
