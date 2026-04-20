"use client";

import { useState, useEffect, useCallback } from "react";
import { Check } from "lucide-react";
import type { GeometryAnalysis, UserInputs, PrintSettings, AdvancedSettings, AIEnhancements, AppStep, FilamentDBResult, FilamentPropertyDetails } from "@/lib/types";
import type { ParseResult } from "@/lib/fileParser";
import { computeSettings, computeAdvancedSettings, estimatePrintTime, computeFilamentPropertyDetails } from "@/lib/ruleEngine";
import { loadUsage, canAnalyze, incrementCount, DAILY_FREE_LIMIT } from "@/lib/usageTracker";
import type { UsageRecord } from "@/lib/usageTracker";
import { addSession, defaultSessionName, updateSessionOutcomeFlag } from "@/lib/historyStore";
import type { PrintSession, OutcomeFlag } from "@/lib/types";
import { usePublicConfig } from "@/lib/publicConfig";
import ProgressIndicator from "@/components/ProgressIndicator";
import UploadScreen from "@/components/UploadScreen";
import InputForm from "@/components/InputForm";
import ResultsScreen from "@/components/ResultsScreen";
import SettingsEditorPanel from "@/components/SettingsEditorPanel";
import LimitModal from "@/components/LimitModal";
import BetaKeyModal from "@/components/BetaKeyModal";

interface Results {
  settings: PrintSettings;
  advancedSettings: AdvancedSettings;
  ai: AIEnhancements;
  printTimeMin: number;
  printTimeMax: number;
  filamentPropertyDetails: FilamentPropertyDetails;
}

// ── Beta unlock cookie check ──────────────────────────────────────────────────

function isBetaUnlocked(): boolean {
  if (typeof document === "undefined") return true;
  // Check the companion flag cookie (non-HttpOnly, for UX only).
  // The real security token (pp_session) is HttpOnly and verified by middleware.
  return document.cookie.includes("pp_session_active=1");
}

// ── Usage counter bar ─────────────────────────────────────────────────────────

