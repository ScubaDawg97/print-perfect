// ─── Public config — client-side fetch + session cache ───────────────────────
//
// Fetches /api/config-public once per browser session (cached in memory).
// Falls back to DEFAULT_PUBLIC_CONFIG on any error or timeout.
// Used by client components via the usePublicConfig() hook.

import { useState, useEffect } from "react";

export interface PublicConfig {
  betaKeyEnabled: boolean;
  betaContactEmail: string;
  siteTagline: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  weatherWidgetEnabled: boolean;
  filamentDbEnabled: boolean;
  historyEnabled: boolean;
  shareCardEnabled: boolean;
  kofiUrl: string;
  makerWorldUrl: string;
  dailyFreeAnalyses: number;
}

export const DEFAULT_PUBLIC_CONFIG: PublicConfig = {
  betaKeyEnabled: true,
  betaContactEmail: "hello@printperfect.app",
  siteTagline: "Get perfect 3D print settings in minutes",
  maintenanceMode: false,
  maintenanceMessage: "Print Perfect is undergoing maintenance. Check back soon!",
  weatherWidgetEnabled: true,
  filamentDbEnabled: true,
  historyEnabled: true,
  shareCardEnabled: true,
  kofiUrl: "https://ko-fi.com/printygoodstuff",
  makerWorldUrl: "https://makerworld.com/printperfect-placeholder",
  dailyFreeAnalyses: 3,
};

const TIMEOUT_MS = 3000;

// Module-level promise — shared across all hook instances in the same session
let configPromise: Promise<PublicConfig> | null = null;

async function fetchPublicConfig(): Promise<PublicConfig> {
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch("/api/config-public", { signal: controller.signal });
    if (!res.ok) return { ...DEFAULT_PUBLIC_CONFIG };
    return (await res.json()) as PublicConfig;
  } catch {
    return { ...DEFAULT_PUBLIC_CONFIG };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Returns the public config promise, fetching once per browser session.
 * Safe to call server-side — returns DEFAULT_PUBLIC_CONFIG immediately.
 */
export function getPublicConfig(): Promise<PublicConfig> {
  if (typeof window === "undefined") {
    return Promise.resolve({ ...DEFAULT_PUBLIC_CONFIG });
  }
  if (!configPromise) {
    configPromise = fetchPublicConfig();
  }
  return configPromise;
}

/**
 * React hook — returns the public config, starting with defaults while loading.
 * All components sharing this hook use the same underlying fetch promise.
 */
export function usePublicConfig(): PublicConfig {
  const [config, setConfig] = useState<PublicConfig>(DEFAULT_PUBLIC_CONFIG);

  useEffect(() => {
    getPublicConfig().then(setConfig);
  }, []);

  return config;
}
