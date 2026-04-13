"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Trash2, GitCompare, Eye, Clock, Download } from "lucide-react";
import {
  loadSessions, updateSessionName, updateSessionOutcome, updateSessionOutcomeFlag,
  deleteSession, formatSessionDate, isHistoryAvailable,
} from "@/lib/historyStore";
import { estimateFilamentUsage } from "@/lib/ruleEngine";
import { downloadShareCardFromData } from "@/lib/shareCard";
import type { ShareCardData } from "@/lib/shareCard";
import type { PrintSession, PrintOutcome, OutcomeFlag } from "@/lib/types";
import StarRating from "@/components/StarRating";
import OutcomeFlagSelector from "@/components/OutcomeFlagSelector";

// ── Utilities ─────────────────────────────────────────────────────────────────

function wordCount(text: string): number {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}

const TIER_BADGE: Record<string, string> = {
  Draft:    "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  Standard: "bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300",
  Quality:  "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  Ultra:    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
};

const FLAG_BADGE_STYLE: Record<string, string> = {
  success: "bg-[rgba(29,158,117,0.12)] text-[#1D9E75] border border-[rgba(29,158,117,0.3)]",
  partial: "bg-[rgba(186,117,23,0.12)] text-[#BA7517] border border-[rgba(186,117,23,0.3)]",
  failed:  "bg-[rgba(163,45,45,0.12)] text-[#A32D2D] border border-[rgba(163,45,45,0.3)]",
};
const FLAG_BADGE_LABEL: Record<string, string> = {
  success: "✓ Success",
  partial: "~ Partial",
  failed:  "✗ Failed",
};

// ── Outcome note editor ───────────────────────────────────────────────────────

function OutcomeNote({
  sessionId,
  outcome,
  onUpdate,
}: {
  sessionId: string;
  outcome: PrintOutcome;
  onUpdate: (o: PrintOutcome) => void;
}) {
  const [editing, setEditing]   = useState(false);
  const [text, setText]         = useState(outcome.note ?? "");
  const timerRef                = useRef<ReturnType<typeof setTimeout> | null>(null);

  function save(value: string) {
    const updated: PrintOutcome = {
      ...outcome,
      note: value.trim() || null,
      updatedAt: new Date().toISOString(),
    };
    updateSessionOutcome(sessionId, updated);
    onUpdate(updated);
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const raw = e.target.value;
    const wc  = wordCount(raw);
    if (wc > 50) {
      const trimmed = raw.trim().split(/\s+/).slice(0, 50).join(" ");
      setText(trimmed);
      return;
    }
    setText(raw);
  }

  function handleBlur() {
    setEditing(false);
    save(text);
    if (timerRef.current) clearTimeout(timerRef.current);
  }

  const wc = wordCount(text);

  if (!editing && !outcome.note) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 italic transition-colors"
      >
        + How did it go? (50 words)
      </button>
    );
  }

  if (!editing && outcome.note) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-left transition-colors line-clamp-2"
        title={outcome.note}
      >
        &ldquo;{outcome.note}&rdquo;
      </button>
    );
  }

  return (
    <div>
      <textarea
        value={text}
        onChange={handleChange}
        onBlur={handleBlur}
        autoFocus
        placeholder="How did it go? (50 words max)"
        rows={2}
        className="input w-full text-xs resize-none"
      />
      <p className={`text-[10px] mt-0.5 text-right ${wc > 45 ? "text-amber-500" : "text-slate-400"}`}>
        {wc} / 50 words
      </p>
    </div>
  );
}

// ── Session card ──────────────────────────────────────────────────────────────

