import { GoogleGenerativeAI } from '@google/generative-ai';
import { lookupNutrition } from './nutritionService';
import { getAvailablePortionOptions, PortionOption } from './nutritionCalculator';

export interface GeminiFood {
  name: string;
  confidence: number;
}

export interface GeminiFoodWithNutrition extends GeminiFood {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  portionG: number;
  portionDescription: string;
  nutritionSource: 'nutritionix' | 'usda' | 'openfoodfacts' | 'gemini_estimate';
  isLiquid: boolean;
  caloriesPer100gOrMl: number;
  proteinGPer100gOrMl: number;
  carbsGPer100gOrMl: number;
  fatGPer100gOrMl: number;
  portionOptions: PortionOption[];
}

export interface GeminiAnalysisResult {
  is_food: boolean;
  foods: GeminiFoodWithNutrition[];
}

// Internal raw response from Gemini (before nutrition lookup)
interface GeminiRawFood {
  name: string;
  confidence: number;
  is_liquid?: boolean;
  calories_per_100g?: number;
  protein_g_per_100g?: number;
  carbs_g_per_100g?: number;
  fat_g_per_100g?: number;
  typical_portion_g?: number;
  portion_description?: string;
}

const FOOD_RECOGNITION_PROMPT = `You are a world-class AI food recognition and clinical nutrition estimation engine designed for high precision.

Analyze the provided image and identify all clearly visible food or beverage items.

Rules:
1. Dish Name Precision: Return exact, specific dish names (e.g., "Masala Dosa with Sambar", "Chicken Biryani", "Grilled Salmon with Asparagus").
2. Regional Awareness: Accurately recognize global & regional cuisines (Indian, Asian, Mediterranean, Western, Latin, etc.):
   - Indian/South Indian: idli, dosa, pongal, vada, chapati, parotta, biryani, rice, sambar, rasam, chutney, poriyal, kootu, dal, roti, naan, tandoori, pulao, upma, poha, uttapam, appam, puttu, lassi, chai, filter coffee, buttermilk.
3. State (Solid vs Liquid): Set is_liquid to true for beverages, soups, juices, milk, tea, coffee, lassi, sambar, rasam, curries.
4. Confidence Score: Return 0.0 to 1.0 based on visual clarity.
5. Base Metrics (Per 100g or 100ml): Estimate exact base nutrition per 100g (solid) or 100ml (liquid).
6. Standard Serving Size: Estimate realistic portion weight in grams or milliliters (e.g., 1 bowl = 250g/300ml, 1 piece = 120g).
7. If image contains no food or beverage, return is_food: false.

Return ONLY valid JSON, no markdown codeblocks:
{
  "is_food": true,
  "foods": [
    {
      "name": "Exact Food Name",
      "confidence": 0.95,
      "is_liquid": false,
      "calories_per_100g": 180,
      "protein_g_per_100g": 6.5,
      "carbs_g_per_100g": 28,
      "fat_g_per_100g": 5.2,
      "typical_portion_g": 200,
      "portion_description": "1 serving (approx 200g)"
    }
  ]
}

If no food or non-food image: {"is_food": false, "foods": []}`;

function safeNumber(val: any, fallback: number = 0): number {
  const n = Number(val);
  return isNaN(n) || !isFinite(n) ? fallback : n;
}

/** Clean JSON string from markdown code fences and non-JSON preamble */
function cleanJsonString(str: string): string {
  let cleaned = str.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }
  return cleaned;
}

/** Robustly parses Gemini JSON, with auto-repair and regex extraction for truncated output */
function parseGeminiResponseJson(responseText: string): { is_food: boolean; foods: GeminiRawFood[] } {
  const cleaned = cleanJsonString(responseText);

  // 1. Standard parse
  try {
    const parsed = JSON.parse(cleaned);
    const isFood = Boolean(parsed.is_food);
    const foods = Array.isArray(parsed.foods) ? parsed.foods : [];
    if (foods.length > 0 || parsed.is_food === false) {
      return { is_food: isFood, foods };
    }
  } catch (_) {
    // Continue to repair strategies
  }

  // 2. Auto-repair truncated JSON by closing brackets
  const attemptRepair = (str: string): any => {
    let repaired = str.trim();
    repaired = repaired.replace(/,?\s*"(?:[^"\\]|\\.)*"?\s*:?\s*"?\s*$/s, '');
    repaired = repaired.replace(/,\s*$/, '');

    let openBraces = (repaired.match(/\{/g) || []).length - (repaired.match(/\}/g) || []).length;
    let openBrackets = (repaired.match(/\[/g) || []).length - (repaired.match(/\]/g) || []).length;

    while (openBrackets > 0) { repaired += ']'; openBrackets--; }
    while (openBraces > 0) { repaired += '}'; openBraces--; }

    return JSON.parse(repaired);
  };

  try {
    const repairedObj = attemptRepair(cleaned);
    if (repairedObj && Array.isArray(repairedObj.foods) && repairedObj.foods.length > 0) {
      console.log('[Gemini] Successfully repaired truncated JSON response!');
      return { is_food: Boolean(repairedObj.is_food ?? true), foods: repairedObj.foods };
    }
  } catch (_) {
    // Continue to regex extraction strategy
  }

  // 3. Regex extraction: find all complete food JSON objects
  const foods: GeminiRawFood[] = [];
  const objectRegex = /\{\s*"name"\s*:\s*"([^"]+)"(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}/g;
  let match: RegExpExecArray | null;

  while ((match = objectRegex.exec(cleaned)) !== null) {
    try {
      const foodObj = JSON.parse(match[0]);
      if (foodObj.name && foodObj.name !== 'Food Item') {
        foods.push(foodObj);
      }
    } catch (_) {}
  }

  if (foods.length > 0) {
    console.log(`[Gemini] Extracted ${foods.length} food items via regex parsing from response.`);
    return { is_food: true, foods };
  }

  const isFoodText = responseText.toLowerCase().includes('is_food": true') || responseText.toLowerCase().includes('food');
  return { is_food: isFoodText, foods: [] };
}

