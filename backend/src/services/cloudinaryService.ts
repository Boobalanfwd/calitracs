import crypto from 'crypto';
import { withRetry } from '../utils/retry';

const CLOUDINARY_TIMEOUT_MS = 15_000;

/**
 * Cloudinary folder structure for FoodLens AI
 * All assets live under the "foodlens" namespace for easy management.
 *
 * foodlens/
 *   profiles/        - User profile avatars
 *   food_logs/       - AI-scanned food photos attached to diary entries
 *   food_labels/     - Nutrition label OCR images
 *   food_analysis/   - General food-recognition analysis photos
 */
export const CLOUDINARY_FOLDERS = {
  /** User profile pictures / avatars */
  PROFILES: 'foodlens/profiles',
  /** Food photos attached to food log diary entries */
  FOOD_LOGS: 'foodlens/food_logs',
  /** Nutrition label OCR scan images */
  FOOD_LABELS: 'foodlens/food_labels',
  /** Raw AI food recognition analysis photos */
  FOOD_ANALYSIS: 'foodlens/food_analysis',
} as const;

interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  bytes: number;
  format: string;
  folder: string;
}

/** Read & trim Cloudinary credentials from .env */
const getCredentials = () => {
  const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || '').trim();
  const apiKey = (process.env.CLOUDINARY_API_KEY || '').trim();
  // Supports CLOUDINARY_SECRET (legacy) or CLOUDINARY_API_SECRET
  const apiSecret = (
    process.env.CLOUDINARY_API_SECRET ||
    process.env.CLOUDINARY_SECRET ||
    ''
  ).trim();
  return { cloudName, apiKey, apiSecret };
};

/**
 * Core upload helper — sends a buffer to a specific Cloudinary folder.
 * Uses HMAC-SHA1 signed upload (no unsigned preset required).
 */
const uploadBuffer = async (
  imageBuffer: Buffer,
  folder: string,
  mimeType: string = 'image/jpeg'
): Promise<string | null> => {
  const { cloudName, apiKey, apiSecret } = getCredentials();

  if (!cloudName || !apiKey || !apiSecret) {
    console.warn(
      '[Cloudinary] Missing credentials (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_SECRET). Skipping upload.'
    );
    return null;
  }

  const timestamp = Math.floor(Date.now() / 1000);
  // Signature must match exactly: sorted params + secret (no leading/trailing spaces)
  const signatureStr = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash('sha1').update(signatureStr).digest('hex');

  const base64Image = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;

  const formData = new URLSearchParams();
  formData.append('file', base64Image);
  formData.append('api_key', apiKey);
  formData.append('timestamp', timestamp.toString());
  formData.append('signature', signature);
  formData.append('folder', folder);

  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
  console.log(
    `[Cloudinary] ⬆️  Uploading to folder "${folder}" (${Math.round(imageBuffer.length / 1024)}KB)...`
  );

  try {
    const res = await withRetry(
      () => fetch(uploadUrl, { method: 'POST', body: formData, signal: AbortSignal.timeout(CLOUDINARY_TIMEOUT_MS) }),
      {
        retries: 2,
        onRetry: (err, attempt) =>
          console.warn(`[Cloudinary] Upload attempt ${attempt} failed, retrying...`, (err as Error).message),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[Cloudinary] ❌ Upload failed for folder "${folder}":`, errText);
      return null;
    }

    const data = (await res.json()) as CloudinaryUploadResult;
    console.log(`[Cloudinary] ✅ Uploaded to "${folder}": ${data.secure_url}`);
    return data.secure_url;
  } catch (err: any) {
    console.error('[Cloudinary] Upload error:', err.message || err);
    return null;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Public upload functions — one per image category
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Upload a **user profile avatar** → foodlens/profiles/
 */
export const uploadProfileImage = async (
  imageBuffer: Buffer,
  mimeType: string = 'image/jpeg'
): Promise<string | null> =>
  uploadBuffer(imageBuffer, CLOUDINARY_FOLDERS.PROFILES, mimeType);

/**
 * Upload a **food log entry photo** (attached to a diary entry when logging food)
 * → foodlens/food_logs/
 */
export const uploadFoodLogImage = async (
  imageBuffer: Buffer,
  mimeType: string = 'image/jpeg'
): Promise<string | null> =>
  uploadBuffer(imageBuffer, CLOUDINARY_FOLDERS.FOOD_LOGS, mimeType);

/**
 * Upload a **nutrition label OCR image** (from the label scanner)
 * → foodlens/food_labels/
 */
export const uploadFoodLabelImage = async (
  imageBuffer: Buffer,
  mimeType: string = 'image/jpeg'
): Promise<string | null> =>
  uploadBuffer(imageBuffer, CLOUDINARY_FOLDERS.FOOD_LABELS, mimeType);

/**
 * Upload a **general food analysis photo** (raw AI recognition, not attached to a log entry)
 * → foodlens/food_analysis/
 */
export const uploadFoodAnalysisImage = async (
  imageBuffer: Buffer,
  mimeType: string = 'image/jpeg'
): Promise<string | null> =>
  uploadBuffer(imageBuffer, CLOUDINARY_FOLDERS.FOOD_ANALYSIS, mimeType);

/**
 * Generic upload — use a specific function above instead.
 * @deprecated Use uploadFoodLogImage, uploadProfileImage, etc.
 */
export const uploadToCloudinary = async (
  imageBuffer: Buffer,
  folder: string = CLOUDINARY_FOLDERS.FOOD_LOGS,
  mimeType: string = 'image/jpeg'
): Promise<string | null> => uploadBuffer(imageBuffer, folder, mimeType);
