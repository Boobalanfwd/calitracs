// Shared input-validation helpers — Phase 6 (Data Integrity & Validation).

const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const DATE_KEY_MIN_YEAR = 2000;
export const DATE_KEY_MAX_YEAR = 2100;

/**
 * Real calendar validation for YYYY-MM-DD date keys.
 * Rejects impossible dates like "2025-99-99" or "2025-02-31" that a plain
 * regex check would happily accept.
 */
export function isValidDateKey(value: string): boolean {
  if (typeof value !== 'string' || !DATE_KEY_REGEX.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < DATE_KEY_MIN_YEAR || year > DATE_KEY_MAX_YEAR) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  // Round-trip parse in UTC so local timezones can't shift the result.
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Coerce an unknown value to a finite number clamped into [min, max]. */
export function sanitizeNumber(
  value: unknown,
  min: number,
  max: number,
  fallback?: number
): number | null {
  const n = isFiniteNumber(value) ? value : NaN;
  if (Number.isNaN(n)) return fallback ?? null;
  return Math.min(max, Math.max(min, n));
}

/** Coerce & clamp a possibly-malformed external number (NaN/Infinity/garbage). */
export function sanitizeNutrition(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
  precision: number = 0
): number {
  let n = Number(value);
  if (!Number.isFinite(n)) n = fallback;
  n = Math.min(max, Math.max(min, n));
  const factor = Math.pow(10, precision);
  return Math.round(n * factor) / factor;
}

export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** True when the string is a valid IANA timezone id (e.g. "Asia/Kolkata"). */
export function isValidTimezone(value: unknown): boolean {
  if (typeof value !== 'string' || value.length === 0 || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

// ── Domain caps (mirror & harden the schema bounds in controllers) ────────────

export const ENTRY_LIMITS = {
  calories: { min: 0, max: 100_000 },
  macroG: { min: 0, max: 10_000 },
  weightGramsOrMl: { min: 1, max: 100_000 },
  portionQuantity: { min: 0.1, max: 1_000 },
  portionG: { min: 1, max: 100_000 },
  nameLen: 200,
  portionDescriptionLen: 300,
  imageUrlLen: 500,
} as const;

export const WATER_LIMITS = {
  amountMl: { min: 0, max: 100_000 },
} as const;
