import { kv } from "@vercel/kv";
import type {
  EquipmentPrinter,
  EquipmentSurface,
  EquipmentNozzle,
  EquipmentSuggestion,
  EquipmentListResponse,
} from "./equipmentSchemas";
import {
  EquipmentPrinterSchema,
  EquipmentSurfaceSchema,
  EquipmentNozzleSchema,
  EquipmentSuggestionSchema,
} from "./equipmentSchemas";
import {
  DEFAULT_PRINTERS,
  DEFAULT_SURFACES,
  DEFAULT_NOZZLES,
} from "./defaultEquipment";
import { isKvConfigured } from "./config";

/**
 * ─── Equipment Store ──────────────────────────────────────────────────────────
 * KV-backed equipment retrieval with in-memory 5-minute TTL caching.
 * Gracefully falls back to hardcoded defaults if KV is unavailable.
 *
 * KV Keys:
 * - equipment:printers → JSON array of EquipmentPrinter[]
 * - equipment:surfaces → JSON array of EquipmentSurface[]
 * - equipment:nozzles → JSON array of EquipmentNozzle[]
 * - equipment:suggestions → JSON array of EquipmentSuggestion[]
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
    console.log("[equipmentStore] Cache invalidated");
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
 * Fetch printers from KV or fallback to defaults.
 * If fresh=true, bypass cache and refetch from KV.
 */
export async function getPrinters(fresh = false): Promise<EquipmentPrinter[]> {
  const cacheKey = "equipment:printers:cache";

  // Check cache unless fresh requested
  if (!fresh) {
    const cached = getFromCache<EquipmentPrinter[]>(cacheKey);
    if (cached) return cached;
  }

  if (!isKvConfigured()) {
    setInCache(cacheKey, DEFAULT_PRINTERS);
    return DEFAULT_PRINTERS;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), KV_TIMEOUT_MS);

    const kvData = await Promise.race([
      kv.get("equipment:printers"),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("KV timeout")), KV_TIMEOUT_MS)
      ),
    ]);

    clearTimeout(timeoutId);

    if (!kvData) {
      // KV key doesn't exist yet — use defaults
      setInCache(cacheKey, DEFAULT_PRINTERS);
      return DEFAULT_PRINTERS;
    }

    // Validate fetched data
    const printers = Array.isArray(kvData)
      ? kvData.filter((p) => EquipmentPrinterSchema.safeParse(p).success)
      : [];

    if (printers.length === 0) {
      // Validation failed — use defaults
      setInCache(cacheKey, DEFAULT_PRINTERS);
      return DEFAULT_PRINTERS;
    }

    setInCache(cacheKey, printers);
    return printers;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[getPrinters] KV error:", error);
    }
    setInCache(cacheKey, DEFAULT_PRINTERS);
    return DEFAULT_PRINTERS;
  }
}

/**
 * Fetch surfaces from KV or fallback to defaults.
 * If fresh=true, bypass cache and refetch from KV.
 */
export async function getSurfaces(fresh = false): Promise<EquipmentSurface[]> {
  const cacheKey = "equipment:surfaces:cache";

  if (!fresh) {
    const cached = getFromCache<EquipmentSurface[]>(cacheKey);
    if (cached) return cached;
  }

  if (!isKvConfigured()) {
    setInCache(cacheKey, DEFAULT_SURFACES);
    return DEFAULT_SURFACES;
  }

  try {
    const kvData = await Promise.race([
      kv.get("equipment:surfaces"),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("KV timeout")), KV_TIMEOUT_MS)
      ),
    ]);

    if (!kvData) {
      setInCache(cacheKey, DEFAULT_SURFACES);
      return DEFAULT_SURFACES;
    }

    const surfaces = Array.isArray(kvData)
      ? kvData.filter((s) => EquipmentSurfaceSchema.safeParse(s).success)
      : [];

    if (surfaces.length === 0) {
      setInCache(cacheKey, DEFAULT_SURFACES);
      return DEFAULT_SURFACES;
    }

    setInCache(cacheKey, surfaces);
    return surfaces;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[getSurfaces] KV error:", error);
    }
    setInCache(cacheKey, DEFAULT_SURFACES);
    return DEFAULT_SURFACES;
  }
}

/**
 * Fetch nozzles from KV or fallback to defaults.
 * If fresh=true, bypass cache and refetch from KV.
 */
