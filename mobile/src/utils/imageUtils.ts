import { Image } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';

// Cap the longest edge so AI analysis + Cloudinary uploads stay small.
const MAX_IMAGE_EDGE = 1280;
const JPEG_QUALITY = 0.7;

export interface PreparedImage {
  uri: string;
  base64?: string;
}

/**
 * Rewrite a Cloudinary `secure_url` to serve a client-side resized, auto-compressed
 * variant (e.g. a 48px thumbnail instead of the full 1280px original). Any
 * non-Cloudinary URL (Unsplash fallbacks, etc.) is returned untouched.
 */
export const getResizedCloudinaryUrl = (
  url: string | null | undefined,
  width: number
): string | null => {
  if (!url) return null;
  const marker = '/image/upload/';
  const idx = url.indexOf(marker);
  if (idx === -1) return url;
  const head = url.slice(0, idx + marker.length);
  const rest = url.slice(idx + marker.length);
  // c_limit = never upscale beyond the original; q_auto = smart compression.
  return `${head}w_${width},q_auto,c_limit/${rest}`;
};

const getImageSize = (uri: string): Promise<{ width: number; height: number }> =>
  new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (err) => reject(err)
    );
  });

/**
 * Downscale a captured/picked image to a bounded JPEG before it is sent to the
 * backend (analyze, upload, label OCR). Returns the resized file URI plus a
 * base64 payload produced from the small image. Falls back to the original on
 * any failure so capture never breaks.
 */
export const prepareImageForAnalysis = async (
  uri: string,
  existingBase64?: string
): Promise<PreparedImage> => {
  try {
    const size = await getImageSize(uri);
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(size.width, size.height));
    const width = Math.max(1, Math.round(size.width * scale));
    const height = Math.max(1, Math.round(size.height * scale));

    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width, height } }],
      {
        compress: JPEG_QUALITY,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      }
    );

    return {
      uri: result.uri,
      base64: result.base64 || existingBase64,
    };
  } catch (err) {
    console.warn('[ImageUtils] Resize failed, using original image:', err);
    return { uri, base64: existingBase64 };
  }
};
