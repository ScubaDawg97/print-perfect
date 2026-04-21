import { kv } from "@vercel/kv";
import type { FilamentType, FilamentSuggestion } from "./filamentSchemas";
import { FilamentTypeSchema, FilamentSuggestionSchema } from "./filamentSchemas";
import { DEFAULT_FILAMENTS } from "./defaultFilaments";
import { isKvConfigured } from "./config";

/**
 * ─── Filament Store ───────────────────────────────────────────────────────────
 * KV-backed filament retrieval with in-memory 5-minute TTL caching.
 * Gracefully falls back to hardcoded defaults if KV is unavailable.
 *
 * KV Keys:
 * - filament:types → JSON array of FilamentType[]
 * - filament:suggestions → JSON array of FilamentSuggestion[]
 */

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const KV_TIMEOUT_MS = 3000; // 3 second timeout for KV reads

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

// In-memory cache
const cache = new Map<string, CacheEntry<any>>();

/**
 * Get cached data if valid, otherwise return null.
 */
function getFromCache<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

/**
 * Store data in cache with TTL.
 */
function setInCache<T>(key: string, data: T): void {
  cache.set(key, {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

/**
 * Clear all cache entries.
 */
export function invalidateCache(): void {
  cache.clear();
  if (process.env.NODE_ENV === "development") {
    console.log("[filamentStore] Cache invalidated");
  }
}

/**
 * Calculate TTL remaining for a cached entry (in milliseconds).
 */
function getCacheTtlRemaining(key: string): number {
  const entry = cache.get(key);
  if (!entry) return 0;
  const remaining = entry.expiresAt - Date.now();
  return remaining > 0 ? remaining : 0;
}

/**
 * Fetch filament types from KV or fallback to defaults.
 * If fresh=true, bypass cache and refetch from KV.
 */
export async function getFilaments(fresh = false): Promise<FilamentType[]> {
  const cacheKey = "filament:types:cache";

  // Check cache unless fresh requested
  if (!fresh) {
    const cached = getFromCache<FilamentType[]>(cacheKey);
    if (cached) return cached;
  }

  if (!isKvConfigured()) {
    setInCache(cacheKey, DEFAULT_FILAMENTS);
    return DEFAULT_FILAMENTS;
  }

  try {
    const kvData = await Promise.race([
      kv.get("filament:types"),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("KV timeout")), KV_TIMEOUT_MS)
      ),
    ]);

    if (!kvData) {
      // KV key doesn't exist yet — use defaults
      setInCache(cacheKey, DEFAULT_FILAMENTS);
      return DEFAULT_FILAMENTS;
    }

    // Validate fetched data
    const filaments = Array.isArray(kvData)
      ? kvData.filter((f) => FilamentTypeSchema.safeParse(f).success)
      : [];

    if (filaments.length === 0) {
      // Validation failed — use defaults
      setInCache(cacheKey, DEFAULT_FILAMENTS);
      return DEFAULT_FILAMENTS;
    }

    // Sort alphabetically by displayName
    filaments.sort((a, b) => a.displayName.localeCompare(b.displayName));

    setInCache(cacheKey, filaments);
    return filaments;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[getFilaments] KV error:", error);
    }
    // Sort defaults alphabetically too
    const sortedDefaults = [...DEFAULT_FILAMENTS].sort((a, b) =>
      a.displayName.localeCompare(b.displayName)
    );
    setInCache(cacheKey, sortedDefaults);
    return sortedDefaults;
  }
}

/**
 * Fetch filament suggestions from KV (no caching, always fresh).
 * Returns empty array if KV unavailable.
 */
export async function getFilamentSuggestions(): Promise<FilamentSuggestion[]> {
  if (!isKvConfigured()) {
    return [];
  }

  try {
    const kvData = await Promise.race([
      kv.get("filament:suggestions"),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("KV timeout")), KV_TIMEOUT_MS)
      ),
    ]);

    if (!kvData) {
      return [];
    }

    const suggestions = Array.isArray(kvData)
      ? kvData.filter((s) => FilamentSuggestionSchema.safeParse(s).success)
      : [];

    return suggestions;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[getFilamentSuggestions] KV error:", error);
    }
    return [];
  }
}

/**
 * Build a complete filament list response with metadata.
 */
export async function getAllFilaments(
  fresh = false
): Promise<{
  filaments: FilamentType[];
  cached: boolean;
  ttl: number;
  fetchedAt: string;
}> {
  const fetchedAt = new Date().toISOString();
  const filaments = await getFilaments(fresh);

  // Use filament cache TTL as the reference
  const filamentCacheTtl = getCacheTtlRemaining("filament:types:cache");

  return {
    filaments: filaments.filter((f) => f.active),
    cached: filamentCacheTtl > 0,
    ttl: Math.max(0, filamentCacheTtl),
    fetchedAt,
  };
}

/**
 * Check if filament data exists in KV (for initialization detection).
 */
export async function hasFilamentData(): Promise<boolean> {
  if (!isKvConfigured()) return false;

  try {
    const filaments = await kv.get("filament:types");
    return !!filaments;
  } catch {
    return false;
  }
}

/**
 * Initialize KV with default filament types if they don't exist or are incomplete.
 * Idempotent — safe to call multiple times.
 *
 * Will reinitialize if:
 * - No data exists, OR
 * - Data exists but has less than 10 filaments (corrupted/incomplete state)
 */
export async function initializeFilamentData(): Promise<void> {
  if (!isKvConfigured()) return;

  try {
    // Check if data already exists and is complete
    const kvData = await kv.get("filament:types");
    const isValid = Array.isArray(kvData) && kvData.length >= 10;

    if (isValid) {
      if (process.env.NODE_ENV === "development") {
        console.log("[filamentStore] Filament data valid in KV, skipping initialization");
      }
      return;
    }

    // Data is missing or incomplete — set defaults
    if (process.env.NODE_ENV === "development") {
      console.log(
        `[filamentStore] Initializing KV (${kvData ? `${kvData.length} items found` : "no data"})`
      );
    }

    await Promise.all([
      kv.set("filament:types", DEFAULT_FILAMENTS),
      kv.set("filament:suggestions", []),
    ]);

    if (process.env.NODE_ENV === "development") {
      console.log("[filamentStore] Initialized KV with default filament data");
    }

    // Clear cache to force refetch
    invalidateCache();
  } catch (error) {
    console.error("[initializeFilamentData] Failed:", error);
    // Silently fail — defaults will be used
  }
}