export const analyzeImageWithGemini = async (
  imageBuffer: Buffer,
  mimeType: string
): Promise<GeminiAnalysisResult> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment variables. Check .env file.');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
    },
  });

  const imageBase64 = imageBuffer.toString('base64');
  const imagePart = { inlineData: { data: imageBase64, mimeType } };

  console.log(`[Gemini] Analyzing image (${Math.round(imageBuffer.length / 1024)}KB, ${mimeType})`);

  let responseText = '';
  try {
    const result = await model.generateContent([FOOD_RECOGNITION_PROMPT, imagePart]);
    responseText = result.response.text().trim();
    console.log('[Gemini] Raw response:', responseText);
  } catch (apiErr: any) {
    console.error('[Gemini] API generateContent error:', apiErr);
    throw new Error(`Gemini AI service error: ${apiErr.message || 'Unable to process image'}`);
  }

  // Parse JSON with robust auto-repair fallback handling
  const parsed = parseGeminiResponseJson(responseText);

  const isFood = parsed.is_food;
  const rawFoods = parsed.foods;

  if (!isFood || rawFoods.length === 0) {
    return { is_food: false, foods: [] };
  }

  // Enrich each food with per-100g metrics and available portion unit options
  const enrichedFoods = await Promise.all(
    rawFoods
      .filter((f) => f && typeof f.name === 'string' && f.name.trim().length > 0)
      .map(async (rawFood): Promise<GeminiFoodWithNutrition> => {
        try {
          const foodName = rawFood.name.trim();
          const confidence = Math.min(1, Math.max(0, safeNumber(rawFood.confidence, 0.85)));
          const isLiquid = Boolean(rawFood.is_liquid);
          const nutrition = await lookupNutrition(foodName, rawFood);

          const typicalPortionG = safeNumber(rawFood.typical_portion_g || nutrition.portionG, 150);

          // Calculate 100g/100ml base metrics
          const caloriesPer100gOrMl = safeNumber(
            rawFood.calories_per_100g || (nutrition.scaledCalories / (typicalPortionG / 100)),
            150
          );
          const proteinGPer100gOrMl = safeNumber(
            rawFood.protein_g_per_100g || (nutrition.scaledProteinG / (typicalPortionG / 100)),
            6
          );
          const carbsGPer100gOrMl = safeNumber(
            rawFood.carbs_g_per_100g || (nutrition.scaledCarbsG / (typicalPortionG / 100)),
            25
          );
          const fatGPer100gOrMl = safeNumber(
            rawFood.fat_g_per_100g || (nutrition.scaledFatG / (typicalPortionG / 100)),
            5
          );

          // Available measurement portion options
          const portionOptions = getAvailablePortionOptions(isLiquid, typicalPortionG);

          return {
            name: foodName,
            confidence,
            isLiquid,
            calories: safeNumber(nutrition.scaledCalories, Math.round(caloriesPer100gOrMl * (typicalPortionG / 100))),
            proteinG: safeNumber(nutrition.scaledProteinG, Math.round(proteinGPer100gOrMl * (typicalPortionG / 100))),
            carbsG: safeNumber(nutrition.scaledCarbsG, Math.round(carbsGPer100gOrMl * (typicalPortionG / 100))),
            fatG: safeNumber(nutrition.scaledFatG, Math.round(fatGPer100gOrMl * (typicalPortionG / 100))),
            portionG: typicalPortionG,
            portionDescription: rawFood.portion_description || `1 serving (approx ${typicalPortionG}${isLiquid ? 'ml' : 'g'})`,
            nutritionSource: nutrition.source || 'gemini_estimate',
            caloriesPer100gOrMl: Math.round(caloriesPer100gOrMl),
            proteinGPer100gOrMl: Math.round(proteinGPer100gOrMl * 10) / 10,
            carbsGPer100gOrMl: Math.round(carbsGPer100gOrMl * 10) / 10,
            fatGPer100gOrMl: Math.round(fatGPer100gOrMl * 10) / 10,
            portionOptions,
          };
        } catch (itemErr) {
          console.error(`[Gemini] Error processing food item "${rawFood?.name}":`, itemErr);
          const defaultPortion = 150;
          return {
            name: (rawFood?.name || 'Food Item').trim(),
            confidence: 0.8,
            isLiquid: false,
            calories: 200,
            proteinG: 8,
            carbsG: 30,
            fatG: 6,
            portionG: defaultPortion,
            portionDescription: `1 serving (approx ${defaultPortion}g)`,
            nutritionSource: 'gemini_estimate',
            caloriesPer100gOrMl: 133,
            proteinGPer100gOrMl: 5.3,
            carbsGPer100gOrMl: 20.0,
            fatGPer100gOrMl: 4.0,
            portionOptions: getAvailablePortionOptions(false, defaultPortion),
          };
        }
      })
  );

  return {
    is_food: true,
    foods: enrichedFoods.sort((a, b) => b.confidence - a.confidence),
  };
};

