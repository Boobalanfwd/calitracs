/**
 * In-memory nutrition lookup cache.
 * Avoids redundant external API calls for foods already looked up
 * during the current server session.
 *
 * Keys are lowercased + trimmed food names.
 * Entries live for the process lifetime (cleared on server restart).
 */

import { NutritionResult } from './nutritionService';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CacheEntry {
  result: NutritionResult;
  cachedAt: number; // ms timestamp
}

// ── Store ──────────────────────────────────────────────────────────────────────

const MAX_ENTRIES = 500; // prevent unbounded growth
const cache = new Map<string, CacheEntry>();

// ── Helpers ───────────────────────────────────────────────────────────────────

function normaliseKey(foodName: string): string {
  return foodName.toLowerCase().trim().replace(/\s+/g, ' ');
}

// Evict oldest entry when the map is full
function evictOldest(): void {
  const oldestKey = cache.keys().next().value;
  if (oldestKey !== undefined) {
    cache.delete(oldestKey);
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Retrieve a cached NutritionResult for a food name.
 * Returns `null` if not found.
 */
export function getCached(foodName: string): NutritionResult | null {
  const key = normaliseKey(foodName);
  const entry = cache.get(key);
  if (!entry) return null;
  console.log(`[NutritionCache] HIT for "${foodName}" (source: ${entry.result.source})`);
  return entry.result;
}

/**
 * Store a NutritionResult in the cache for future lookups.
 */
export function setCached(foodName: string, result: NutritionResult): void {
  const key = normaliseKey(foodName);
  if (cache.size >= MAX_ENTRIES) evictOldest();
  cache.set(key, { result, cachedAt: Date.now() });
}

/**
 * Returns the current number of cached entries (for diagnostics).
 */
export function cacheSize(): number {
  return cache.size;
}

/**
 * Clear the entire cache (useful for testing).
 */
export function clearCache(): void {
  cache.clear();
}
