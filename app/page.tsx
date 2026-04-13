"use client";

import { useState, useEffect } from "react";
import { Check } from "lucide-react";
import type { GeometryAnalysis, UserInputs, PrintSettings, AdvancedSettings, AIEnhancements, AppStep, FilamentDBResult } from "@/lib/types";
import type { ParseResult } from "@/lib/fileParser";
import { computeSettings, computeAdvancedSettings, estimatePrintTime } from "@/lib/ruleEngine";
import { loadUsage, canAnalyze, incrementCount, DAILY_FREE_LIMIT } from "@/lib/usageTracker";
import type { UsageRecord } from "@/lib/usageTracker";
import { addSession, defaultSessionName, updateSessionOutcomeFlag } from "@/lib/historyStore";
import type { PrintSession, OutcomeFlag } from "@/lib/types";
import ProgressIndicator from "@/components/ProgressIndicator";
import UploadScreen from "@/components/UploadScreen";
import InputForm from "@/components/InputForm";
import ResultsScreen from "@/components/ResultsScreen";
import LimitModal from "@/components/LimitModal";

interface Results {
  settings: PrintSettings;
  advancedSettings: AdvancedSettings;
  ai: AIEnhancements;
  printTimeMin: number;
  printTimeMax: number;
}

// ── Usage counter bar ─────────────────────────────────────────────────────────

