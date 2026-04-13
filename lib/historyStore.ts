// ─── Print session history store ─────────────────────────────────────────────
// Persists up to MAX_SESSIONS print sessions in localStorage, newest first.
// All operations are wrapped in try/catch — localStorage can fail in private
// browsing or when storage is full. Failures are always silent (no crash).

import type { PrintSession, PrintOutcome, OutcomeFlag } from "./types";

const STORAGE_KEY = "printperfect_history";
const MAX_SESSIONS = 5;

// ── Availability check ────────────────────────────────────────────────────────

/**
 * Returns true if localStorage is readable and writable.
 * Fails gracefully in private browsing / storage-full scenarios.
 */
export function isHistoryAvailable(): boolean {
  try {
    const probe = "__pp_hist_probe__";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function readAll(): PrintSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PrintSession[]) : [];
  } catch {
    return [];
  }
}

function writeAll(sessions: PrintSession[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // Storage full or private mode — silent no-op
  }
}

// Notifies HistoryBadge and any other listeners that the history changed.
export function dispatchHistoryChange(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("pp_history_change"));
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Load all sessions from localStorage, newest first. */
export function loadSessions(): PrintSession[] {
  return readAll();
}

/** Load a single session by ID. Returns null if not found. */
export function getSession(id: string): PrintSession | null {
  return readAll().find((s) => s.id === id) ?? null;
}

/**
 * Add a new session. Keeps only the MAX_SESSIONS most recent.
 * Returns the updated list.
 */
export function addSession(session: PrintSession): PrintSession[] {
  const existing = readAll();
  const updated = [session, ...existing].slice(0, MAX_SESSIONS);
  writeAll(updated);
  dispatchHistoryChange();
  return updated;
}

/** Update the editable name of a session. */
export function updateSessionName(id: string, name: string): void {
  const sessions = readAll();
  const idx = sessions.findIndex((s) => s.id === id);
  if (idx === -1) return;
  sessions[idx] = { ...sessions[idx], name };
  writeAll(sessions);
  dispatchHistoryChange();
}

/** Update the outcome (stars + note) of a session. */
export function updateSessionOutcome(id: string, outcome: PrintOutcome): void {
  const sessions = readAll();
  const idx = sessions.findIndex((s) => s.id === id);
  if (idx === -1) return;
  sessions[idx] = { ...sessions[idx], outcome };
  writeAll(sessions);
  dispatchHistoryChange();
}

/**
 * Update only the outcomeFlag of a session's outcome record.
 * Merges with the existing stars / note so nothing is lost.
 */
export function updateSessionOutcomeFlag(id: string, flag: OutcomeFlag): void {
  const sessions = readAll();
  const idx = sessions.findIndex((s) => s.id === id);
  if (idx === -1) return;
  sessions[idx] = {
    ...sessions[idx],
    outcome: {
      ...sessions[idx].outcome,
      outcomeFlag: flag,
      updatedAt: new Date().toISOString(),
    },
  };
  writeAll(sessions);
  dispatchHistoryChange();
}

/**
 * Delete a session by ID.
 * Returns the updated list.
 */
export function deleteSession(id: string): PrintSession[] {
  const updated = readAll().filter((s) => s.id !== id);
  writeAll(updated);
  dispatchHistoryChange();
  return updated;
}

// ── Formatting utilities shared across history UI ─────────────────────────────

/** "Today at 2:32 PM" or "Apr 11 at 9:14 AM" */
export function formatSessionDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    if (isToday) return `Today at ${time}`;
    const md = date.toLocaleDateString([], { month: "short", day: "numeric" });
    return `${md} at ${time}`;
  } catch {
    return isoString;
  }
}

/** Auto-generate a default session name from file + tier. */
export function defaultSessionName(fileName: string, tier: string): string {
  return `${fileName} — ${tier}`;
}
