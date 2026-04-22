// ─── Central app configuration — two-tier storage ─────────────────────────────
//
// Usage:
//   import { getConfig, getConfigValue, updateConfig } from "@/lib/config";
//
// Storage tiers (automatic, no configuration needed):
//   TIER 1 — Vercel KV (production): used when KV_REST_API_URL + KV_REST_API_TOKEN are set.
//             Reads/writes to KV key "printperfect:config". Changes affect all users globally.
//   TIER 2 — Local JSON file (development): used when KV env vars are absent.
//             Reads/writes to config/runtime-config.json in the project root.
//             This file is .gitignored and persists across dev server restarts.
//
// SETUP: See SETUP.md for instructions on connecting Vercel KV.

export interface AppConfig {
  // Beta access key settings
  betaKeyEnabled: boolean;        // master toggle — false = no key required
  betaKey: string;                // the current access key
  betaContactEmail: string;       // email shown on the key prompt

  // Rate limiting
  dailyFreeAnalyses: number;      // default: 3

  // AI model
  claudeModel: string;            // default: "claude-haiku-4-5-20251001" (cost-efficient)

  // Site messaging
  siteTagline: string;            // shown in header/hero
  maintenanceMode: boolean;       // if true, show maintenance message instead of app
  maintenanceMessage: string;     // the message to show during maintenance

  // Tip jar
  kofiUrl: string;                // Ko-fi page URL
  makerWorldUrl: string;          // MakerWorld profile URL

  // Feature flags
  weatherWidgetEnabled: boolean;  // toggle the live weather feature
  filamentDbEnabled: boolean;     // toggle OFD API integration
  historyEnabled: boolean;        // toggle /history page
  shareCardEnabled: boolean;      // toggle share card feature

  // Analysis limits
  maxFileSizeMb: number;          // default: 50

  // Cost & health monitoring / alerting
  alertEmail: string;             // email address for alert notifications (e.g., owner@example.com)
  dailyCostThreshold: number;     // USD — alert if daily spend exceeds this (default: 2.0)
  errorRateThreshold: number;     // percentage — alert if error rate exceeds this (default: 5)
  hourlyErrorCountThreshold: number; // alert if hourly errors exceed this (default: 10)
  alertOnCostSpike: boolean;      // toggle cost spike alerts (default: true)
  alertOnErrorSpike: boolean;     // toggle error spike alerts (default: true)

  // Admin
  adminPassphrase: string;        // the /admin passphrase (always read from DEFAULT_CONFIG)
}

export const DEFAULT_CONFIG: AppConfig = {
  betaKeyEnabled: true,
  betaKey: "PRINTPERFECTROCKS",
  betaContactEmail: "info@printperfect.app",
  dailyFreeAnalyses: 3,
  claudeModel: "claude-haiku-4-5-20251001",
  siteTagline: "Get perfect 3D print settings in minutes",
  maintenanceMode: false,
  maintenanceMessage: "Print Perfect is undergoing maintenance. Check back soon!",
  kofiUrl: "https://ko-fi.com/printygoodstuff",
  makerWorldUrl: "https://makerworld.com/printperfect-placeholder",
  weatherWidgetEnabled: true,
  filamentDbEnabled: true,
  historyEnabled: true,
  shareCardEnabled: true,
  maxFileSizeMb: 50,
  // Cost & health monitoring — defaults below
  alertEmail: process.env.ADMIN_EMAIL || "admin@printperfect.app",
  dailyCostThreshold: 2.0,
  errorRateThreshold: 5,
  hourlyErrorCountThreshold: 10,
  alertOnCostSpike: true,
  alertOnErrorSpike: true,
  adminPassphrase: "PRINTPERFECT_DEV_2025",
};

const KV_KEY      = "printperfect:config";
const KV_TIMEOUT  = 3000; // ms

// ── Storage tier detection ────────────────────────────────────────────────────

export type StorageTier = "kv" | "local-file";

export function isKvConfigured(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

/** True when running inside a Vercel deployment (not local dev). */
function isVercelProduction(): boolean {
  return !!(process.env.VERCEL);
}

export function getStorageTier(): StorageTier {
  return isKvConfigured() ? "kv" : "local-file";
}

// ── Timeout wrapper ───────────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("KV timeout")), ms),
    ),
  ]);
}

// ── Internal storage helpers ──────────────────────────────────────────────────

async function readStoredConfig(): Promise<Partial<AppConfig>> {
  if (isKvConfigured()) {
    // Tier 1: Vercel KV
    try {
      const { kv } = await import("@vercel/kv");
      const stored = await withTimeout(kv.get<Partial<AppConfig>>(KV_KEY), KV_TIMEOUT);
      return stored ?? {};
    } catch (e) {
      console.warn("KV read failed, using defaults:", e);
      return {};
    }
  } else {
    // Tier 2: local JSON file (config/runtime-config.json)
    try {
      const fs   = await import("fs/promises");
      const path = await import("path");
      const filePath = path.join(process.cwd(), "config", "runtime-config.json");
      const raw = await fs.readFile(filePath, "utf-8");
      return JSON.parse(raw) as Partial<AppConfig>;
    } catch {
      // File doesn't exist yet or is invalid — return empty, defaults will be used
      return {};
    }
  }
}

async function writeStoredConfig(config: Partial<AppConfig>): Promise<void> {
  if (isKvConfigured()) {
    // Tier 1: Vercel KV
    const { kv } = await import("@vercel/kv");
    await withTimeout(kv.set(KV_KEY, config), KV_TIMEOUT);
  } else if (isVercelProduction()) {
    // On Vercel without KV configured — the filesystem is read-only, so we
    // cannot fall back to a local file. Surface a clear error so the admin
    // knows exactly what to do rather than getting a cryptic ENOENT.
    throw new Error(
      "Vercel KV is not connected. Go to your Vercel project → Storage → Create Database → KV, " +
      "then link it to this project so KV_REST_API_URL and KV_REST_API_TOKEN are set. See SETUP.md."
    );
  } else {
    // Tier 2: local JSON file (local dev only)
    const fs   = await import("fs/promises");
    const path = await import("path");
    const dirPath  = path.join(process.cwd(), "config");
    const filePath = path.join(dirPath, "runtime-config.json");
    await fs.mkdir(dirPath, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(config, null, 2), "utf-8");
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Reads config from storage, merging with DEFAULT_CONFIG for any missing keys.
 * Falls back to DEFAULT_CONFIG silently if storage is unavailable.
 */
export async function getConfig(): Promise<AppConfig> {
  const stored = await readStoredConfig();
  return { ...DEFAULT_CONFIG, ...stored };
}

/**
 * Writes a partial config update to storage, merging with the current config.
 * Uses the best available storage tier automatically — never throws due to KV
 * being unconfigured; falls back to local file storage instead.
 */
export async function updateConfig(partial: Partial<AppConfig>): Promise<{ storage: StorageTier }> {
  const current = await getConfig();
  const updated = { ...current, ...partial };
  await writeStoredConfig(updated);
  return { storage: getStorageTier() };
}

/**
 * Reads a single config value.
 * Falls back to DEFAULT_CONFIG[key] if storage is unavailable.
 */
export async function getConfigValue<K extends keyof AppConfig>(
  key: K,
): Promise<AppConfig[K]> {
  const config = await getConfig();
  return config[key];
}
