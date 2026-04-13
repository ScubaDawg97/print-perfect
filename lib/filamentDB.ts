// Open Filament Database integration
// API base: https://api.openfilamentdatabase.org/api/v1/
// Docs: https://openfilamentdatabase.org

import type { FilamentDBResult } from "./types";

export type { FilamentDBResult };

const API_BASE = "https://api.openfilamentdatabase.org/api/v1";
const TIMEOUT_MS = 5000;

// Session-level brand cache (cleared on page reload)
let brandsCache: string[] | null = null;

function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

export async function fetchBrands(): Promise<string[]> {
  if (brandsCache) return brandsCache;
  try {
    const res = await fetchWithTimeout(`${API_BASE}/manufacturers`);
    if (!res.ok) return [];
    const data = await res.json();
    // API returns array of manufacturer objects or strings — handle both shapes
    const brands: string[] = Array.isArray(data)
      ? data.map((item: unknown) =>
          typeof item === "string" ? item : (item as { name?: string }).name ?? ""
        ).filter(Boolean)
      : [];
    brandsCache = brands;
    return brands;
  } catch {
    return [];
  }
}

// Map internal filament type names to the OFD API material filter strings
const MATERIAL_QUERY_MAP: Record<string, string> = {
  "PLA Silk": "silk",
  "PLA-CF":   "pla-cf",
  "PETG-CF":  "petg-cf",
};

export async function queryFilament(
  brand: string,
  material: string
): Promise<FilamentDBResult | null> {
  if (!brand.trim() || !material.trim()) return null;
  // Translate internal type names to OFD-friendly query strings where needed
  const materialQuery = MATERIAL_QUERY_MAP[material] ?? material;
  try {
    const params = new URLSearchParams({
      manufacturer: brand.trim(),
      material: materialQuery,
    });
    const res = await fetchWithTimeout(`${API_BASE}/filaments?${params}`);
    if (!res.ok) return null;
    const data = await res.json();

    // Expect array; pick first result
    const items: unknown[] = Array.isArray(data) ? data : (data as { data?: unknown[] }).data ?? [];
    if (items.length === 0) return null;

    const raw = items[0] as Record<string, unknown>;

    // Field names vary in the API — try multiple likely keys
    const printTempMin =
      Number(raw.print_temp_min ?? raw.printTempMin ?? raw.min_print_temp ?? raw.print_temp ?? 0);
    const printTempMax =
      Number(raw.print_temp_max ?? raw.printTempMax ?? raw.max_print_temp ?? raw.print_temp ?? 0);
    const bedTempMin =
      Number(raw.bed_temp_min ?? raw.bedTempMin ?? raw.min_bed_temp ?? raw.bed_temp ?? 0);
    const bedTempMax =
      Number(raw.bed_temp_max ?? raw.bedTempMax ?? raw.max_bed_temp ?? raw.bed_temp ?? 0);

    const name = String(raw.name ?? raw.product_name ?? "");
    const manufacturer = String(raw.manufacturer ?? raw.brand ?? brand);
    const mat = String(raw.material ?? raw.type ?? material);
    const id = String(raw.id ?? raw.uuid ?? raw.slug ?? "");
    const dataUrl = id
      ? `https://openfilamentdatabase.org/filaments/${id}`
      : "https://openfilamentdatabase.org";

    if (!printTempMin && !printTempMax) return null;

    // Optional extended fields — extract whatever the API happened to return
    const rawDiameter = raw.diameter ?? raw.filament_diameter ?? raw.spool_weight_g; // avoid spool weight
    const diameter = typeof rawDiameter === "number" && rawDiameter > 0 && rawDiameter < 5
      ? rawDiameter : undefined;

    const rawDensity = raw.density ?? raw.material_density ?? raw.specific_gravity;
    const density = typeof rawDensity === "number" && rawDensity > 0 ? rawDensity : undefined;

    const rawColor = raw.color_name ?? raw.color ?? raw.colour ?? raw.color_label;
    const color = typeof rawColor === "string" && rawColor.trim() ? rawColor.trim() : undefined;

    const rawFinish = raw.finish ?? raw.finish_type ?? raw.surface_finish ?? raw.type_detail;
    const finish = typeof rawFinish === "string" && rawFinish.trim() ? rawFinish.trim() : undefined;

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
    };
  } catch {
    return null;
  }
}
