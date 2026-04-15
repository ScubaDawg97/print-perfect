"use client";

// ─── Admin debug page ─────────────────────────────────────────────────────────
//
// Protected by the existing middleware cookie auth (same as /admin).
// Additionally requires the debug passphrase stored in sessionStorage so that
// even authenticated admins must explicitly unlock the sensitive debug view.
//
// PASSPHRASE: change the constant below after implementation.

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import SpoolIcon from "@/components/SpoolIcon";
import { Copy, Check, LogOut, ArrowLeft, ShieldAlert, SlidersHorizontal } from "lucide-react";
import clsx from "clsx";
import type { SecurityEvent } from "@/app/api/admin/security-events/route";

const DEBUG_PASSPHRASE = "PRINTPERFECT_DEV_2025";
// Shared across all admin pages — entering passphrase once unlocks both /admin/debug and /admin/settings
const SESSION_KEY      = "printperfect_admin_auth";
const STORAGE_KEY      = "pp_debug_last_run";

// ── Types for the stored debug snapshot ──────────────────────────────────────

interface DebugSnapshot {
  timestamp: string;
  geometry: Record<string, unknown>;
  inputs: Record<string, unknown>;
  settings: Record<string, unknown>;
  advancedSettings: Record<string, unknown>;
  printTimeMin: number;
  printTimeMax: number;
  aiPrompt: string;
  aiResponse: Record<string, unknown>;
  filamentDBResult: Record<string, unknown> | null;
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-bold text-slate-800 dark:text-slate-100 text-base mb-3 flex items-center gap-2">
      {children}
    </h2>
  );
}

function CodeBlock({ value }: { value: string }) {
  return (
    <pre className="text-xs font-mono bg-slate-900 dark:bg-slate-950 text-slate-100 rounded-xl p-4 overflow-auto max-h-80 whitespace-pre-wrap leading-relaxed border border-slate-700">
      {value}
    </pre>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2 py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0 w-40">{label}</span>
      <span className="text-xs text-slate-900 dark:text-slate-100 font-mono break-all">{value}</span>
    </div>
  );
}

// ── Passphrase gate ───────────────────────────────────────────────────────────

function PassphraseGate({ onUnlock }: { onUnlock: () => void }) {
  const [value, setValue]   = useState("");
  const [denied, setDenied] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (value === DEBUG_PASSPHRASE) {
      sessionStorage.setItem(SESSION_KEY, "1");
      onUnlock();
    } else {
      setDenied(true);
      setValue("");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <span className="text-primary-600"><SpoolIcon className="w-8 h-8" /></span>
            <span className="font-bold text-2xl text-slate-900 dark:text-slate-100">
              Print<span className="text-primary-600">Perfect</span>
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1.5">
            <ShieldAlert size={13} /> Debug Panel
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-8 space-y-5"
        >
          <div>
            <label className="label" htmlFor="debug-passphrase">Passphrase</label>
            <input
              id="debug-passphrase"
              type="password"
              className="input"
              value={value}
              onChange={(e) => { setValue(e.target.value); setDenied(false); }}
              autoFocus
              required
            />
          </div>

          {denied && (
            <p className="text-sm text-rose-600 dark:text-rose-400">
              Access denied.
            </p>
          )}

          <button type="submit" className="btn-primary w-full justify-center">
            Unlock
          </button>
        </form>

        <p className="text-center text-xs text-slate-400 dark:text-slate-600 mt-6">
          <a href="/admin" className="underline hover:text-slate-600 dark:hover:text-slate-400">← Admin dashboard</a>
        </p>
      </div>
    </div>
  );
}

// ── Main debug panel ─────────────────────────────────────────────────────────