export interface QuickTextLookupItem {
  name: string;
  quantity?: string;
  unit?: string;
}

export interface QuickTextLookupResultItem {
  name: string;
  portionG: number;
  portionDescription: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
}

export const lookupFoodTextWithGemini = async (
  items: QuickTextLookupItem[] | string
): Promise<QuickTextLookupResultItem[]> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment variables.');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
    },
  });

  const queryText = typeof items === 'string'
    ? items
    : items.map(i => `${i.quantity || '1'} ${i.unit || 'serving'} of ${i.name}`).join(', ');

  const prompt = `You are an expert nutritionist assistant. Calculate exact calories, protein (g), carbs (g), fat (g), and dietary fiber (g) for the following food items:

Items: "${queryText}"

Return ONLY valid JSON format:
{
  "items": [
    {
      "name": "Food Name",
      "portionG": 150,
      "portionDescription": "150g / 2 pieces",
      "calories": 220,
      "proteinG": 12.5,
      "carbsG": 28.0,
      "fatG": 6.0,
      "fiberG": 3.5
    }
  ]
}`;

  try {
    const result = await model.generateContent([prompt]);
    const text = result.response.text().trim();
    const cleaned = cleanJsonString(text);
    const parsed = JSON.parse(cleaned);
    const resultItems = Array.isArray(parsed.items) ? parsed.items : [];

    return resultItems.map((item: any) => ({
      name: (item.name || 'Food Item').trim(),
      portionG: safeNumber(item.portionG, 150),
      portionDescription: item.portionDescription || `${item.portionG || 150}g`,
      calories: safeNumber(item.calories, 200),
      proteinG: safeNumber(item.proteinG, 8),
      carbsG: safeNumber(item.carbsG, 30),
      fatG: safeNumber(item.fatG, 6),
      fiberG: safeNumber(item.fiberG, 3),
    }));
  } catch (err) {
    console.error('[Gemini] Text lookup error:', err);
    return [
      {
        name: typeof items === 'string' ? items : items[0]?.name || 'Food Item',
        portionG: 150,
        portionDescription: '150g serving',
        calories: 200,
        proteinG: 8,
        carbsG: 30,
        fatG: 6,
        fiberG: 3,
      },
    ];
  }
};

export const detectFoodNamesOnly = async (
  imageBuffer: Buffer,
  mimeType: string
): Promise<{ is_food: boolean; foods: { name: string; confidence: number }[] }> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is missing');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
  });
  const imagePart = { inlineData: { data: imageBuffer.toString('base64'), mimeType } };
  const prompt = `Identify food items visible in this photo. Return JSON: {"is_food": true, "foods": [{"name": "Food Name", "confidence": 0.95}]}`;
  try {
    const res = await model.generateContent([prompt, imagePart]);
    const cleaned = cleanJsonString(res.response.text());
    const parsed = JSON.parse(cleaned);
    return {
      is_food: Boolean(parsed.is_food),
      foods: Array.isArray(parsed.foods) ? parsed.foods : [],
    };
  } catch {
    return { is_food: false, foods: [] };
  }
};

export const analyzeNutritionLabelWithGemini = async (
  imageBuffer: Buffer,
  mimeType: string
): Promise<any> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is missing');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
  });
  const imagePart = { inlineData: { data: imageBuffer.toString('base64'), mimeType } };
  const prompt = `Extract nutrition facts label from image. Return JSON: {"name": "Product Name", "servingSize": "1 container (240ml)", "calories": 150, "proteinG": 8, "carbsG": 12, "fatG": 5}`;
  try {
    const res = await model.generateContent([prompt, imagePart]);
    const cleaned = cleanJsonString(res.response.text());
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
};
