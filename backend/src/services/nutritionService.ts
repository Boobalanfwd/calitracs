/**
 * Nutrition lookup service — 5-step accuracy chain.
 *
 * Priority order for every food lookup:
 *  1️⃣  In-memory cache  (zero latency — past session results)
 *  2️⃣  Nutritionix      (Indian + global foods, best coverage)
 *  3️⃣  USDA FoodData Central (Foundation + SR Legacy — global ingredients)
 *  4️⃣  Open Food Facts  (packaged / branded products)
 *  5️⃣  Gemini AI estimate (always succeeds — final fallback)
 */

export interface NutritionPer100g {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface NutritionResult extends NutritionPer100g {
  source: 'nutritionix' | 'usda' | 'openfoodfacts' | 'gemini_estimate';
  portionG: number;
  /** Scaled to portion */
  scaledCalories: number;
  scaledProteinG: number;
  scaledCarbsG: number;
  scaledFatG: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function safeNum(val: any, fallback: number = 0): number {
  const n = Number(val);
  return isNaN(n) || !isFinite(n) ? fallback : n;
}

function scale(
  per100g: NutritionPer100g,
  portionG: number
): Omit<NutritionResult, 'source' | keyof NutritionPer100g | 'portionG'> {
  const pG = Math.max(1, safeNum(portionG, 150));
  const f = pG / 100;
  return {
    scaledCalories: Math.round(safeNum(per100g.calories, 150) * f),
    scaledProteinG: Math.round(safeNum(per100g.proteinG, 5) * f * 10) / 10,
    scaledCarbsG: Math.round(safeNum(per100g.carbsG, 20) * f * 10) / 10,
    scaledFatG: Math.round(safeNum(per100g.fatG, 4) * f * 10) / 10,
  };
}

// ── Step 2: Nutritionix ───────────────────────────────────────────────────────

async function tryNutritionix(
  foodName: string
): Promise<NutritionPer100g | null> {
  try {
    const { fetchFromNutritionix } = await import('./indianNutritionService');
    return await fetchFromNutritionix(foodName);
  } catch (err) {
    console.warn('[Nutrition] Nutritionix import/call failed:', (err as Error).message);
    return null;
  }
}

const STOP_WORDS = new Set(['plain', 'fresh', 'raw', 'cooked', 'dried', 'sliced', 'whole', 'organic', 'style', 'with', 'and', 'the', 'small', 'large', 'medium', 'green', 'red', 'yellow', 'white']);

/** Check if the search result from external DB actually matches the food being queried */
function isRelevantMatch(queryName: string, resultName: string): boolean {
  if (!resultName || typeof resultName !== 'string') return false;

  const qTokens = queryName.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(t => t.length > 1);
  const rText = resultName.toLowerCase();

  const significantTokens = qTokens.filter(t => !STOP_WORDS.has(t));
  if (significantTokens.length === 0) return true;

  const mainNoun = significantTokens[significantTokens.length - 1];
  if (mainNoun && !rText.includes(mainNoun)) {
    return false;
  }

  return true;
}

// ── Step 3: USDA FoodData Central ─────────────────────────────────────────────

async function fetchFromUSDA(foodName: string): Promise<NutritionPer100g | null> {
  try {
    const apiKey = process.env.USDA_API_KEY || 'DEMO_KEY';
    const encoded = encodeURIComponent(foodName);
    const url =
      `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encoded}` +
      `&api_key=${apiKey}&pageSize=3&dataType=Foundation,SR%20Legacy`;

    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const data: any = await res.json();

    const foods: any[] = data?.foods ?? [];
    for (const food of foods) {
      if (!isRelevantMatch(foodName, food.description)) {
        console.log(`[Nutrition] USDA rejected irrelevant match: "${food.description}" for query "${foodName}"`);
        continue;
      }

      const nutrients: any[] = food?.foodNutrients ?? [];
      const get = (id: number) =>
        nutrients.find((n: any) => n.nutrientId === id)?.value ?? null;

      const cal = get(1008);
      const protein = get(1003);
      const carbs = get(1005);
      const fat = get(1004);

      if (cal !== null) {
        console.log(`[Nutrition] USDA hit: "${food.description}" for "${foodName}"`);
        return {
          calories: Math.round(safeNum(cal, 150)),
          proteinG: Math.round(safeNum(protein, 5) * 10) / 10,
          carbsG: Math.round(safeNum(carbs, 20) * 10) / 10,
          fatG: Math.round(safeNum(fat, 4) * 10) / 10,
        };
      }
    }
    return null;
  } catch (err) {
    console.warn('[Nutrition] USDA failed (skipping):', (err as Error).message);
    return null;
  }
}

// ── Step 4: Open Food Facts ───────────────────────────────────────────────────

async function fetchFromOpenFoodFacts(
  foodName: string
): Promise<NutritionPer100g | null> {
  try {
    const encoded = encodeURIComponent(foodName);
    const url =
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encoded}` +
      `&json=1&page_size=3&fields=product_name,nutriments&lc=en&cc=in`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(4000),
      headers: { 'User-Agent': 'FoodLensAI/2.0 (contact@foodlens.app)' },
    });

    if (!res.ok) return null;
    const data: any = await res.json();

    const products: any[] = data?.products ?? [];
    for (const p of products) {
      if (!isRelevantMatch(foodName, p.product_name)) {
        console.log(`[Nutrition] OpenFoodFacts rejected irrelevant match: "${p.product_name}" for query "${foodName}"`);
        continue;
      }

      const n = p?.nutriments;
      if (!n) continue;
      const cal = n['energy-kcal_100g'] ?? n['energy_100g'];
      const protein = n['proteins_100g'];
      const carbs = n['carbohydrates_100g'];
      const fat = n['fat_100g'];

      if (cal !== undefined && cal !== null) {
        console.log(
          `[Nutrition] OpenFoodFacts hit: "${p.product_name}" for "${foodName}"`
        );
        return {
          calories: Math.round(safeNum(cal, 150)),
          proteinG: Math.round(safeNum(protein, 5) * 10) / 10,
          carbsG: Math.round(safeNum(carbs, 20) * 10) / 10,
          fatG: Math.round(safeNum(fat, 4) * 10) / 10,
        };
      }
    }
    return null;
  } catch (err) {
    console.warn('[Nutrition] OpenFoodFacts failed (skipping):', (err as Error).message);
    return null;
  }
}

// ── Main Lookup ───────────────────────────────────────────────────────────────

interface GeminiEstimate {
  calories_per_100g?: number;
  protein_g_per_100g?: number;
  carbs_g_per_100g?: number;
  fat_g_per_100g?: number;
  typical_portion_g?: number;
}

/**
 * Lookup nutrition for a food name + portion, trying 5 sources in order.
 * Always succeeds — never throws an exception.
 */
export async function lookupNutrition(
  foodName: string,
  geminiEstimate: GeminiEstimate
): Promise<NutritionResult> {
  try {
    const portionG = Math.max(1, safeNum(geminiEstimate?.typical_portion_g, 150));

    // ── Step 1: Cache ─────────────────────────────────────────────────────────
    const { getCached, setCached } = await import('./nutritionCache');
    const cached = getCached(foodName);
    if (cached) {
      // Re-scale to this request's portion (portion may differ between calls)
      return {
        ...cached,
        portionG,
        ...scale(cached, portionG),
      };
    }

    // ── Step 2: Nutritionix (Indian + global, most accurate) ──────────────────
    const nutritionixData = await tryNutritionix(foodName);
    if (nutritionixData) {
      const result: NutritionResult = {
        ...nutritionixData,
        source: 'nutritionix',
        portionG,
        ...scale(nutritionixData, portionG),
      };
      setCached(foodName, result);
      return result;
    }

    // ── Step 3: USDA ──────────────────────────────────────────────────────────
    const usdaData = await fetchFromUSDA(foodName);
    if (usdaData) {
      const result: NutritionResult = {
        ...usdaData,
        source: 'usda',
        portionG,
        ...scale(usdaData, portionG),
      };
      setCached(foodName, result);
      return result;
    }

    // ── Step 4: Open Food Facts ───────────────────────────────────────────────
    const offData = await fetchFromOpenFoodFacts(foodName);
    if (offData) {
      const result: NutritionResult = {
        ...offData,
        source: 'openfoodfacts',
        portionG,
        ...scale(offData, portionG),
      };
      setCached(foodName, result);
      return result;
    }

    // ── Step 5: Gemini AI estimate (fallback — always succeeds) ───────────────
    console.log(`[Nutrition] All external sources missed — using Gemini estimate for "${foodName}"`);
    const gemini: NutritionPer100g = {
      calories: Math.round(safeNum(geminiEstimate?.calories_per_100g, 150)),
      proteinG: Math.round(safeNum(geminiEstimate?.protein_g_per_100g, 5) * 10) / 10,
      carbsG: Math.round(safeNum(geminiEstimate?.carbs_g_per_100g, 20) * 10) / 10,
      fatG: Math.round(safeNum(geminiEstimate?.fat_g_per_100g, 4) * 10) / 10,
    };
    return {
      ...gemini,
      source: 'gemini_estimate',
      portionG,
      ...scale(gemini, portionG),
    };
  } catch (err) {
    console.error('[Nutrition] Fatal error in lookupNutrition:', err);
    const fallback: NutritionPer100g = { calories: 150, proteinG: 5, carbsG: 20, fatG: 4 };
    return {
      ...fallback,
      source: 'gemini_estimate',
      portionG: 150,
      ...scale(fallback, 150),
    };
  }
}

/**
 * Human-readable label for a nutrition source code.
 */
export function nutritionSourceLabel(
  source: NutritionResult['source']
): string {
  switch (source) {
    case 'nutritionix':
      return 'Nutritionix Database';
    case 'usda':
      return 'USDA FoodData Central';
    case 'openfoodfacts':
      return 'Open Food Facts';
    case 'gemini_estimate':
      return 'AI Estimate';
  }
}
