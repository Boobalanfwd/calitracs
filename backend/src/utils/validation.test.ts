import { describe, it, expect } from 'vitest';
import {
  isValidDateKey,
  isFiniteNumber,
  sanitizeNumber,
  sanitizeNutrition,
  clampNumber,
  isValidTimezone,
  ENTRY_LIMITS,
  WATER_LIMITS,
} from './validation';

describe('isValidDateKey', () => {
  it('accepts real dates', () => {
    expect(isValidDateKey('2025-01-01')).toBe(true);
    expect(isValidDateKey('2024-02-29')).toBe(true); // leap year
    expect(isValidDateKey('2000-12-31')).toBe(true);
  });

  it('rejects impossible calendar dates', () => {
    expect(isValidDateKey('2025-02-31')).toBe(false);
    expect(isValidDateKey('2025-99-99')).toBe(false);
    expect(isValidDateKey('2025-13-01')).toBe(false);
    expect(isValidDateKey('2025-00-10')).toBe(false);
    expect(isValidDateKey('2025-01-00')).toBe(false);
  });

  it('rejects non-leap-year Feb 29', () => {
    expect(isValidDateKey('2025-02-29')).toBe(false);
  });

  it('rejects malformed strings and non-strings', () => {
    expect(isValidDateKey('2025/01/01')).toBe(false);
    expect(isValidDateKey('2025-1-1')).toBe(false);
    expect(isValidDateKey('abcdefgh')).toBe(false);
    expect(isValidDateKey('')).toBe(false);
    expect(isValidDateKey(null as unknown as string)).toBe(false);
    expect(isValidDateKey(20250101 as unknown as string)).toBe(false);
  });

  it('enforces the 2000–2100 year window', () => {
    expect(isValidDateKey('1999-12-31')).toBe(false);
    expect(isValidDateKey('2101-01-01')).toBe(false);
    expect(isValidDateKey('2000-01-01')).toBe(true);
    expect(isValidDateKey('2100-12-31')).toBe(true);
  });
});

describe('isFiniteNumber', () => {
  it('only accepts finite numbers', () => {
    expect(isFiniteNumber(0)).toBe(true);
    expect(isFiniteNumber(-5)).toBe(true);
    expect(isFiniteNumber(1.5)).toBe(true);
    expect(isFiniteNumber(NaN)).toBe(false);
    expect(isFiniteNumber(Infinity)).toBe(false);
    expect(isFiniteNumber(-Infinity)).toBe(false);
    expect(isFiniteNumber('5')).toBe(false);
    expect(isFiniteNumber(null)).toBe(false);
    expect(isFiniteNumber(undefined)).toBe(false);
  });
});

describe('sanitizeNumber', () => {
  it('clamps into [min, max]', () => {
    expect(sanitizeNumber(500, 0, 100)).toBe(100);
    expect(sanitizeNumber(-10, 0, 100)).toBe(0);
    expect(sanitizeNumber(42, 0, 100)).toBe(42);
  });

  it('returns fallback for non-numbers', () => {
    expect(sanitizeNumber('x', 0, 100, 5)).toBe(5);
    expect(sanitizeNumber(NaN, 0, 100, 5)).toBe(5);
  });

  it('returns null when no fallback given', () => {
    expect(sanitizeNumber('x', 0, 100)).toBeNull();
    expect(sanitizeNumber(NaN, 0, 100)).toBeNull();
  });
});

describe('sanitizeNutrition', () => {
  it('coerces garbage to the fallback', () => {
    expect(sanitizeNutrition(NaN, 10, 0, 100)).toBe(10);
    expect(sanitizeNutrition(Infinity, 10, 0, 100)).toBe(10);
    expect(sanitizeNutrition('abc', 10, 0, 100)).toBe(10);
    expect(sanitizeNutrition(undefined as unknown as number, 10, 0, 100)).toBe(10);
  });

  it('clamps valid numbers', () => {
    expect(sanitizeNutrition(500, 10, 0, 100)).toBe(100);
    expect(sanitizeNutrition(-5, 10, 0, 100)).toBe(0);
  });

  it('rounds to the given precision', () => {
    expect(sanitizeNutrition(12.345, 10, 0, 1000, 2)).toBe(12.35);
    expect(sanitizeNutrition(12.345, 10, 0, 1000, 0)).toBe(12);
  });
});

describe('clampNumber', () => {
  it('clamps both sides', () => {
    expect(clampNumber(150, 0, 100)).toBe(100);
    expect(clampNumber(-1, 0, 100)).toBe(0);
    expect(clampNumber(50, 0, 100)).toBe(50);
  });
});

describe('isValidTimezone', () => {
  it('accepts IANA timezones', () => {
    expect(isValidTimezone('Asia/Kolkata')).toBe(true);
    expect(isValidTimezone('America/New_York')).toBe(true);
    expect(isValidTimezone('UTC')).toBe(true);
  });

  it('rejects invalid timezones and non-strings', () => {
    expect(isValidTimezone('Not/A_Zone')).toBe(false);
    expect(isValidTimezone('')).toBe(false);
    expect(isValidTimezone(123 as unknown as string)).toBe(false);
    expect(isValidTimezone(undefined)).toBe(false);
  });
});

describe('domain limits', () => {
  it('exposes the documented bounds', () => {
    expect(ENTRY_LIMITS.calories.max).toBe(100_000);
    expect(ENTRY_LIMITS.macroG.max).toBe(10_000);
    expect(ENTRY_LIMITS.portionQuantity.min).toBe(0.1);
    expect(WATER_LIMITS.amountMl.max).toBe(100_000);
  });
});