function SessionCard({
  session,
  onUpdate,
  onDelete,
  compareSlot,
  onCompareClick,
}: {
  session: PrintSession;
  onUpdate: (updated: PrintSession) => void;
  onDelete: () => void;
  compareSlot: "A" | "B" | null;
  onCompareClick: () => void;
}) {
  const router                          = useRouter();
  const [name, setName]                 = useState(session.name);
  const [editingName, setEditingName]   = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [outcome, setOutcome]           = useState<PrintOutcome>(session.outcome);
  const [downloadingCard, setDownloadingCard] = useState(false);
  const nameInputRef                    = useRef<HTMLInputElement>(null);
  const nameTimerRef                    = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentFlag: OutcomeFlag = outcome.outcomeFlag ?? null;

  useEffect(() => {
    if (editingName) nameInputRef.current?.select();
  }, [editingName]);

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.slice(0, 60);
    setName(val);
    if (nameTimerRef.current) clearTimeout(nameTimerRef.current);
    nameTimerRef.current = setTimeout(() => {
      updateSessionName(session.id, val || session.name);
      onUpdate({ ...session, name: val || session.name });
    }, 500);
  }

  function handleNameBlur() {
    setEditingName(false);
    if (!name.trim()) setName(session.name);
  }

  function handleStarChange(stars: 1 | 2 | 3 | 4 | 5 | null) {
    const updated: PrintOutcome = {
      ...outcome,
      stars,
      updatedAt: new Date().toISOString(),
    };
    setOutcome(updated);
    updateSessionOutcome(session.id, updated);
    onUpdate({ ...session, outcome: updated });
  }

  function handleFlagChange(flag: OutcomeFlag) {
    const updated: PrintOutcome = {
      ...outcome,
      outcomeFlag: flag,
      updatedAt: new Date().toISOString(),
    };
    setOutcome(updated);
    updateSessionOutcomeFlag(session.id, flag);
    onUpdate({ ...session, outcome: updated });
  }

  function handleOutcomeUpdate(o: PrintOutcome) {
    setOutcome(o);
    onUpdate({ ...session, outcome: o });
  }

  async function handleDownloadCard() {
    setDownloadingCard(true);
    try {
      const cardData: ShareCardData = {
        sessionName: name,
        inputs:      session.inputs,
        settings:    session.settings,
        geometry:    session.geometry,
        outcomeFlag: currentFlag,
        savedAt:     session.savedAt,
      };
      await downloadShareCardFromData(cardData);
    } finally {
      setDownloadingCard(false);
    }
  }

  const s   = session.settings;
  const geo = session.geometry;
  const inp = session.inputs;
  const isSelected = compareSlot !== null;

  return (
    <div
      className={`card p-5 space-y-4 transition-all duration-200 ${
        isSelected
          ? "border-teal-400 dark:border-teal-500 ring-1 ring-teal-400 dark:ring-teal-500"
          : ""
      }`}
    >
      {/* Top row: name + flag badge + actions */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {editingName ? (
              <input
                ref={nameInputRef}
                value={name}
                onChange={handleNameChange}
                onBlur={handleNameBlur}
                onKeyDown={(e) => e.key === "Enter" && nameInputRef.current?.blur()}
                className="input font-semibold text-slate-900 dark:text-slate-100 text-sm py-1 h-auto flex-1 min-w-0"
                maxLength={60}
              />
            ) : (
              <button
                onClick={() => setEditingName(true)}
                className="text-sm font-semibold text-slate-900 dark:text-slate-100 hover:text-primary-600 dark:hover:text-primary-400 transition-colors text-left truncate max-w-full"
                title="Click to rename"
              >
                {name}
              </button>
            )}
            {/* Outcome flag badge */}
            {currentFlag && (
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${FLAG_BADGE_STYLE[currentFlag]}`}>
                {FLAG_BADGE_LABEL[currentFlag]}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
            <Clock size={10} className="inline mr-1" />
            {formatSessionDate(session.savedAt)}
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Compare slot indicator */}
          {isSelected && (
            <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300">
              {compareSlot}
            </span>
          )}

          {/* Delete */}
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => { deleteSession(session.id); onDelete(); }}
                className="text-xs px-2 py-1 rounded-lg bg-rose-500 text-white hover:bg-rose-600 font-medium"
              >
                Delete
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
              title="Delete session"
              aria-label="Delete session"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Printer + filament info */}
      <div className="flex flex-wrap gap-2 items-center text-xs text-slate-600 dark:text-slate-300">
        <span className="font-medium">{inp.printerModel}</span>
        <span className="text-slate-300 dark:text-slate-600">·</span>
        <span>{inp.filamentType}{inp.filamentBrand ? ` (${inp.filamentBrand})` : ""}</span>
        <span className="text-slate-300 dark:text-slate-600">·</span>
        <span>{inp.nozzleDiameter}mm nozzle</span>
        <span
          className={`px-2 py-0.5 rounded-full font-medium ${TIER_BADGE[inp.printPriority] ?? TIER_BADGE.Standard}`}
        >
          {inp.printPriority}
        </span>
      </div>

      {/* Settings summary line */}
      <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
        {s.printTemp}°C · {s.bedTemp}°C bed · {s.printSpeed}mm/s · {s.infill}% infill · {s.layerHeight}mm layers
      </p>

      {/* Filament estimate */}
      {(() => {
        const est = estimateFilamentUsage(
          geo.volume,
          geo.surfaceArea,
          inp.filamentType,
          s.infill,
          s.wallCount,
          inp.nozzleDiameter,
        );
        return (
          <p className="text-xs text-slate-400 dark:text-slate-500">
            ~{est.weightGrams}g · ~{est.lengthMeters}m filament
          </p>
        );
      })()}

      {/* Outcome flag selector */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-slate-400 dark:text-slate-500">Print outcome:</p>
        <OutcomeFlagSelector
          currentFlag={currentFlag}
          onFlagChange={handleFlagChange}
          compact
        />
      </div>

      {/* Star rating + outcome note */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <StarRating value={outcome.stars} onChange={handleStarChange} size="sm" />
          <span className="text-xs text-slate-400 dark:text-slate-500">
            {outcome.stars ? "Your rating" : "Rate this print"}
          </span>
        </div>
        <OutcomeNote
          sessionId={session.id}
          outcome={outcome}
          onUpdate={handleOutcomeUpdate}
        />
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
        <button
          onClick={() => router.push(`/history/${session.id}`)}
          className="btn-secondary text-xs py-1.5 px-3 gap-1.5"
        >
          <Eye size={12} /> View full results
        </button>
        <button
          onClick={onCompareClick}
          className={`text-xs py-1.5 px-3 gap-1.5 rounded-xl border font-semibold transition-colors inline-flex items-center ${
            isSelected
              ? "bg-teal-50 dark:bg-teal-900/20 border-teal-300 dark:border-teal-700 text-teal-700 dark:text-teal-300"
              : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
          }`}
        >
          <GitCompare size={12} />
          {isSelected ? `Selected (${compareSlot})` : "Compare"}
        </button>
        <button
          onClick={handleDownloadCard}
          disabled={downloadingCard}
          className="btn-secondary text-xs py-1.5 px-3 gap-1.5"
          title="Download share card PNG"
        >
          <Download size={12} />
          {downloadingCard ? "Generating…" : "Share card"}
        </button>
      </div>
    </div>
  );
}

// ── Outcome summary row ───────────────────────────────────────────────────────

function OutcomeSummaryRow({ sessions }: { sessions: PrintSession[] }) {
  const flagged  = sessions.filter((s) => s.outcome?.outcomeFlag);
  if (flagged.length < 2) return null;

  const success = flagged.filter((s) => s.outcome.outcomeFlag === "success").length;
  const partial = flagged.filter((s) => s.outcome.outcomeFlag === "partial").length;
  const failed  = flagged.filter((s) => s.outcome.outcomeFlag === "failed").length;

  const parts: string[] = [];
  if (success > 0) parts.push(`✓ ${success} successful`);
  if (partial > 0) parts.push(`~ ${partial} partial`);
  if (failed  > 0) parts.push(`✗ ${failed} failed`);

  return (
    <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm text-slate-600 dark:text-slate-300 flex flex-wrap items-center gap-2">
      <span className="font-semibold text-slate-700 dark:text-slate-200">Your prints:</span>
      {parts.map((p, i) => (
        <span key={i} className="text-slate-500 dark:text-slate-400">{p}</span>
      ))}
    </div>
  );
}

// ── History page ──────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const [sessions, setSessions]         = useState<PrintSession[]>([]);
  const [loading, setLoading]           = useState(true);
  const [available, setAvailable]       = useState(true);
  const [compareA, setCompareA]         = useState<string | null>(null);
  const [compareB, setCompareB]         = useState<string | null>(null);
  const router                          = useRouter();

  useEffect(() => {
    const ok = isHistoryAvailable();
    setAvailable(ok);
    if (ok) setSessions(loadSessions());
    setLoading(false);

    function onHistoryChange() {
      setSessions(loadSessions());
    }
    window.addEventListener("pp_history_change", onHistoryChange);
    return () => window.removeEventListener("pp_history_change", onHistoryChange);
  }, []);

  function handleCompareClick(id: string) {
    if (compareA === id) {
      setCompareA(compareB);
      setCompareB(null);
    } else if (compareB === id) {
      setCompareB(null);
    } else if (!compareA) {
      setCompareA(id);
    } else if (!compareB) {
      setCompareB(id);
    } else {
      setCompareB(id);
    }
  }

  function getCompareSlot(id: string): "A" | "B" | null {
    if (compareA === id) return "A";
    if (compareB === id) return "B";
    return null;
  }

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-400">
        <div className="w-8 h-8 border-2 border-slate-200 border-t-primary-500 rounded-full animate-spin mx-auto mb-4" />
        Loading your history…
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Your print history</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Your last {sessions.length > 0 ? sessions.length : "5"} {sessions.length === 1 ? "analysis" : "analyses"}, saved locally on your device
        </p>
      </div>

      {/* Private browsing notice */}
      {!available && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          ⚠️ History saving isn&apos;t available in private browsing mode. Your sessions won&apos;t be saved across visits.
        </div>
      )}

      {/* Outcome summary row — shown when ≥2 sessions have been flagged */}
      {sessions.length > 0 && <OutcomeSummaryRow sessions={sessions} />}

      {/* Empty state */}
      {available && sessions.length === 0 && (
        <div className="text-center py-20 space-y-4">
          <div className="text-6xl">🖨️</div>
          <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-300">No saved sessions yet</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Run your first analysis to start your print log. Your sessions are saved automatically right here.
          </p>
          <a href="/" className="btn-primary inline-flex mt-2">
            Get started →
          </a>
        </div>
      )}

      {/* Session list */}
      {sessions.length > 0 && (
        <div className="space-y-4">
          {sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              compareSlot={getCompareSlot(session.id)}
              onCompareClick={() => handleCompareClick(session.id)}
              onUpdate={(updated) =>
                setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
              }
              onDelete={() =>
                setSessions((prev) => prev.filter((s) => s.id !== session.id))
              }
            />
          ))}
        </div>
      )}

      {/* Sticky compare bar */}
      {(compareA || compareB) && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-t border-slate-200 dark:border-slate-700 shadow-lg">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
            <div className="text-sm text-slate-600 dark:text-slate-300 min-w-0">
              {compareA && (
                <span className="font-medium">
                  A: {sessions.find((s) => s.id === compareA)?.name ?? "Session A"}
                </span>
              )}
              {compareB && (
                <span className="font-medium">
                  {" "}· B: {sessions.find((s) => s.id === compareB)?.name ?? "Session B"}
                </span>
              )}
              {compareA && !compareB && (
                <span className="text-slate-400 ml-2 text-xs">
                  — select a second session to compare
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => { setCompareA(null); setCompareB(null); }}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                Clear
              </button>
              {compareA && compareB && (
                <button
                  onClick={() => router.push(`/history/compare?a=${compareA}&b=${compareB}`)}
                  className="btn-primary text-sm"
                >
                  <GitCompare size={14} /> Compare now →
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
