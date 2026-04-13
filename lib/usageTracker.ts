// ─── Usage tracking — 3 free analyses per day ────────────────────────────────
// Stored in localStorage under STORAGE_KEY.
// Resets automatically at local midnight when the date string changes.

export interface UsageRecord {
  date: string;           // YYYY-MM-DD (local date)
  count: number;          // analyses run today
  unlocked: boolean;      // true when user has unlocked via tip today
  unlockCode: string | null; // stored to prevent same-code reuse
}

const STORAGE_KEY = "printperfect_usage";
export const DAILY_FREE_LIMIT = 3;

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayString(): string {
  // Local date in YYYY-MM-DD format
  const d = new Date();
  const year  = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day   = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function freshRecord(): UsageRecord {
  return { date: todayString(), count: 0, unlocked: false, unlockCode: null };
}

function persist(record: UsageRecord): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // localStorage unavailable (private mode, storage full) — silent no-op
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Load today's usage from localStorage. Automatically resets if it's a new
 * calendar day. Safe to call during SSR (returns fresh record if unavailable).
 */
export function loadUsage(): UsageRecord {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshRecord();

    const parsed = JSON.parse(raw) as UsageRecord;

    // New day → reset regardless of old state
    if (parsed.date !== todayString()) {
      const reset = freshRecord();
      persist(reset);
      return reset;
    }

    return parsed;
  } catch {
    // localStorage unavailable or JSON corrupt — treat as fresh session
    return freshRecord();
  }
}

/**
 * Returns true if an analysis is allowed to proceed.
 * Analyses are free while count < DAILY_FREE_LIMIT or the user has unlocked.
 */
export function canAnalyze(record: UsageRecord): boolean {
  return record.count < DAILY_FREE_LIMIT || record.unlocked;
}

/**
 * Increment the run count. Persists to localStorage and returns the updated
 * record. Only call this on SUCCESSFUL analysis completion.
 */
export function incrementCount(record: UsageRecord): UsageRecord {
  const updated: UsageRecord = { ...record, count: record.count + 1 };
  persist(updated);
  return updated;
}

/**
 * Mark the record as unlocked with the given code. Persists to localStorage
 * and returns the updated record.
 */
export function applyUnlock(record: UsageRecord, code: string): UsageRecord {
  const updated: UsageRecord = { ...record, unlocked: true, unlockCode: code };
  persist(updated);
  return updated;
}