function UsageCounter({
  usage,
  limit,
  onOpenModal,
}: {
  usage: UsageRecord;
  limit: number;
  onOpenModal: () => void;
}) {
  if (usage.count === 0) return null;

  const remaining = Math.max(0, limit - usage.count);

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
      {remaining} of {limit} free {remaining === 1 ? "analysis" : "analyses"} remaining today
    </p>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Home() {
  // Dynamic config from /api/config-public
  const publicConfig = usePublicConfig();
  const dailyLimit   = publicConfig.dailyFreeAnalyses ?? DAILY_FREE_LIMIT;

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

  // ── Beta gate ────────────────────────────────────────────────────────────────
  const [showBetaModal, setShowBetaModal]     = useState(false);
  const [showWelcomeToast, setShowWelcomeToast] = useState(false);
  // Pending upload result — held until user unlocks
  const [pendingUpload, setPendingUpload] = useState<ParseResult | null>(null);

  // ── Settings editor panel ─────────────────────────────────────────────────────
  const [showSettingsEditor, setShowSettingsEditor] = useState(false);

  // Hydration-safe: load localStorage after mount
  useEffect(() => {
    setUsage(loadUsage());
  }, []);

  // Detect ?betagate=1 redirect from middleware
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("betagate") === "1") {
      setShowBetaModal(true);
      // Clean the URL without reloading the page
      window.history.replaceState(null, "", "/");
    }
  }, []);

  // When betaKeyEnabled turns false after config loads, auto-set the cookie
  // so the middleware allows /history etc. without a redirect flash.
  useEffect(() => {
    if (!publicConfig.betaKeyEnabled && !isBetaUnlocked()) {
      fetch("/api/verify-key", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ key: "" }),
      }).catch(() => {});
    }
  }, [publicConfig.betaKeyEnabled]);

  // ── Upload complete ──────────────────────────────────────────────────────────

  function handleUploadComplete(result: ParseResult) {
    // If beta gate is active and user doesn't have the cookie, hold and show modal
    if (publicConfig.betaKeyEnabled && !isBetaUnlocked()) {
      setPendingUpload(result);
      setShowBetaModal(true);
      return;
    }
    proceedWithUpload(result);
  }

  const proceedWithUpload = useCallback((result: ParseResult) => {
    setGeometry(result.analysis);
    setMeshVertices(result.meshVertices);
    setMultiObjectWarning(result.multiObjectWarning ?? false);
    setStep("form");
  }, []);

  // ── Beta modal unlocked ───────────────────────────────────────────────────────

  function handleBetaUnlocked() {
    setShowBetaModal(false);
    // Show welcome toast
    setShowWelcomeToast(true);
    setTimeout(() => setShowWelcomeToast(false), 4000);
    // If user was mid-upload, proceed now
    if (pendingUpload) {
      const upload = pendingUpload;
      setPendingUpload(null);
      proceedWithUpload(upload);
    }
  }

  // ── Form submit ──────────────────────────────────────────────────────────────

  async function handleFormSubmit(inputs: UserInputs, filamentDB?: FilamentDBResult | null) {
    if (!geometry) return;

    const currentUsage = loadUsage();

    if (!canAnalyze(currentUsage, dailyLimit)) {
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
      const filamentPropertyDetails = computeFilamentPropertyDetails(
        geometry, inputs, settings, advancedSettings, filamentDB,
        { specialNotes: ai.specialNotes, pressureAdvanceRange: ai.pressureAdvanceRange }
      );
      setResults({ settings, advancedSettings, ai, printTimeMin: min, printTimeMax: max, filamentPropertyDetails });
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
        filamentPropertyDetails,
      };
      addSession(session);
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
            // Security: the full prompt is no longer returned by the API (it was
            // stripped server-side). This field is intentionally empty. The prompt
            // text is reconstructed server-side only and never sent over the network.
            aiPrompt: "(prompt redacted — see /api/recommend source for template)",
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

  // ── Re-run analysis (settings editor) ─────────────────────────────────────────

  async function handleRerunAnalysis(newInputs: UserInputs) {
    if (!geometry) throw new Error("Geometry not available");

    setShowSettingsEditor(false);
    setLoadingMsg("Re-running analysis with new settings…");
    setStep("loading");
    setError("");

    try {
      // Compute new settings using cached geometry
      const settings = computeSettings(geometry, newInputs);
      const advancedSettings = computeAdvancedSettings(geometry, newInputs, settings);
      const { min, max } = estimatePrintTime(geometry, settings);

      // Call API with new inputs
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ geometry, inputs: newInputs, settings }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Server error" }));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const ai = (await res.json()) as AIEnhancements;
      const filamentPropertyDetails = computeFilamentPropertyDetails(
        geometry, newInputs, settings, advancedSettings, filamentDBResult,
        { specialNotes: ai.specialNotes, pressureAdvanceRange: ai.pressureAdvanceRange }
      );

      // Update results in place
      setResults({ settings, advancedSettings, ai, printTimeMin: min, printTimeMax: max, filamentPropertyDetails });
      setUserInputs(newInputs);
      setStep("results");

      // Create NEW session with variant name
      const oldSessionName = currentSessionName;
      let variantName = oldSessionName;
      const changes: string[] = [];

      if (userInputs?.filamentType !== newInputs.filamentType) changes.push("Material");
      if (userInputs?.printPriority !== newInputs.printPriority) changes.push("Quality");
      if (userInputs?.printPurpose !== newInputs.printPurpose) changes.push("Purpose");
      if (userInputs?.bedSurface !== newInputs.bedSurface) changes.push("Surface");

      if (changes.length > 0) {
        variantName = `${oldSessionName} — ${changes[0]} variant`;
      }

      const newSessionId = crypto.randomUUID();
      const savedAt = new Date().toISOString();
      const session: PrintSession = {
        id: newSessionId,
        savedAt,
        name: variantName,
        geometry,
        inputs: newInputs,
        settings,
        advancedSettings,
        ai,
        filamentDBResult: filamentDBResult ?? null,
        printTimeMin: min,
        printTimeMax: max,
        multiObjectWarning,
        outcome: { stars: null, note: null, updatedAt: null, outcomeFlag: null },
        filamentPropertyDetails,
      };
      addSession(session);
      setCurrentSessionId(newSessionId);
      setCurrentSessionName(variantName);
      setCurrentSavedAt(savedAt);
      setCurrentOutcomeFlag(null);

      // Show the "saved" toast for 3 seconds
      setShowSavedToast(true);
      setTimeout(() => setShowSavedToast(false), 3000);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to re-run analysis");
      setStep("results");
      throw err;
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

  const stepNum    = step === "upload" ? 1 : step === "form" ? 2 : 3;
  const showCounter = step === "upload" || step === "form";

  return (
    <div>
      {step !== "loading" && (
        <ProgressIndicator currentStep={stepNum as 1 | 2 | 3} />
      )}

      {showCounter && (
        <UsageCounter
          usage={usage}
          limit={dailyLimit}
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
        <>
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
            filamentPropertyDetails={results.filamentPropertyDetails}
            onOpenSettingsEditor={() => setShowSettingsEditor(true)}
          />

          {/* Settings editor panel */}
          {showSettingsEditor && (
            <SettingsEditorPanel
              geometry={geometry}
              inputs={userInputs}
              onClose={() => setShowSettingsEditor(false)}
              onRerun={handleRerunAnalysis}
              remainingAnalyses={Math.max(0, dailyLimit - usage.count)}
            />
          )}
        </>
      )}

      {/* Beta key modal — no close button, cannot be dismissed */}
      {showBetaModal && (
        <BetaKeyModal
          contactEmail={publicConfig.betaContactEmail}
          betaKeyEnabled={publicConfig.betaKeyEnabled}
          onUnlocked={handleBetaUnlocked}
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

      {/* "Session saved" toast */}
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

      {/* "Welcome" toast — shown after successful beta key entry */}
      <div
        className={`no-print fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-xl bg-primary-600 text-white text-sm font-semibold shadow-xl transition-all duration-500 ${
          showWelcomeToast
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-2 pointer-events-none"
        }`}
        aria-live="polite"
      >
        🎉 You&apos;re in! Welcome to Print Perfect.
      </div>
    </div>
  );
}
