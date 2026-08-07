import { Request, Response } from 'express';
import { analyzeImageWithGemini } from '../services/geminiService';
import { FoodAnalysis } from '../models/FoodAnalysis';
import { isDBConnected } from '../config/db';
import { isAllowedImageMime } from '../middlewares/upload';
import { sanitizeNutrition, isFiniteNumber } from '../utils/validation';

const VALID_PORTION_UNITS = ['g', 'ml', 'cup', 'glass', 'bowl', 'piece', 'slice', 'scoop', 'tbsp', 'tsp'];

export const analyzeFoodImage = async (req: Request, res: Response): Promise<void> => {
  try {
    let buffer: Buffer | undefined;
    let mimetype: string | undefined;
    let originalname = 'food_photo.jpg';
    let size = 0;

    if (req.file) {
      buffer = req.file.buffer;
      mimetype = req.file.mimetype;
      originalname = req.file.originalname;
      size = req.file.size;
    } else if (req.body && req.body.imageBase64) {
      const base64Data = req.body.imageBase64.replace(/^data:image\/\w+;base64,/, '');
      buffer = Buffer.from(base64Data, 'base64');
      mimetype = req.body.mimeType || 'image/jpeg';
      size = buffer.length;
      originalname = req.body.fileName || 'food_photo.jpg';
      console.log(`[Controller] Received image via base64 (${Math.round(size / 1024)}KB)`);
    }

    if (!buffer || !mimetype || buffer.length === 0) {
      res.status(400).json({
        success: false,
        error: 'No image provided. Please upload a food photo.',
      });
      return;
    }
    if (!isAllowedImageMime(mimetype)) {
      res.status(415).json({ success: false, error: 'Unsupported image format. Please use JPEG, PNG, WEBP, HEIC, or HEIF.' });
      return;
    }

    console.log(`[Controller] Analyzing image: ${originalname} (${Math.round(size / 1024)}KB)`);

    const geminiResult = await analyzeImageWithGemini(buffer, mimetype);

    // Save to MongoDB asynchronously (non-blocking, ignore DB errors if offline)
    let analysisId: string | undefined;
    try {
      if (isDBConnected()) {
        const analysis = new FoodAnalysis({
          imageOriginalName: originalname,
          imageMimeType: mimetype,
          imageSizeBytes: size,
          isFood: geminiResult.is_food,
          foods: (geminiResult.foods || []).map((f) => ({ name: f.name, confidence: f.confidence })),
          rawGeminiResponse: JSON.stringify(geminiResult),
        });
        analysisId = analysis._id.toString();
        analysis.save().catch((dbErr) => console.error('[Controller] MongoDB save error:', dbErr));
      }
    } catch (dbErr) {
      console.warn('[Controller] Non-fatal DB save error:', dbErr);
    }

    res.status(200).json({
      success: true,
      is_food: Boolean(geminiResult.is_food),
      foods: geminiResult.foods || [],
      ...(analysisId && { analysisId }),
    });
  } catch (error) {
    const err = error as Error;
    console.error('[Controller] Error analyzing food image:', err.stack || err.message);

    if (err.message.includes('File too large')) {
      res.status(413).json({ success: false, error: 'Image is too large. Please use an image smaller than 10MB.' });
      return;
    }
    if (err.message.includes('Unsupported image format')) {
      res.status(415).json({ success: false, error: err.message });
      return;
    }
    if (err.message.includes('GEMINI_API_KEY')) {
      res.status(500).json({ success: false, error: 'AI service is not configured. Please check GEMINI_API_KEY in environment variables.' });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Failed to analyze image. Please try again.',
    });
  }
};

export const quickTextLookup = async (req: Request, res: Response): Promise<void> => {
  try {
    const { items, query } = req.body;
    const input = items || query;

    if (!input || (Array.isArray(input) && input.length === 0)) {
      res.status(400).json({ success: false, error: 'Please provide food name and quantity.' });
      return;
    }

    const { lookupFoodTextWithGemini } = await import('../services/geminiService');
    const resultItems = await lookupFoodTextWithGemini(input);

    const totals = resultItems.reduce(
      (acc, item) => ({
        calories: acc.calories + item.calories,
        proteinG: Math.round((acc.proteinG + item.proteinG) * 10) / 10,
        carbsG: Math.round((acc.carbsG + item.carbsG) * 10) / 10,
        fatG: Math.round((acc.fatG + item.fatG) * 10) / 10,
        fiberG: Math.round((acc.fiberG + item.fiberG) * 10) / 10,
      }),
      { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 }
    );

    res.status(200).json({
      success: true,
      items: resultItems,
      totals,
    });
  } catch (err: any) {
    console.error('[quickTextLookup Error]:', err);
    res.status(500).json({ success: false, error: 'Failed to auto-calculate nutrition.' });
  }
};