function DebugPanel({ snapshot }: { snapshot: DebugSnapshot }) {
  const [copied, setCopied] = useState(false);

  function handleCopyReport() {
    navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const geo      = snapshot.geometry as Record<string, unknown>;
  const inp      = snapshot.inputs   as Record<string, unknown>;
  const settings = snapshot.settings as Record<string, unknown>;
  const adv      = snapshot.advancedSettings as Record<string, unknown>;
  const aiResp   = snapshot.aiResponse as Record<string, unknown>;
  const fdb      = snapshot.filamentDBResult;

  function fmt(v: unknown): string {
    if (v === null || v === undefined) return "—";
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  }

  return (
    <div className="space-y-8">

      {/* Run metadata */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
        <SectionHeading>📋 Session Snapshot</SectionHeading>
        <DataRow label="Captured at"    value={new Date(snapshot.timestamp).toLocaleString()} />
        <DataRow label="Print time est" value={`${snapshot.printTimeMin}–${snapshot.printTimeMax} min`} />
      </section>

      {/* Geometry analysis */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
        <SectionHeading>📐 Geometry Analysis</SectionHeading>
        <DataRow label="File"             value={fmt(geo.fileName)} />
        <DataRow label="File type"        value={fmt(geo.fileType)} />
        <DataRow label="Dimensions (mm)"  value={`${fmt((geo.dimensions as Record<string,unknown>)?.x)} × ${fmt((geo.dimensions as Record<string,unknown>)?.y)} × ${fmt((geo.dimensions as Record<string,unknown>)?.z)}`} />
        <DataRow label="Volume (cm³)"     value={fmt(geo.volume)} />
        <DataRow label="Surface area (mm²)" value={fmt(geo.surfaceArea)} />
        <DataRow label="Triangle count"   value={fmt(geo.triangleCount)} />
        <DataRow label="Complexity"       value={`${fmt(geo.complexity)} — ${fmt(geo.complexityReason)}`} />
        <DataRow label="Overhangs"        value={`${fmt(geo.overhangSeverity)} (${fmt(geo.overhangPercentage)}%)`} />
        <DataRow label="Auto-oriented"    value={fmt(geo.wasAutoOriented)} />
        <details className="mt-3">
          <summary className="text-xs text-slate-400 cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-300">
            Raw JSON ▸
          </summary>
          <div className="mt-2">
            <CodeBlock value={JSON.stringify(geo, null, 2)} />
          </div>
        </details>
      </section>

      {/* User inputs */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
        <SectionHeading>🖊️ User Inputs</SectionHeading>
        {Object.entries(inp).map(([k, v]) => (
          <DataRow key={k} label={k} value={fmt(v)} />
        ))}
      </section>

      {/* Computed settings */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
        <SectionHeading>⚙️ Computed Settings</SectionHeading>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Rule engine output passed to Claude.</p>
        {Object.entries(settings).map(([k, v]) => (
          <DataRow key={k} label={k} value={fmt(v)} />
        ))}
        <details className="mt-4">
          <summary className="text-xs text-slate-400 cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-300">
            Advanced settings (computed) ▸
          </summary>
          <div className="mt-2 space-y-0">
            {Object.entries(adv).map(([k, v]) => (
              <DataRow key={k} label={k} value={fmt(v)} />
            ))}
          </div>
        </details>
      </section>

      {/* Filament DB result */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
        <SectionHeading>📊 Filament Database Result</SectionHeading>
        {fdb ? (
          <>
            <DataRow label="Matched"        value="Yes — data from Open Filament Database" />
            {Object.entries(fdb as Record<string, unknown>).map(([k, v]) => (
              <DataRow key={k} label={k} value={fmt(v)} />
            ))}
          </>
        ) : (
          <p className="text-xs text-slate-500 dark:text-slate-400 italic">
            No filament DB match — settings fell back to built-in rule engine defaults for this material.
          </p>
        )}
      </section>

      {/* Humidity / weather */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
        <SectionHeading>🌤️ Humidity / Weather</SectionHeading>
        <DataRow label="Humidity level used" value={fmt(inp.humidity)} />
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 italic">
          Raw geolocation and weather API response data is captured in the browser during the form step and is not available here. The humidity level above is what was used to compute settings.
        </p>
      </section>

      {/* Claude prompt */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
        <SectionHeading>📝 Prompt Sent to Claude</SectionHeading>
        <CodeBlock value={snapshot.aiPrompt || "(no prompt captured)"} />
      </section>

      {/* Claude raw response */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
        <SectionHeading>🤖 Raw Claude API Response</SectionHeading>
        {Object.entries(aiResp).filter(([k]) => !["settingExplanations", "settingConfidence"].includes(k)).map(([k, v]) => (
          <DataRow key={k} label={k} value={typeof v === "string" ? v : fmt(v)} />
        ))}
        <details className="mt-3">
          <summary className="text-xs text-slate-400 cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-300">
            Full JSON response ▸
          </summary>
          <div className="mt-2">
            <CodeBlock value={JSON.stringify(aiResp, null, 2)} />
          </div>
        </details>
      </section>

      {/* Copy button */}
      <div className="flex justify-end pb-4">
        <button
          onClick={handleCopyReport}
          className={clsx(
            "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors",
            copied
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
          )}
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? "Copied!" : "Copy full debug report"}
        </button>
      </div>

    </div>
  );
}

// ── API Monitor panel ─────────────────────────────────────────────────────────

interface ApiLogEntry {
  timestamp: string;
  partialIp: string;
  allowed: boolean;
  blockedReason?: string;
  filamentType?: string;
  qualityTier?: string;
  durationMs?: number;
}

interface ApiStats {
  totalToday: number;
  allowedToday: number;
  blockedToday: number;
  suspiciousToday: number;
  topFilamentTypes: Array<{ type: string; count: number }>;
}

interface ApiMonitorData {
  stats: ApiStats | null;
  logs: ApiLogEntry[];
  note?: string;
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: "slate" | "emerald" | "rose" | "amber";
}) {
  const colors = {
    slate:   "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200",
    emerald: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300",
    rose:    "bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300",
    amber:   "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300",
  };
  return (
    <div className={clsx("rounded-xl border p-4 text-center", colors[color])}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs font-medium mt-0.5 opacity-75">{label}</div>
    </div>
  );
}

function ApiMonitorPanel() {
  const [data, setData]       = useState<ApiMonitorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  const fetchData = () => {
    setLoading(true);
    setError("");
    fetch("/api/admin/api-monitor")
      .then((r) => r.json())
      .then((d: ApiMonitorData & { error?: string }) => {
        if (d.error) { setError(d.error); }
        else { setData(d); }
      })
      .catch(() => setError("Failed to load monitor data."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  function fmtTime(ts: string) {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  return (
    <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <SectionHeading>
          📊 API Monitor
        </SectionHeading>
        <button
          onClick={fetchData}
          disabled={loading}
          className="text-xs text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 font-medium transition-colors disabled:opacity-50"
        >
          {loading ? "Loading…" : "↻ Refresh"}
        </button>
      </div>

      {error && (
        <p className="text-xs text-rose-600 dark:text-rose-400 italic">{error}</p>
      )}

      {data?.note && (
        <p className="text-xs text-slate-400 dark:text-slate-500 italic">{data.note}</p>
      )}

      {/* Sub-section 1 — Today's Stats */}
      {data?.stats && (
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
            Today's Stats
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Total requests" value={data.stats.totalToday} color="slate" />
            <StatCard label="Allowed"         value={data.stats.allowedToday} color="emerald" />
            <StatCard label="Blocked"         value={data.stats.blockedToday} color="rose" />
            <StatCard label="Injection attempts" value={data.stats.suspiciousToday} color="amber" />
          </div>
          {data.stats.topFilamentTypes.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="text-xs text-slate-400 dark:text-slate-500 self-center">Top filaments:</span>
              {data.stats.topFilamentTypes.map(({ type, count }) => (
                <span
                  key={type}
                  className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full font-mono"
                >
                  {type} ({count})
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sub-section 2 — Recent API Calls */}
      {data && (
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
            Recent API Calls {data.logs.length > 0 && `(${data.logs.length})`}
          </p>

          {data.logs.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-slate-500 italic">
              No API calls recorded yet.{data.note ? "" : " Calls appear after the first analysis."}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800 text-left text-slate-500 dark:text-slate-400">
                    <th className="px-3 py-2 font-semibold">Time</th>
                    <th className="px-3 py-2 font-semibold">IP</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-3 py-2 font-semibold">Reason</th>
                    <th className="px-3 py-2 font-semibold">Filament</th>
                    <th className="px-3 py-2 font-semibold">Tier</th>
                    <th className="px-3 py-2 font-semibold text-right">ms</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.logs.map((log, i) => (
                    <tr
                      key={i}
                      className={clsx(
                        log.allowed
                          ? "bg-white dark:bg-slate-900"
                          : "bg-rose-50 dark:bg-rose-900/10",
                      )}
                    >
                      <td className="px-3 py-2 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {fmtTime(log.timestamp)}
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-300">
                        {log.partialIp}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={clsx(
                            "px-1.5 py-0.5 rounded font-semibold",
                            log.allowed
                              ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                              : "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400",
                          )}
                        >
                          {log.allowed ? "OK" : "BLOCKED"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                        {log.blockedReason ?? "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-300">
                        {log.filamentType ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                        {log.qualityTier ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-slate-400 dark:text-slate-500">
                        {log.durationMs != null ? log.durationMs.toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ── Security Events panel ─────────────────────────────────────────────────────

function SecurityEventsPanel() {
  const [events, setEvents]     = useState<SecurityEvent[] | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [note, setNote]         = useState("");

  useEffect(() => {
    fetch("/api/admin/security-events")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); }
        else {
          setEvents(data.events ?? []);
          if (data.note) setNote(data.note);
        }
      })
      .catch(() => setError("Failed to load security events."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="bg-white dark:bg-slate-900 rounded-2xl border border-rose-200 dark:border-rose-900/50 shadow-sm p-6">
      <SectionHeading>
        <ShieldAlert size={16} className="text-rose-500" />
        Security Events
        <span className="ml-auto text-xs font-normal text-slate-400 dark:text-slate-500">
          Last 20 injection attempts detected in production
        </span>
      </SectionHeading>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
          <div className="w-4 h-4 border-2 border-slate-200 border-t-rose-400 rounded-full animate-spin" />
          Loading…
        </div>
      )}

      {error && (
        <p className="text-xs text-rose-600 dark:text-rose-400 italic">{error}</p>
      )}

      {note && !loading && (
        <p className="text-xs text-slate-400 dark:text-slate-500 italic">{note}</p>
      )}

      {events && events.length === 0 && !note && (
        <p className="text-xs text-slate-400 dark:text-slate-500 italic">
          No injection attempts detected. 🎉
        </p>
      )}

      {events && events.length > 0 && (
        <div className="space-y-3">
          {events.map((ev) => (
            <div
              key={ev.key}
              className="rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 p-3"
            >
              <div className="flex items-baseline gap-3 mb-1">
                <span className="text-xs font-semibold text-rose-700 dark:text-rose-400">
                  Field: {ev.field}
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500 ml-auto">
                  {new Date(ev.timestamp).toLocaleString()}
                </span>
              </div>
              <pre className="text-xs font-mono text-rose-800 dark:text-rose-300 whitespace-pre-wrap break-all">
                {ev.input}
              </pre>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Page component ────────────────────────────────────────────────────────────

export default function AdminDebugPage() {
  const router   = useRouter();
  const [authed, setAuthed]       = useState<boolean | null>(null); // null = loading
  const [snapshot, setSnapshot]   = useState<DebugSnapshot | null>(null);
  const [noData, setNoData]       = useState(false);

  // Check session auth and load localStorage data on mount
  const loadDebugData = useCallback(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setSnapshot(JSON.parse(raw) as DebugSnapshot);
      } else {
        setNoData(true);
      }
    } catch {
      setNoData(true);
    }
  }, []);

  useEffect(() => {
    // Check middleware cookie auth first via the existing settings endpoint
    fetch("/api/admin/settings")
      .then((r) => {
        if (r.status === 401) { router.push("/admin/login"); return null; }
        return r.json();
      })
      .catch(() => router.push("/admin/login"))
      .then((data) => {
        if (!data) return;
        // Cookie auth passed. Now check sessionStorage passphrase.
        const unlocked = sessionStorage.getItem(SESSION_KEY) === "1";
        setAuthed(unlocked);
        if (unlocked) loadDebugData();
      });
  }, [router, loadDebugData]);

  function handleUnlock() {
    setAuthed(true);
    loadDebugData();
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  // Loading state
  if (authed === null) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-primary-200 border-t-primary-600 animate-spin" />
      </div>
    );
  }

  // Passphrase gate
  if (!authed) {
    return <PassphraseGate onUnlock={handleUnlock} />;
  }

  // Authenticated — show debug content
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">

      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-primary-600"><SpoolIcon className="w-6 h-6" /></span>
            <span className="font-bold text-slate-900 dark:text-slate-100">PrintPerfect</span>
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-400 px-2 py-0.5 rounded-full ml-1">Debug</span>
          </div>
          <div className="flex items-center gap-3">
            <a href="/admin" className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
              <ArrowLeft size={14} /> Admin
            </a>
            <a href="/admin/settings" className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
              <SlidersHorizontal size={14} /> Settings
            </a>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Debug Report</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            Data from the most recent analysis run in this browser.
          </p>
        </div>

        {noData ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-10 text-center">
            <p className="text-3xl mb-3">🖨️</p>
            <p className="font-semibold text-slate-800 dark:text-slate-100 mb-1">No debug data yet</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Run an analysis at <a href="/" className="text-primary-600 dark:text-primary-400 hover:underline">the main app</a> and then return here.
            </p>
          </div>
        ) : snapshot ? (
          <DebugPanel snapshot={snapshot} />
        ) : null}

        <div className="mt-8">
          <ApiMonitorPanel />
        </div>

        <div className="mt-8">
          <SecurityEventsPanel />
        </div>

      </div>
    </div>
  );
}
