// ─── Central app configuration — backed by Vercel KV ─────────────────────────
//
// Usage:
//   import { getConfig, getConfigValue, updateConfig } from "@/lib/config";
//
// Reads from Vercel KV when configured, falls back to DEFAULT_CONFIG silently.
// KV storage key: "printperfect:config"
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
  claudeModel: string;            // default: "claude-sonnet-4-20250514"

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

  // Admin
  adminPassphrase: string;        // the /admin passphrase (always read from DEFAULT_CONFIG)
}

export const DEFAULT_CONFIG: AppConfig = {
  betaKeyEnabled: true,
  betaKey: "PRINTPERFECTROCKS",
  betaContactEmail: "hello@printperfect.app",
  dailyFreeAnalyses: 3,
  claudeModel: "claude-sonnet-4-20250514",
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
  adminPassphrase: "PRINTPERFECT_DEV_2025",
};

const KV_KEY      = "printperfect:config";
const KV_TIMEOUT  = 3000; // ms

// ── KV availability check ─────────────────────────────────────────────────────

function isKvConfigured(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
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

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Reads config from KV, merging with DEFAULT_CONFIG for any missing keys.
 * Falls back to DEFAULT_CONFIG silently if KV is not configured or times out.
 */
export async function getConfig(): Promise<AppConfig> {
  if (!isKvConfigured()) return { ...DEFAULT_CONFIG };

  try {
    const { kv } = await import("@vercel/kv");
    const stored  = await withTimeout(kv.get<Partial<AppConfig>>(KV_KEY), KV_TIMEOUT);
    if (!stored) return { ...DEFAULT_CONFIG };
    return { ...DEFAULT_CONFIG, ...stored };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Writes a partial config update to KV, merging with the current config.
 * Throws if KV is not configured.
 */
export async function updateConfig(partial: Partial<AppConfig>): Promise<void> {
  if (!isKvConfigured()) throw new Error("Vercel KV is not configured. See SETUP.md.");
  const { kv } = await import("@vercel/kv");
  const current = await getConfig();
  const updated = { ...current, ...partial };
  await withTimeout(kv.set(KV_KEY, updated), KV_TIMEOUT);
}

/**
 * Reads a single config value.
 * Falls back to DEFAULT_CONFIG[key] if KV is unavailable.
 */
export async function getConfigValue<K extends keyof AppConfig>(
  key: K,
): Promise<AppConfig[K]> {
  const config = await getConfig();
  return config[key];
}