function UsageCounter({
  usage,
  onOpenModal,
}: {
  usage: UsageRecord;
  onOpenModal: () => void;
}) {
  if (usage.count === 0) return null;

  const remaining = Math.max(0, DAILY_FREE_LIMIT - usage.count);

  if (usage.unlocked) {
    return (
      <p className="text-center text-xs font-medium text-teal-600 dark:text-teal-400 py-1 no-print">
        ✓ Unlocked — unlimited analyses today
      </p>
    );
  }

  if (remaining === 0) {
    return (
      <p className="text-center text-xs text-slate-400 dark:text-slate-500 py-1 no-print">
        Daily limit reached ·{" "}
        <button
          onClick={onOpenModal}
          className="text-primary-500 dark:text-primary-400 hover:underline font-medium"
        >
          Unlock →
        </button>
      </p>
    );
  }

  return (
    <p
      className={`text-center text-xs py-1 font-medium no-print ${
        remaining === 1
          ? "text-amber-500 dark:text-amber-400"
          : "text-slate-400 dark:text-slate-500"
      }`}
    >
      {remaining} of {DAILY_FREE_LIMIT} free {remaining === 1 ? "analysis" : "analyses"} remaining today
    </p>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Home() {
  const [step, setStep]                 = useState<AppStep>("upload");
  const [geometry, setGeometry]         = useState<GeometryAnalysis | null>(null);
  const [meshVertices, setMeshVertices] = useState<Float32Array | null>(null);
  const [userInputs, setUserInputs]     = useState<UserInputs | null>(null);
  const [results, setResults]           = useState<Results | null>(null);
  const [filamentDBResult, setFilamentDBResult] = useState<FilamentDBResult | null>(null);
  const [multiObjectWarning, setMultiObjectWarning] = useState(false);
  const [loadingMsg, setLoadingMsg]     = useState("");
  const [error, setError]               = useState("");

  // ── Usage tracking ───────────────────────────────────────────────────────────
  const [usage, setUsage] = useState<UsageRecord>({
    date: "", count: 0, unlocked: false, unlockCode: null,
  });
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [pendingFormArgs, setPendingFormArgs] = useState<{
    inputs: UserInputs;
    filamentDB: FilamentDBResult | null | undefined;
  } | null>(null);

  // ── Session history ──────────────────────────────────────────────────────────
  const [currentSessionId, setCurrentSessionId]     = useState<string | null>(null);
  const [currentSessionName, setCurrentSessionName] = useState<string>("");
  const [currentSavedAt, setCurrentSavedAt]         = useState<string>("");
  const [currentOutcomeFlag, setCurrentOutcomeFlag] = useState<OutcomeFlag>(null);
  const [showSavedToast, setShowSavedToast]         = useState(false);

  // Hydration-safe: load localStorage after mount
  useEffect(() => {
    setUsage(loadUsage());
  }, []);

  // ── Upload complete ──────────────────────────────────────────────────────────

  function handleUploadComplete(result: ParseResult) {
    setGeometry(result.analysis);
    setMeshVertices(result.meshVertices);
    setMultiObjectWarning(result.multiObjectWarning ?? false);
    setStep("form");
  }

  // ── Form submit ──────────────────────────────────────────────────────────────

  async function handleFormSubmit(inputs: UserInputs, filamentDB?: FilamentDBResult | null) {
    if (!geometry) return;

    const currentUsage = loadUsage();

    if (!canAnalyze(currentUsage)) {
      setPendingFormArgs({ inputs, filamentDB });
      setShowLimitModal(true);
      return;
    }

    setUserInputs(inputs);
    setFilamentDBResult(filamentDB ?? null);
    setStep("loading");
    setError("");

    setLoadingMsg("Computing optimal settings…");
    const settings         = computeSettings(geometry, inputs);
    const advancedSettings = computeAdvancedSettings(geometry, inputs, settings);
    const { min, max }     = estimatePrintTime(geometry, settings);

    setLoadingMsg("Asking Claude to explain your settings…");
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ geometry, inputs, settings }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Server error" }));
        if (res.status === 429) {
          setStep("form");
          setPendingFormArgs({ inputs, filamentDB });
          setShowLimitModal(true);
          return;
        }
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const ai = (await res.json()) as AIEnhancements;
      setResults({ settings, advancedSettings, ai, printTimeMin: min, printTimeMax: max });
      setStep("results");

      // ── Count only successful completions ────────────────────────────────
      const updated = incrementCount(currentUsage);
      setUsage(updated);

      // ── Auto-save session to history ─────────────────────────────────────
      const sessionId   = crypto.randomUUID();
      const sessionName = defaultSessionName(geometry.fileName, inputs.printPriority);
      const savedAt     = new Date().toISOString();
      const session: PrintSession = {
        id: sessionId,
        savedAt,
        name: sessionName,
        geometry,
        inputs,
        settings,
        advancedSettings,
        ai,
        filamentDBResult: filamentDB ?? null,
        printTimeMin: min,
        printTimeMax: max,
        multiObjectWarning,
        outcome: { stars: null, note: null, updatedAt: null, outcomeFlag: null },
      };
      addSession(session); // also fires dispatchHistoryChange for badge
      setCurrentSessionId(sessionId);
      setCurrentSessionName(sessionName);
      setCurrentSavedAt(savedAt);
      setCurrentOutcomeFlag(null);
      try { sessionStorage.setItem("printperfect_current_session_id", sessionId); } catch { /* private mode */ }

      // Show the "saved" toast for 3 seconds
      setShowSavedToast(true);
      setTimeout(() => setShowSavedToast(false), 3000);

      // ── Debug snapshot ────────────────────────────────────────────────────
      if (typeof window !== "undefined") {
        try {
          const debugSnapshot = {
            timestamp: new Date().toISOString(),
            geometry,
            inputs,
            settings,
            advancedSettings,
            printTimeMin: min,
            printTimeMax: max,
            aiPrompt: ai._debugPrompt ?? "",
            aiResponse: { ...ai, _debugPrompt: undefined },
            filamentDBResult: filamentDB ?? null,
          };
          localStorage.setItem("pp_debug_last_run", JSON.stringify(debugSnapshot));
        } catch {
          // localStorage unavailable — silently ignore
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStep("form");
    }
  }

  // ── Unlock callback ──────────────────────────────────────────────────────────

  function handleUnlocked(updated: UsageRecord) {
    setUsage(updated);
    setShowLimitModal(false);
    if (pendingFormArgs) {
      const { inputs, filamentDB } = pendingFormArgs;
      setPendingFormArgs(null);
      handleFormSubmit(inputs, filamentDB);
    }
  }

  // ── Reset ────────────────────────────────────────────────────────────────────

  function handleReset() {
    setStep("upload");
    setGeometry(null);
    setMeshVertices(null);
    setUserInputs(null);
    setResults(null);
    setFilamentDBResult(null);
    setMultiObjectWarning(false);
    setCurrentSessionId(null);
    setCurrentSessionName("");
    setCurrentSavedAt("");
    setCurrentOutcomeFlag(null);
    setShowSavedToast(false);
    setError("");
    setUsage(loadUsage());
  }

  const stepNum = step === "upload" ? 1 : step === "form" ? 2 : 3;
  const showCounter = step === "upload" || step === "form";

  return (
    <div>
      {step !== "loading" && (
        <ProgressIndicator currentStep={stepNum as 1 | 2 | 3} />
      )}

      {showCounter && (
        <UsageCounter
          usage={usage}
          onOpenModal={() => setShowLimitModal(true)}
        />
      )}

      {step === "upload" && <UploadScreen onComplete={handleUploadComplete} />}

      {step === "form" && geometry && (
        <>
          {error && (
            <div className="mb-4 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 px-4 py-3 text-sm text-orange-700 dark:text-orange-400">
              <strong>Couldn&apos;t reach Claude:</strong> {error}. Check your{" "}
              <code className="font-mono">ANTHROPIC_API_KEY</code> and try again.
            </div>
          )}
          <InputForm
            geometry={geometry}
            meshVertices={meshVertices ?? undefined}
            onBack={() => setStep("upload")}
            onSubmit={handleFormSubmit}
          />
        </>
      )}

      {step === "loading" && (
        <div className="flex flex-col items-center justify-center py-32 gap-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-full border-4 border-primary-200 border-t-primary-600 animate-spin" />
            <span className="absolute inset-0 flex items-center justify-center text-2xl">🖨️</span>
          </div>
          <div className="text-center">
            <p className="text-slate-800 dark:text-slate-200 font-semibold text-lg">{loadingMsg}</p>
            <p className="text-slate-400 text-sm mt-1">This usually takes 5–10 seconds</p>
          </div>
        </div>
      )}

      {step === "results" && geometry && userInputs && results && (
        <ResultsScreen
          geometry={geometry}
          meshVertices={meshVertices ?? undefined}
          inputs={userInputs}
          settings={results.settings}
          advancedSettings={results.advancedSettings}
          ai={results.ai}
          printTimeMin={results.printTimeMin}
          printTimeMax={results.printTimeMax}
          onReset={handleReset}
          filamentDBResult={filamentDBResult}
          multiObjectWarning={multiObjectWarning}
          sessionId={currentSessionId ?? undefined}
          defaultSessionName={currentSessionName}
          savedAt={currentSavedAt || undefined}
          outcomeFlag={currentOutcomeFlag}
          onOutcomeFlagChange={(flag) => {
            setCurrentOutcomeFlag(flag);
            if (currentSessionId) updateSessionOutcomeFlag(currentSessionId, flag);
          }}
          onOpenUnlockModal={() => setShowLimitModal(true)}
        />
      )}

      {/* Limit modal */}
      {showLimitModal && (
        <LimitModal
          usageRecord={usage}
          onClose={() => {
            setShowLimitModal(false);
            setPendingFormArgs(null);
          }}
          onUnlocked={handleUnlocked}
        />
      )}

      {/* "Session saved" toast — fixed at bottom, auto-dismisses */}
      <div
        className={`no-print fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 dark:bg-slate-700 text-white text-sm font-medium shadow-lg transition-all duration-500 ${
          showSavedToast
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-2 pointer-events-none"
        }`}
        aria-live="polite"
      >
        <Check size={14} className="text-emerald-400 flex-shrink-0" />
        Session saved to your print history
      </div>
    </div>
  );
}
