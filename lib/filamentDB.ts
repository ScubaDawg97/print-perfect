// ─── Open Filament Database integration ──────────────────────────────────────
// API base: https://api.openfilamentdatabase.org/api/v1/
// Docs:     https://openfilamentdatabase.org
//
// Strategy:
//   1. Fetch the full brand list from /brands/index.json once per session (cached).
//   2. Fuzzy-match the user's typed brand name to find the correct brand slug.
//   3. Fetch material data from /brands/{slug}/materials/{material}/index.json.
//
// Every failure path returns null — the UI hides the preview panel silently.

import type { FilamentDBResult } from "./types";
export type { FilamentDBResult };

const API_BASE   = "https://api.openfilamentdatabase.org/api/v1";
const TIMEOUT_MS = 5000;

// ── Brand cache (module-level — lives for the browser session) ────────────────

export interface BrandEntry {
  name: string;
  slug: string;
}

let brandsCache: BrandEntry[] | null = null;

// ── Helpers ───────────────────────────────────────────────────────────────────

function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

function toSlug(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// Words stripped when normalizing brand names for fuzzy comparison
const STOP_WORDS = new Set([
  "lab", "labs", "filament", "filaments", "3d", "inc", "llc", "co", "tech",
]);

function normalizeName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")      // strip punctuation
    .split(/\s+/)
    .filter((w) => w.length > 0 && !STOP_WORDS.has(w))
    .join(" ")
    .trim();
}

// ── Brand list fetch ──────────────────────────────────────────────────────────

/**
 * Fetches and caches the complete OFD brand list for the session.
 * Safe to call speculatively on mount — returns [] on any error.
 */
export async function fetchBrandList(): Promise<BrandEntry[]> {
  if (brandsCache) return brandsCache;
  try {
    const res = await fetchWithTimeout(`${API_BASE}/brands/index.json`);
    if (!res.ok) return [];
    const data = await res.json();
    const items: unknown[] = Array.isArray(data) ? data : [];
    const brands: BrandEntry[] = items
      .map((item) => {
        if (typeof item === "string") {
          return { name: item, slug: toSlug(item) };
        }
        const obj  = item as Record<string, unknown>;
        const name = String(obj.name ?? obj.brand_name ?? "").trim();
        const slug = String(obj.slug ?? obj.brand_slug ?? toSlug(name)).trim();
        return name ? { name, slug } : null;
      })
      .filter((b): b is BrandEntry => b !== null && b.name.length > 0);
    brandsCache = brands;
    return brands;
  } catch {
    return [];
  }
}

// ── Fuzzy brand matching ──────────────────────────────────────────────────────

/**
 * Scores each known brand against the user's input and returns the best slug.
 * Scoring:
 *   100 — exact match after normalization
 *    80 — input is contained within brand name (or slug)
 *    70 — brand name is contained within input
 *    60 — first word matches
 * Returns null if nothing scores ≥ 60.
 */