export async function getNozzles(fresh = false): Promise<EquipmentNozzle[]> {
  const cacheKey = "equipment:nozzles:cache";

  if (!fresh) {
    const cached = getFromCache<EquipmentNozzle[]>(cacheKey);
    if (cached) return cached;
  }

  if (!isKvConfigured()) {
    setInCache(cacheKey, DEFAULT_NOZZLES);
    return DEFAULT_NOZZLES;
  }

  try {
    const kvData = await Promise.race([
      kv.get("equipment:nozzles"),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("KV timeout")), KV_TIMEOUT_MS)
      ),
    ]);

    if (!kvData) {
      setInCache(cacheKey, DEFAULT_NOZZLES);
      return DEFAULT_NOZZLES;
    }

    const nozzles = Array.isArray(kvData)
      ? kvData.filter((n) => EquipmentNozzleSchema.safeParse(n).success)
      : [];

    if (nozzles.length === 0) {
      setInCache(cacheKey, DEFAULT_NOZZLES);
      return DEFAULT_NOZZLES;
    }

    setInCache(cacheKey, nozzles);
    return nozzles;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[getNozzles] KV error:", error);
    }
    setInCache(cacheKey, DEFAULT_NOZZLES);
    return DEFAULT_NOZZLES;
  }
}

/**
 * Fetch suggestions from KV (no caching, always fresh).
 * Returns empty array if KV unavailable.
 */
export async function getSuggestions(): Promise<EquipmentSuggestion[]> {
  if (!isKvConfigured()) {
    return [];
  }

  try {
    const kvData = await Promise.race([
      kv.get("equipment:suggestions"),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("KV timeout")), KV_TIMEOUT_MS)
      ),
    ]);

    if (!kvData) {
      return [];
    }

    const suggestions = Array.isArray(kvData)
      ? kvData.filter((s) => EquipmentSuggestionSchema.safeParse(s).success)
      : [];

    return suggestions;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[getSuggestions] KV error:", error);
    }
    return [];
  }
}

/**
 * Build a complete EquipmentListResponse with all equipment types and metadata.
 */
export async function getAllEquipment(
  fresh = false
): Promise<EquipmentListResponse> {
  const fetchedAt = new Date().toISOString();

  const [printers, surfaces, nozzles] = await Promise.all([
    getPrinters(fresh),
    getSurfaces(fresh),
    getNozzles(fresh),
  ]);

  // Use printer cache TTL as the reference for overall TTL
  const printCacheTtl = getCacheTtlRemaining("equipment:printers:cache");

  return {
    printers: printers.filter((p) => p.active),
    surfaces: surfaces.filter((s) => s.active),
    nozzles: nozzles.filter((n) => n.active),
    cached: printCacheTtl > 0,
    ttl: Math.max(0, printCacheTtl),
    fetchedAt,
  };
}

/**
 * Get a single equipment type (for API filtering).
 */
export async function getEquipmentByType(
  type: "printers" | "surfaces" | "nozzles",
  fresh = false
): Promise<EquipmentPrinter[] | EquipmentSurface[] | EquipmentNozzle[]> {
  if (type === "printers") return getPrinters(fresh);
  if (type === "surfaces") return getSurfaces(fresh);
  if (type === "nozzles") return getNozzles(fresh);
  return [];
}

/**
 * Check if any equipment lists exist in KV (for initialization detection).
 */
export async function hasEquipmentData(): Promise<boolean> {
  if (!isKvConfigured()) return false;

  try {
    const [printers, surfaces, nozzles] = await Promise.all([
      kv.get("equipment:printers"),
      kv.get("equipment:surfaces"),
      kv.get("equipment:nozzles"),
    ]);

    return !!printers && !!surfaces && !!nozzles;
  } catch {
    return false;
  }
}

/**
 * Initialize KV with default equipment lists if they don't exist.
 * Idempotent — safe to call multiple times.
 */
export async function initializeEquipmentData(): Promise<void> {
  if (!isKvConfigured()) return;

  try {
    // Check if data already exists
    const exists = await hasEquipmentData();
    if (exists) {
      if (process.env.NODE_ENV === "development") {
        console.log("[equipmentStore] Equipment data already exists in KV");
      }
      return;
    }

    // Set default data
    await Promise.all([
      kv.set("equipment:printers", DEFAULT_PRINTERS),
      kv.set("equipment:surfaces", DEFAULT_SURFACES),
      kv.set("equipment:nozzles", DEFAULT_NOZZLES),
      kv.set("equipment:suggestions", []),
    ]);

    if (process.env.NODE_ENV === "development") {
      console.log("[equipmentStore] Initialized KV with default equipment data");
    }

    // Clear cache to force refetch
    invalidateCache();
  } catch (error) {
    console.error("[initializeEquipmentData] Failed:", error);
    // Silently fail — defaults will be used
  }
}
