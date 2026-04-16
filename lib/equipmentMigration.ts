import {
  hasEquipmentData,
  initializeEquipmentData,
  invalidateCache,
} from "./equipmentStore";

/**
 * ─── Equipment Migration & Initialization ──────────────────────────────────────
 * One-time seeding of equipment data into KV on first run.
 *
 * This function is called lazily on the first API request to equipment endpoints.
 * It's idempotent — subsequent calls are no-ops if data already exists.
 */

let initialized = false;

/**
 * Ensure equipment data is initialized in KV.
 * Call this once per server startup (lazily on first API request).
 */
export async function ensureEquipmentDataInitialized(): Promise<void> {
  // Prevent multiple initialization attempts in the same process
  if (initialized) return;

  try {
    const hasData = await hasEquipmentData();

    if (!hasData) {
      if (process.env.NODE_ENV === "development") {
        console.log("[equipmentMigration] Initializing equipment data...");
      }

      await initializeEquipmentData();
      invalidateCache();

      if (process.env.NODE_ENV === "development") {
        console.log("[equipmentMigration] Equipment data initialized successfully");
      }
    } else {
      if (process.env.NODE_ENV === "development") {
        console.log("[equipmentMigration] Equipment data already exists");
      }
    }

    initialized = true;
  } catch (error) {
    console.error("[equipmentMigration] Initialization failed:", error);
    // Continue anyway — defaults will be used
    initialized = true;
  }
}

/**
 * Reset initialization flag (for testing).
 * Do NOT use in production.
 */
export function resetInitializationFlag(): void {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("resetInitializationFlag can only be called in development");
  }
  initialized = false;
}
