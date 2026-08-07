import multer, { FileFilterCallback } from 'multer';
import { Request } from 'express';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const MAX_SIZE_MB = 10;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

// Reused by the base64 upload paths (which bypass multer) so the same whitelist
// applies regardless of how the image arrives.
export const isAllowedImageMime = (mimeType: string): boolean =>
  ALLOWED_MIME_TYPES.includes(mimeType);

// Store in memory so we can send to Gemini as base64
const storage = multer.memoryStorage();

const fileFilter = (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported image format. Please use JPEG, PNG, WEBP, HEIC, or HEIF.`));
  }
};

export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_SIZE_BYTES,
  },
});
