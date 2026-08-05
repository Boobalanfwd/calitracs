/**
 * Nutritionix food lookup service.
 *
 * Uses the Nutritionix Natural Language / Instant Search API to find verified
 * nutrition data for any food — with especially strong coverage of Indian
 * regional dishes (biryani, dosa, dal, paratha, chai, etc.).
 *
 * Free tier:
 *  - Instant endpoint: no API key required for basic search
 *  - NLP endpoint:     requires APP_ID + APP_KEY (free developer account)
 *
 * We use BOTH endpoints in sequence:
 *   1. NLP endpoint  → most accurate macro data (if keys are configured)
 *   2. Instant endpoint → fallback, no key needed
 *
 * Set in your .env:
 *   NUTRITIONIX_APP_ID=<your-app-id>
 *   NUTRITIONIX_APP_KEY=<your-app-key>
 *
 * Get free keys at: https://developer.nutritionix.com/
 */

import { NutritionPer100g } from './nutritionService';

// ── Helpers ───────────────────────────────────────────────────────────────────

function safeNum(val: any, fallback = 0): number {
  const n = Number(val);
  return isNaN(n) || !isFinite(n) ? fallback : n;
}

/**
 * Convert any per-serving values into per-100g equivalents.
 * Nutritionix NLP returns macros per serving with a `serving_weight_grams` field.
 */
function toPerHundredG(
  cal: number,
  protein: number,
  carbs: number,
  fat: number,
  servingWeightG: number
): NutritionPer100g {
  const sw = Math.max(1, servingWeightG);
  const factor = 100 / sw;
  return {
    calories: Math.round(cal * factor),
    proteinG: Math.round(protein * factor * 10) / 10,
    carbsG: Math.round(carbs * factor * 10) / 10,
    fatG: Math.round(fat * factor * 10) / 10,
  };
}

// ── NLP Endpoint (most accurate — requires free API key) ─────────────────────

/**
 * POST to the Nutritionix NLP endpoint.
 * Returns per-100g macros or null if no result / keys not set.
 */
async function fetchFromNutritionixNLP(
  foodName: string
): Promise<NutritionPer100g | null> {
  const appId = process.env.NUTRITIONIX_APP_ID;
  const appKey = process.env.NUTRITIONIX_APP_KEY;

  if (!appId || !appKey) return null; // skip if keys not configured

  try {
    const res = await fetch(
      'https://trackapi.nutritionix.com/v2/natural/nutrients',
      {
        method: 'POST',
        signal: AbortSignal.timeout(5000),
        headers: {
          'Content-Type': 'application/json',
          'x-app-id': appId,
          'x-app-key': appKey,
        },
        body: JSON.stringify({ query: foodName }),
      }
    );

    if (!res.ok) return null;
    const data: any = await res.json();
    const foods: any[] = data?.foods ?? [];
    if (foods.length === 0) return null;

    const f = foods[0];
    const cal = safeNum(f.nf_calories, 0);
    const protein = safeNum(f.nf_protein, 0);
    const carbs = safeNum(f.nf_total_carbohydrate, 0);
    const fat = safeNum(f.nf_total_fat, 0);
    const servingG = safeNum(f.serving_weight_grams, 100);

    if (cal <= 0) return null;

    const result = toPerHundredG(cal, protein, carbs, fat, servingG);
    console.log(
      `[Nutritionix] NLP hit: "${f.food_name}" for "${foodName}" ` +
        `(${result.calories} kcal/100g, serving=${servingG}g)`
    );
    return result;
  } catch (err) {
    console.warn('[Nutritionix] NLP error (skipping):', (err as Error).message);
    return null;
  }
}

// ── Instant Endpoint (no key, best-effort) ────────────────────────────────────

/**
 * GET to the Nutritionix Instant Search endpoint.
 * Returns per-100g macros or null if no result.
 *
 * Note: The instant endpoint returns less detailed macro info but works without
 * an API key. We use it as a secondary fallback within this service.
 */
async function fetchFromNutritionixInstant(
  foodName: string
): Promise<NutritionPer100g | null> {
  try {
    const encoded = encodeURIComponent(foodName);
    const url = `https://trackapi.nutritionix.com/v2/search/instant?query=${encoded}&detailed=true`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: {
        'x-app-id': process.env.NUTRITIONIX_APP_ID || 'c0b26e81',
        'x-app-key':
          process.env.NUTRITIONIX_APP_KEY ||
          '1f4b49c4adc6d384e7f4e87f0c1c8d0e',
        'x-remote-user-id': '0', // required by instant endpoint for anonymous use
      },
    });

    if (!res.ok) return null;
    const data: any = await res.json();

    // Prefer "common" foods (home-cooked, USDA-based, includes Indian dishes)
    const common: any[] = data?.common ?? [];
    const branded: any[] = data?.branded ?? [];
    const candidates = [...common, ...branded];

    for (const item of candidates) {
      const cal = safeNum(item.full_nutrients?.find((n: any) => n.attr_id === 208)?.value, 0);
      const protein = safeNum(item.full_nutrients?.find((n: any) => n.attr_id === 203)?.value, 0);
      const carbs = safeNum(item.full_nutrients?.find((n: any) => n.attr_id === 205)?.value, 0);
      const fat = safeNum(item.full_nutrients?.find((n: any) => n.attr_id === 204)?.value, 0);
      const servingG = safeNum(item.serving_weight_grams || item.nf_serving_weight_grams, 100);

      if (cal > 0) {
        const result = toPerHundredG(cal, protein, carbs, fat, servingG);
        console.log(
          `[Nutritionix] Instant hit: "${item.food_name}" for "${foodName}" ` +
            `(${result.calories} kcal/100g)`
        );
        return result;
      }
    }

    return null;
  } catch (err) {
    console.warn('[Nutritionix] Instant error (skipping):', (err as Error).message);
    return null;
  }
}

// ── Public Export ─────────────────────────────────────────────────────────────

/**
 * Fetch nutrition data from Nutritionix for any food name.
 * Tries the NLP endpoint first (most accurate), then falls back to Instant.
 * Returns null if both fail or produce no results.
 */
export async function fetchFromNutritionix(
  foodName: string
): Promise<NutritionPer100g | null> {
  // Try NLP endpoint first (most accurate per-serving breakdown)
  const nlpResult = await fetchFromNutritionixNLP(foodName);
  if (nlpResult) return nlpResult;

  // Fall back to instant search
  const instantResult = await fetchFromNutritionixInstant(foodName);
  return instantResult;
}
