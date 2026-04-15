"use client";

import { useState, useEffect, useRef } from "react";
import { X, ExternalLink } from "lucide-react";
import { applyUnlock, DAILY_FREE_LIMIT } from "@/lib/usageTracker";
import type { UsageRecord } from "@/lib/usageTracker";

interface Props {
  usageRecord: UsageRecord;
  onClose: () => void;
  onUnlocked: (updated: UsageRecord) => void;
}

type View = "main" | "code" | "success";

export default function LimitModal({ usageRecord, onClose, onUnlocked }: Props) {
  const [view, setView] = useState<View>("main");
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Focus code input when that view appears
  useEffect(() => {
    if (view === "code") inputRef.current?.focus();
  }, [view]);

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();

    // Format: 4–12 alphanumeric characters
    if (!/^[a-zA-Z0-9]{4,12}$/.test(trimmed)) {
      setCodeError("Please enter a 4–12 character code (letters and numbers only).");
      return;
    }

    // Reject if this exact code was already used today (client-side quick check)
    if (
      usageRecord.unlockCode &&
      usageRecord.unlockCode.toLowerCase() === trimmed.toLowerCase()
    ) {
      setCodeError("This code was already used today. Each tip unlocks one day.");
      return;
    }

    // Record the unlock server-side (persists across localStorage clears / incognito)
    try {
      await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });
    } catch {
      // Network error — continue anyway (honour system, client-side also records below)
    }

    // Also update localStorage so the counter UI reflects the unlock immediately
    const updated = applyUnlock(usageRecord, trimmed);
    setView("success");

    // Auto-continue after showing the thank-you message
    setTimeout(() => onUnlocked(updated), 2000);
  }

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-7 animate-slide-up">

        {/* Dismiss button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="Close"
        >
          <X size={16} />
        </button>

        {/* ── Main view ─────────────────────────────────────────── */}
        {view === "main" && (
          <>
            <div className="text-3xl mb-3">☕</div>

            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-3">
              You&apos;ve used your {DAILY_FREE_LIMIT} free analyses today
            </h2>

            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
              Print Perfect runs on Claude AI, which costs real money per analysis.
              To keep this tool free and available, I ask that heavy users contribute
              a small tip. Your {DAILY_FREE_LIMIT} free analyses reset automatically
              tomorrow at midnight.
            </p>

            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
              If you&apos;d like to keep going today, a small tip keeps the server
              running and unlocks unlimited analyses for the rest of today.
            </p>

            {/* Primary CTA — Ko-fi */}
            <a
              href="https://ko-fi.com/printygoodstuff"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary w-full justify-center mb-3"
            >
              Tip on Ko-fi <ExternalLink size={14} />
            </a>

            {/* Secondary — enter code */}
            <button
              onClick={() => setView("code")}
              className="btn-secondary w-full justify-center mb-3"
            >
              I already tipped — enter my code
            </button>

            {/* Tertiary — come back tomorrow */}
            <button
              onClick={onClose}
              className="w-full text-sm text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors py-1.5"
            >
              Come back tomorrow
            </button>
          </>
        )}

        {/* ── Code entry view ───────────────────────────────────── */}
        {view === "code" && (
          <>
            <div className="text-3xl mb-3">🔓</div>

            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
              Enter your unlock code
            </h2>

            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-3">
              After tipping on Ko-fi, click{" "}
              <strong className="text-slate-700 dark:text-slate-300">
                &ldquo;Leave a message&rdquo;
              </strong>{" "}
              and include any 6-character code you choose. Enter that same code here.
            </p>

            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-5">
              This is an honour system — we trust you. Thank you for supporting
              the tool. 🙏
            </div>

            <form onSubmit={handleCodeSubmit} className="space-y-3">
              <div>
                <input
                  ref={inputRef}
                  type="text"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase());
                    setCodeError("");
                  }}
                  placeholder="e.g. COFFEE"
                  className="input w-full text-center text-lg font-mono tracking-widest"
                  maxLength={12}
                  autoComplete="off"
                  spellCheck={false}
                />
                {codeError && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5 text-center">
                    {codeError}
                  </p>
                )}
              </div>

              <button type="submit" className="btn-primary w-full justify-center">
                Unlock today&apos;s analyses
              </button>

              <button
                type="button"
                onClick={() => {
                  setView("main");
                  setCode("");
                  setCodeError("");
                }}
                className="btn-secondary w-full justify-center"
              >
                ← Back
              </button>
            </form>
          </>
        )}

        {/* ── Success view ──────────────────────────────────────── */}
        {view === "success" && (
          <div className="text-center py-4">
            <div className="text-4xl mb-4">🎉</div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
              Thank you — you&apos;re all set!
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Unlimited analyses unlocked for the rest of today.
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-4">
              Continuing in a moment…
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
