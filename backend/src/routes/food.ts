import { Router, Request, Response, NextFunction } from 'express';
import { uploadMiddleware } from '../middlewares/upload';
import {
  analyzeFoodImage,
  detectFoodNames,
  quickTextLookup,
  barcodeLookup,
  analyzeNutritionLabel,
  saveFoodFeedback,
  uploadFoodImage,
  convertPortion,
} from '../controllers/foodController';

const router = Router();

// POST /api/food/detect-names (Step 1: Food item name detection ONLY)
router.post('/detect-names', detectFoodNames);

// POST /api/food/upload-image (Uploads food photo to Cloudinary CDN)
router.post('/upload-image', uploadFoodImage);

// POST /api/food/analyze
router.post(
  '/analyze',
  (req: Request, res: Response, next: NextFunction) => {
    uploadMiddleware.single('image')(req, res, (err) => {
      if (err) {
        const message =
          err.code === 'LIMIT_FILE_SIZE'
            ? 'Image is too large. Please use an image smaller than 10MB.'
            : err.message || 'Failed to process image upload.';

        res.status(400).json({ success: false, error: message });
        return;
      }
      next();
    });
  },
  analyzeFoodImage
);

// POST /api/food/quick-lookup (Step 3: Real-time OpenFoodFacts + USDA macro calculation for confirmed counts/grams)
router.post('/quick-lookup', quickTextLookup);

// POST /api/food/barcode (Open Food Facts lookup)
router.post('/barcode', barcodeLookup);

// POST /api/food/analyze-label (Nutrition label OCR)
router.post(
  '/analyze-label',
  (req: Request, res: Response, next: NextFunction) => {
    uploadMiddleware.single('image')(req, res, () => next());
  },
  analyzeNutritionLabel
);

// POST /api/food/convert-portion (Portion unit math calculation)
router.post('/convert-portion', convertPortion);

// POST /api/food/feedback (AI accuracy feedback)
router.post('/feedback', saveFoodFeedback);

export default router;