export function findBestBrandSlug(input: string, brands: BrandEntry[]): string | null {
  if (!input.trim() || brands.length === 0) return null;
  const normInput = normalizeName(input);
  if (!normInput) return null;

  let bestSlug:  string | null = null;
  let bestScore: number        = 0;

  for (const brand of brands) {
    const normName = normalizeName(brand.name);
    const normSlug = brand.slug.replace(/-/g, " ");

    let score = 0;
    if (normInput === normName || normInput === normSlug) {
      score = 100;
    } else if (normName.includes(normInput) || normSlug.includes(normInput)) {
      score = 80;
    } else if (normInput.includes(normName) && normName.length > 2) {
      score = 70;
    } else {
      const firstIn   = normInput.split(" ")[0];
      const firstName = normName.split(" ")[0];
      if (firstIn && firstName && firstIn === firstName && firstIn.length > 2) {
        score = 60;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestSlug  = brand.slug;
    }
  }

  return bestScore >= 60 ? bestSlug : null;
}

// ── Material slug map ─────────────────────────────────────────────────────────
// Maps our internal filament type values to OFD material slug strings.
// null means "not in OFD — skip lookup entirely".

export const MATERIAL_SLUG_MAP: Record<string, string | null> = {
  "PLA":      "pla",
  "PLA+":     "pla",
  "PLA Silk": "silk",
  "PLA-CF":   "pla-cf",
  "PETG":     "petg",
  "PETG-CF":  "petg-cf",
  "ABS":      "abs",
  "ASA":      "asa",
  "TPU":      "tpu",
  "Nylon":    "nylon",
  "PC":       "pc",
  "Resin":    null,  // Resin not in OFD — skip lookup
};

// ── Slug-based filament fetch ─────────────────────────────────────────────────

/**
 * Fetches filament data directly by brand slug + material slug.
 * Exported for direct use in tests or direct slug lookups.
 */
export async function queryFilamentBySlug(
  brandSlug:    string,
  materialSlug: string,
): Promise<FilamentDBResult | null> {
  try {
    const url = `${API_BASE}/brands/${brandSlug}/materials/${materialSlug}/index.json`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return null;
    const data = await res.json();

    // Response may be { filaments: [...] }, a bare array, or a single object
    let items: unknown[];
    if (Array.isArray(data)) {
      items = data;
    } else if (Array.isArray((data as Record<string, unknown>).filaments)) {
      items = (data as Record<string, unknown>).filaments as unknown[];
    } else {
      items = [data];
    }

    if (items.length === 0) return null;
    const raw = items[0] as Record<string, unknown>;

    // Temperature fields — try multiple likely key names defensively
    const printTempMin = Number(
      raw.print_temp_min ?? raw.printTempMin ?? raw.min_print_temp ?? raw.print_temp ?? 0,
    );
    const printTempMax = Number(
      raw.print_temp_max ?? raw.printTempMax ?? raw.max_print_temp ?? raw.print_temp ?? 0,
    );
    const bedTempMin = Number(
      raw.bed_temp_min ?? raw.bedTempMin ?? raw.min_bed_temp ?? raw.bed_temp ?? 0,
    );
    const bedTempMax = Number(
      raw.bed_temp_max ?? raw.bedTempMax ?? raw.max_bed_temp ?? raw.bed_temp ?? 0,
    );

    // If there's no temperature data at all this result is useless
    if (!printTempMin && !printTempMax) return null;

    const name         = String(raw.name ?? raw.product_name ?? "").trim();
    const manufacturer = String(raw.manufacturer ?? raw.brand ?? brandSlug).trim();
    const mat          = String(raw.material ?? materialSlug).trim();
    const id           = String(raw.id ?? raw.uuid ?? raw.slug ?? "").trim();
    const dataUrl      = id
      ? `https://openfilamentdatabase.org/filaments/${id}`
      : `https://openfilamentdatabase.org`;

    // Optional extended fields
    const rawDiameter = raw.diameter ?? raw.filament_diameter;
    const diameter    =
      typeof rawDiameter === "number" && rawDiameter > 0 && rawDiameter < 5
        ? rawDiameter : undefined;

    const rawDensity = raw.density ?? raw.material_density ?? raw.specific_gravity;
    const density    =
      typeof rawDensity === "number" && rawDensity > 0 ? rawDensity : undefined;

    const rawColor = raw.color_name ?? raw.color ?? raw.colour ?? raw.color_label;
    const color    =
      typeof rawColor === "string" && rawColor.trim() ? rawColor.trim() : undefined;

    const rawFinish = raw.finish ?? raw.finish_type ?? raw.surface_finish ?? raw.type_detail;
    const finish    =
      typeof rawFinish === "string" && rawFinish.trim() ? rawFinish.trim() : undefined;

    // Boolean property flags
    const FLAG_KEYS = [
      "food_safe", "abrasive", "flexible", "soluble",
      "conductive", "glow_in_dark", "uv_resistant",
    ];
    const tags: string[] = FLAG_KEYS
      .filter((k) => raw[k] === true || raw[k] === 1 || raw[k] === "true")
      .map((k) => k.replace(/_/g, " "));

    return {
      name,
      manufacturer,
      material: mat,
      printTempMin,
      printTempMax,
      bedTempMin,
      bedTempMax,
      dataUrl,
      ...(diameter !== undefined && { diameter }),
      ...(density  !== undefined && { density }),
      ...(color    !== undefined && { color }),
      ...(finish   !== undefined && { finish }),
      ...(tags.length > 0       && { tags }),
    };
  } catch {
    return null;
  }
}

// ── High-level query (primary API for InputForm) ──────────────────────────────

/**
 * Full pipeline: raw brand name → fuzzy match → brand slug → fetch material data.
 * Returns null silently on any failure (no match, network error, API error, timeout).
 */
export async function queryFilament(
  brand:    string,
  material: string,
): Promise<FilamentDBResult | null> {
  if (!brand.trim() || !material.trim()) return null;

  const materialSlug = MATERIAL_SLUG_MAP[material];
  if (materialSlug === null) return null;  // Resin — intentionally skipped
  if (!materialSlug)         return null;  // Unknown material type

  try {
    const brands    = await fetchBrandList();
    const brandSlug = findBestBrandSlug(brand, brands);
    if (!brandSlug) return null;
    return await queryFilamentBySlug(brandSlug, materialSlug);
  } catch {
    return null;
  }
}
