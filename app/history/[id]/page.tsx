"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Calendar } from "lucide-react";
import { getSession, updateSessionOutcome, updateSessionOutcomeFlag, formatSessionDate } from "@/lib/historyStore";
import type { PrintSession, PrintOutcome, OutcomeFlag } from "@/lib/types";
import ResultsScreen from "@/components/ResultsScreen";
import StarRating from "@/components/StarRating";

// ── Outcome panel (shown below the results) ───────────────────────────────────

function wordCount(text: string): number {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}

function OutcomePanel({
  sessionId,
  initialOutcome,
}: {
  sessionId: string;
  initialOutcome: PrintOutcome;
}) {
  const [outcome, setOutcome] = useState<PrintOutcome>(initialOutcome);
  const [noteText, setNoteText] = useState(initialOutcome.note ?? "");
  const [editingNote, setEditingNote] = useState(false);

  function persist(updated: PrintOutcome) {
    setOutcome(updated);
    updateSessionOutcome(sessionId, updated);
  }

  function handleStars(stars: 1 | 2 | 3 | 4 | 5 | null) {
    persist({ ...outcome, stars, updatedAt: new Date().toISOString() });
  }

  function handleNoteChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const raw = e.target.value;
    if (wordCount(raw) > 50) {
      setNoteText(raw.trim().split(/\s+/).slice(0, 50).join(" "));
    } else {
      setNoteText(raw);
    }
  }

  function handleNoteBlur() {
    setEditingNote(false);
    persist({
      ...outcome,
      note: noteText.trim() || null,
      updatedAt: new Date().toISOString(),
    });
  }

  const wc = wordCount(noteText);

  return (
    <div className="card p-6 space-y-4 no-print">
      <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
        <span>⭐</span> Rate this print
      </h3>

      <div className="flex items-center gap-3">
        <StarRating value={outcome.stars} onChange={handleStars} size="md" />
        <span className="text-sm text-slate-400 dark:text-slate-500">
          {outcome.stars ? `${outcome.stars} star${outcome.stars !== 1 ? "s" : ""}` : "Tap to rate"}
        </span>
      </div>

      <div>
        <label className="label">How did it go?</label>
        {editingNote ? (
          <>
            <textarea
              value={noteText}
              onChange={handleNoteChange}
              onBlur={handleNoteBlur}
              autoFocus
              rows={3}
              placeholder="Describe how the print turned out — what worked, what didn't… (50 words max)"
              className="input w-full resize-none"
            />
            <p className={`text-xs mt-1 text-right ${wc > 45 ? "text-amber-500" : "text-slate-400"}`}>
              {wc} / 50 words
            </p>
          </>
        ) : (
          <button
            onClick={() => setEditingNote(true)}
            className="w-full text-left input min-h-[4rem] text-sm text-slate-600 dark:text-slate-300 hover:border-primary-400 transition-colors"
          >
            {outcome.note ? (
              <span>&ldquo;{outcome.note}&rdquo;</span>
            ) : (
              <span className="text-slate-400 dark:text-slate-500 italic">
                Click to add a note about how the print turned out…
              </span>
            )}
          </button>
        )}
      </div>

      {outcome.updatedAt && (
        <p className="text-xs text-slate-400 dark:text-slate-500">
          Last updated {formatSessionDate(outcome.updatedAt)}
        </p>
      )}
    </div>
  );
}

// ── View page ─────────────────────────────────────────────────────────────────

export default function SessionViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [session, setSession]           = useState<PrintSession | null>(null);
  const [loading, setLoading]           = useState(true);
  const [localOutcomeFlag, setLocalOutcomeFlag] = useState<OutcomeFlag>(null);
  const router = useRouter();

  useEffect(() => {
    const s = getSession(id);
    setSession(s);
    setLocalOutcomeFlag(s?.outcome?.outcomeFlag ?? null);
    setLoading(false);
  }, [id]);

  function handleOutcomeFlagChange(flag: OutcomeFlag) {
    setLocalOutcomeFlag(flag);
    if (session) updateSessionOutcomeFlag(session.id, flag);
  }

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-400">
        <div className="w-8 h-8 border-2 border-slate-200 border-t-primary-500 rounded-full animate-spin mx-auto mb-4" />
        Loading session…
      </div>
    );
  }

  if (!session) {
    return (
      <div className="py-24 text-center space-y-4">
        <div className="text-5xl">🔍</div>
        <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-300">
          Session not found
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          This session may have been deleted or is from a different device.
        </p>
        <button onClick={() => router.push("/history")} className="btn-secondary">
          ← Back to history
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Back link */}
      <button
        onClick={() => router.push("/history")}
        className="no-print flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
      >
        <ArrowLeft size={14} /> Back to history
      </button>

      {/* "Viewing saved session" banner */}
      <div className="no-print rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-900/20 px-4 py-3 flex items-center gap-3 text-sm text-sky-800 dark:text-sky-300">
        <Calendar size={15} className="flex-shrink-0" />
        <span>
          Viewing saved session from{" "}
          <strong>{formatSessionDate(session.savedAt)}</strong>. This is cached — no new analysis was run.
        </span>
      </div>

      {/* Full results panel — read from cache */}
      <ResultsScreen
        geometry={session.geometry}
        inputs={session.inputs}
        settings={session.settings}
        advancedSettings={session.advancedSettings}
        ai={session.ai}
        printTimeMin={session.printTimeMin}
        printTimeMax={session.printTimeMax}
        filamentDBResult={session.filamentDBResult}
        multiObjectWarning={session.multiObjectWarning}
        sessionId={session.id}
        defaultSessionName={session.name}
        resetLabel="← Back to history"
        onReset={() => router.push("/history")}
        savedAt={session.savedAt}
        outcomeFlag={localOutcomeFlag}
        onOutcomeFlagChange={handleOutcomeFlagChange}
        filamentPropertyDetails={session.filamentPropertyDetails}
      />

      {/* Rate this print */}
      <OutcomePanel sessionId={session.id} initialOutcome={session.outcome} />
    </div>
  );
}