export const barcodeLookup = async (req: Request, res: Response): Promise<void> => {
  try {
    const { barcode } = req.body;
    if (!barcode) {
      res.status(400).json({ success: false, error: 'Barcode number required.' });
      return;
    }

    const url = `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: { 'User-Agent': 'FoodLensAI/2.0' },
    });

    if (!response.ok) {
      res.status(404).json({ success: false, error: 'Barcode product not found.' });
      return;
    }

    const data: any = await response.json();
    if (!data || data.status !== 1 || !data.product) {
      res.status(404).json({ success: false, error: 'Product not found in Open Food Facts database.' });
      return;
    }

    const p = data.product;
    const nutriments = p.nutriments || {};
    // OFF data can be missing, zero, or insane — clamp to sane ranges.
    const name = String(p.product_name || p.product_name_en || 'Packaged Product').trim().slice(0, 200);
    const cal = sanitizeNutrition(nutriments['energy-kcal_100g'] ?? nutriments['energy_100g'] ?? 150, 150, 0, 2000);
    const protein = sanitizeNutrition(nutriments['proteins_100g'] ?? 0, 0, 0, 100, 1);
    const carbs = sanitizeNutrition(nutriments['carbohydrates_100g'] ?? 0, 0, 0, 100, 1);
    const fat = sanitizeNutrition(nutriments['fat_100g'] ?? 0, 0, 0, 100, 1);
    const fiber = sanitizeNutrition(nutriments['fiber_100g'] ?? 0, 0, 0, 100, 1);
    const serving = String(p.serving_size || '100g').trim().slice(0, 200);

    res.status(200).json({
      success: true,
      product: {
        name,
        brand: String(p.brands || '').slice(0, 200),
        barcode,
        portionDescription: serving,
        portionG: 100,
        calories: Math.round(cal),
        proteinG: Math.round(protein * 10) / 10,
        carbsG: Math.round(carbs * 10) / 10,
        fatG: Math.round(fat * 10) / 10,
        fiberG: Math.round(fiber * 10) / 10,
        imageUrl: p.image_front_small_url || p.image_url || '',
      },
    });
  } catch (err: any) {
    console.error('[barcodeLookup Error]:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch barcode info.' });
  }
};

export const analyzeNutritionLabel = async (req: Request, res: Response): Promise<void> => {
  try {
    let buffer: Buffer | undefined;
    let mimetype: string | undefined;

    if (req.file) {
      buffer = req.file.buffer;
      mimetype = req.file.mimetype;
    } else if (req.body && req.body.imageBase64) {
      const base64Data = req.body.imageBase64.replace(/^data:image\/\w+;base64,/, '');
      buffer = Buffer.from(base64Data, 'base64');
      mimetype = req.body.mimeType || 'image/jpeg';
    }

    if (!buffer || !mimetype) {
      res.status(400).json({ success: false, error: 'No image provided for label analysis.' });
      return;
    }
    if (!isAllowedImageMime(mimetype)) {
      res.status(415).json({ success: false, error: 'Unsupported image format. Please use JPEG, PNG, WEBP, HEIC, or HEIF.' });
      return;
    }

    // Upload label photo to its own category folder (non-blocking)
    let labelImageUrl: string | null = null;
    try {
      const { uploadFoodLabelImage } = await import('../services/cloudinaryService');
      labelImageUrl = await uploadFoodLabelImage(buffer, mimetype);
    } catch (_) {}

    const { analyzeNutritionLabelWithGemini } = await import('../services/geminiService');
    const item = await analyzeNutritionLabelWithGemini(buffer, mimetype);

    if (!item) {
      res.status(422).json({ success: false, error: 'Could not detect clear nutrition label in photo.' });
      return;
    }

    res.status(200).json({ success: true, item, labelImageUrl });
  } catch (err: any) {
    console.error('[analyzeNutritionLabel Error]:', err);
    res.status(500).json({ success: false, error: 'Failed to process nutrition label.' });
  }
};

export const detectFoodNames = async (req: Request, res: Response): Promise<void> => {
  try {
    let buffer: Buffer | undefined;
    let mimetype: string | undefined;

    if (req.file) {
      buffer = req.file.buffer;
      mimetype = req.file.mimetype;
    } else if (req.body && req.body.imageBase64) {
      const base64Data = req.body.imageBase64.replace(/^data:image\/\w+;base64,/, '');
      buffer = Buffer.from(base64Data, 'base64');
      mimetype = req.body.mimeType || 'image/jpeg';
    }

    if (!buffer || !mimetype) {
      res.status(400).json({ success: false, error: 'No image provided.' });
      return;
    }
    if (!isAllowedImageMime(mimetype)) {
      res.status(415).json({ success: false, error: 'Unsupported image format. Please use JPEG, PNG, WEBP, HEIC, or HEIF.' });
      return;
    }

    const { detectFoodNamesOnly } = await import('../services/geminiService');
    const result = await detectFoodNamesOnly(buffer, mimetype);

    res.status(200).json({
      success: true,
      is_food: result.is_food,
      foods: result.foods,
    });
  } catch (err: any) {
    console.error('[detectFoodNames Error]:', err);
    res.status(500).json({ success: false, error: 'Failed to detect food names.' });
  }
};

export const uploadFoodImage = async (req: Request, res: Response): Promise<void> => {
  try {
    let buffer: Buffer | undefined;
    let mimeType = 'image/jpeg';

    if (req.file) {
      buffer = req.file.buffer;
      mimeType = req.file.mimetype;
    } else if (req.body && req.body.imageBase64) {
      const base64Data = req.body.imageBase64.replace(/^data:image\/\w+;base64,/, '');
      buffer = Buffer.from(base64Data, 'base64');
      mimeType = req.body.mimeType || 'image/jpeg';
    }

    if (!buffer) {
      res.status(400).json({ success: false, error: 'No image provided for upload.' });
      return;
    }
    if (!isAllowedImageMime(mimeType)) {
      res.status(415).json({ success: false, error: 'Unsupported image format. Please use JPEG, PNG, WEBP, HEIC, or HEIF.' });
      return;
    }

    // Food log diary photos go to foodlens/food_logs/
    const { uploadFoodLogImage } = await import('../services/cloudinaryService');
    const imageUrl = await uploadFoodLogImage(buffer, mimeType);

    res.status(200).json({
      success: true,
      imageUrl: imageUrl || null,
      folder: 'foodlens/food_logs',
    });
  } catch (err: any) {
    console.error('[uploadFoodImage Error]:', err);
    res.status(500).json({ success: false, error: 'Failed to upload photo.' });
  }
};

export const saveFoodFeedback = async (req: Request, res: Response): Promise<void> => {
  try {
    const { analysisId, rating } = req.body;
    console.log(`[Feedback Received] Analysis ID: ${analysisId}, Rating: ${rating}`);
    res.status(200).json({ success: true, message: 'Feedback recorded successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to record feedback.' });
  }
};

export const convertPortion = async (req: Request, res: Response): Promise<void> => {
  try {
    const { baseNutrition, unit, quantity, customEquivGramsOrMl } = req.body;
    if (!baseNutrition || !unit) {
      res.status(400).json({ success: false, error: 'baseNutrition and unit are required.' });
      return;
    }

    if (typeof unit !== 'string' || !VALID_PORTION_UNITS.includes(unit)) {
      res.status(400).json({ success: false, error: `unit must be one of: ${VALID_PORTION_UNITS.join(', ')}` });
      return;
    }
    if (typeof baseNutrition !== 'object' || Array.isArray(baseNutrition)) {
      res.status(400).json({ success: false, error: 'baseNutrition must be an object.' });
      return;
    }
    for (const key of ['caloriesPer100gOrMl', 'proteinGPer100gOrMl', 'carbsGPer100gOrMl', 'fatGPer100gOrMl']) {
      if (baseNutrition[key] !== undefined && !isFiniteNumber(baseNutrition[key])) {
        res.status(400).json({ success: false, error: `baseNutrition.${key} must be a finite number.` });
        return;
      }
    }

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0 || qty > 1000) {
      res.status(400).json({ success: false, error: 'quantity must be a number between 0 and 1000.' });
      return;
    }

    const customEquiv =
      customEquivGramsOrMl === undefined || customEquivGramsOrMl === null
        ? undefined
        : Number(customEquivGramsOrMl);
    if (customEquiv !== undefined && (!Number.isFinite(customEquiv) || customEquiv <= 0 || customEquiv > 100000)) {
      res.status(400).json({ success: false, error: 'customEquivGramsOrMl must be a number between 0 and 100000.' });
      return;
    }

    const { calculatePortionNutrition } = await import('../services/nutritionCalculator');
    const result = calculatePortionNutrition(baseNutrition, unit as any, qty, customEquiv);

    res.status(200).json({
      success: true,
      result,
    });
  } catch (err: any) {
    console.error('[convertPortion Error]:', err);
    res.status(500).json({ success: false, error: 'Failed to calculate portion nutrition.' });
  }
};



