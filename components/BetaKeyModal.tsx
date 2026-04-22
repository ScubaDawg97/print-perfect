"use client";

// ─── Beta access key modal ────────────────────────────────────────────────────
//
// Shown when the user tries to proceed past the upload screen without a valid
// beta access cookie, or when redirected with ?betagate=1.
//
// - No close button — cannot be dismissed without entering the correct key.
// - Auto-verifies immediately if betaKeyEnabled is false (gate is off).
// - Shows shake animation + inline error on wrong key.

import { useState, useEffect, useRef } from "react";
import SpoolIcon from "./SpoolIcon";

interface Props {
  /** betaContactEmail from public config */
  contactEmail: string;
  /** betaKeyEnabled from public config */
  betaKeyEnabled: boolean;
  /** Called when key is accepted and cookie is set */
  onUnlocked: () => void;
}

export default function BetaKeyModal({ contactEmail, betaKeyEnabled, onUnlocked }: Props) {
  const [key, setKey]       = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState(false);
  const [shaking, setShaking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // If gate is disabled, silently verify with an empty key and close immediately
  useEffect(() => {
    if (!betaKeyEnabled) {
      verify("").catch(() => {});
    }
  }, [betaKeyEnabled]);

  async function verify(keyValue: string) {
    setLoading(true);
    setError(false);
    try {
      const res  = await fetch("/api/verify-key", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ key: keyValue }),
      });
      const data = await res.json() as { valid: boolean };

      if (data.valid) {
        onUnlocked();
      } else {
        setError(true);
        setShaking(true);
        // Reset shake class after animation completes so it can trigger again
        setTimeout(() => setShaking(false), 500);
      }
    } catch {
      setError(true);
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    verify(key);
  }

  // While gate is off, don't render anything (auto-verify fires silently)
  if (!betaKeyEnabled) return null;

  return (
    /* Full-screen overlay — no pointer events behind it */
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm px-4 animate-fade-in"
      aria-modal="true"
      role="dialog"
      aria-labelledby="beta-modal-title"
    >
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-br from-primary-600 to-primary-700 px-8 py-7 text-center">
          <div className="flex justify-center mb-3">
            <span className="text-white opacity-90">
              <SpoolIcon className="w-10 h-10" />
            </span>
          </div>
          <h2
            id="beta-modal-title"
            className="text-xl font-bold text-white"
          >
            Welcome to Print Perfect Beta
          </h2>
          <p className="text-primary-100 text-sm mt-1.5">
            Private beta · By invitation only
          </p>
        </div>

        {/* Body */}
        <div className="px-8 py-7 space-y-5">
          <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed text-center">
            Print Perfect is currently in private beta. Enter your access key to continue.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Key input */}
            <div className={shaking ? "animate-shake" : ""}>
              <input
                ref={inputRef}
                type="text"
                value={key}
                onChange={(e) => {
                  setKey(e.target.value);
                  setError(false);
                }}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit(e as unknown as React.FormEvent)}
                placeholder="Enter your access key"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                disabled={loading}
                className={`input text-center font-mono tracking-widest uppercase placeholder:normal-case placeholder:tracking-normal ${
                  error
                    ? "border-rose-400 dark:border-rose-500 ring-2 ring-rose-200 dark:ring-rose-900/40 focus:ring-rose-200"
                    : ""
                }`}
              />
              {error && (
                <p className="mt-1.5 text-sm text-rose-600 dark:text-rose-400 text-center animate-fade-in">
                  That key doesn&apos;t match. Please check and try again.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !key.trim()}
              className="btn-primary w-full justify-center text-base py-3"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Verifying…
                </span>
              ) : (
                "Unlock Print Perfect →"
              )}
            </button>
          </form>

          {/* Contact footer */}
          <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
            Don&apos;t have a key?{" "}
            <a
              href={`mailto:${contactEmail}`}
              className="text-primary-600 dark:text-primary-400 hover:underline font-medium"
            >
              {contactEmail}
            </a>{" "}
            to request access.
          </p>
        </div>
      </div>
    </div>
  );
}
