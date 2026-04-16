"use client";

import { useState, useEffect, useRef } from "react";
import clsx from "clsx";

interface OwnerAuthModalProps {
  isOpen: boolean;
  isAlreadyActive: boolean;
  onClose: () => void;
  onDeactivate: () => void;
}

export default function OwnerAuthModal({
  isOpen,
  isAlreadyActive,
  onClose,
  onDeactivate,
}: OwnerAuthModalProps) {
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const passphraseInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input on modal open
  useEffect(() => {
    if (isOpen && passphraseInputRef.current && !isAlreadyActive) {
      passphraseInputRef.current.focus();
    }
  }, [isOpen, isAlreadyActive]);

  // Handle escape key to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Auto-close on success
  useEffect(() => {
    if (!success) return;

    const timer = setTimeout(() => {
      setSuccess(false);
      setPassphrase("");
      setError(null);
      onClose();
    }, 1500);

    return () => clearTimeout(timer);
  }, [success, onClose]);

  const handleAuthenticate = async () => {
    if (!passphrase.trim()) {
      setError("Authentication failed.");
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/owner-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase }),
        credentials: "include", // Include cookies
      });

      if (response.ok) {
        setSuccess(true);
      } else {
        const data = await response.json();
        setError(
          data.message ||
            (response.status === 429
              ? "Too many attempts. Please wait before trying again."
              : "Authentication failed.")
        );
      }
    } catch {
      setError("Authentication failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAuthenticate();
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    // Close when clicking outside the modal
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={handleOverlayClick}
      role="presentation"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
        {isAlreadyActive ? (
          <>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Owner Access Active
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              You currently have owner access. Valid for 7 days.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-medium text-sm transition-colors"
              >
                Continue
              </button>
              <button
                onClick={async () => {
                  try {
                    await fetch("/api/owner-logout", {
                      method: "POST",
                      credentials: "include",
                    });
                    onDeactivate();
                    onClose();
                  } catch {
                    // Silently fail, user can try again
                  }
                }}
                className="flex-1 px-4 py-2 rounded-lg bg-rose-500 text-white hover:bg-rose-600 font-medium text-sm transition-colors"
              >
                Deactivate
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Owner Access
            </h2>

            {success ? (
              <div className="text-center py-4">
                <p className="text-sm text-emerald-700 dark:text-emerald-300">
                  ✓ Owner access granted. Valid for 7 days.
                </p>
              </div>
            ) : (
              <>
                <input
                  ref={passphraseInputRef}
                  type="password"
                  placeholder="Passphrase"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isLoading}
                  className={clsx(
                    "w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700",
                    "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100",
                    "placeholder-slate-400 dark:placeholder-slate-500",
                    "focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    "text-sm"
                  )}
                />

                {error && (
                  <p className="text-xs text-rose-600 dark:text-rose-400">
                    {error}
                  </p>
                )}

                <button
                  onClick={handleAuthenticate}
                  disabled={isLoading || !passphrase.trim()}
                  className={clsx(
                    "w-full px-4 py-2 rounded-lg font-medium text-sm transition-colors",
                    isLoading || !passphrase.trim()
                      ? "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed"
                      : "bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800"
                  )}
                >
                  {isLoading ? "Authenticating…" : "Authenticate"}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
