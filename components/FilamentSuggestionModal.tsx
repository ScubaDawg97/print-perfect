"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle, X } from "lucide-react";
import clsx from "clsx";

/**
 * ─── FilamentSuggestionModal Component ─────────────────────────────────────────
 * Modal displayed after user fills in filament suggestion details.
 * Shows filament details for confirmation before submitting suggestion.
 */

export interface FilamentSuggestionModalProps {
  isOpen: boolean;
  displayName: string;
  userDescription: string;
  characteristics?: string;
  onClose: () => void;
}

export default function FilamentSuggestionModal({
  isOpen,
  displayName,
  userDescription,
  characteristics,
  onClose,
}: FilamentSuggestionModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<null | "submitted" | "rate_limited" | "error">(null);
  const [submitMessage, setSubmitMessage] = useState("");

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/suggest-filament", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          userDescription,
          characteristics: characteristics || "",
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSubmitStatus("submitted");
        setSubmitMessage(data.message || "Thanks for your suggestion!");
      } else if (response.status === 429) {
        setSubmitStatus("rate_limited");
        setSubmitMessage(data.message || "You can submit one filament suggestion per day.");
      } else {
        setSubmitStatus("error");
        setSubmitMessage(data.message || "Failed to submit suggestion.");
      }
    } catch (error) {
      setSubmitStatus("error");
      setSubmitMessage("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSubmitStatus(null);
    setSubmitMessage("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full max-h-96 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Confirm Filament Suggestion
          </h2>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {submitStatus === null && (
            <>
              {/* Filament details */}
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Filament Name
                  </p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">{displayName}</p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Description
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {userDescription}
                  </p>
                </div>

                {characteristics && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Additional Characteristics
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      {characteristics}
                    </p>
                  </div>
                )}
              </div>

              {/* Info message */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex gap-2">
                <AlertCircle size={16} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                  Your suggestion will be reviewed by our team. If approved, it'll be added to the filament database and available to everyone.
                </p>
              </div>

              {/* Rate limit notice */}
              <div className="text-xs text-slate-500 dark:text-slate-400 text-center">
                You can submit one filament suggestion per day.
              </div>
            </>
          )}

          {/* Submitted state */}
          {submitStatus === "submitted" && (
            <div className="text-center space-y-3 py-4">
              <div className="flex justify-center">
                <CheckCircle size={48} className="text-emerald-500" />
              </div>
              <h3 className="text-lg font-semibold text-emerald-700 dark:text-emerald-400">
                Suggestion Submitted!
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {submitMessage}
              </p>
            </div>
          )}

          {/* Rate limited state */}
          {submitStatus === "rate_limited" && (
            <div className="text-center space-y-3 py-4">
              <div className="flex justify-center">
                <AlertCircle size={48} className="text-amber-500" />
              </div>
              <h3 className="text-lg font-semibold text-amber-700 dark:text-amber-400">
                Rate Limited
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {submitMessage}
              </p>
            </div>
          )}

          {/* Error state */}
          {submitStatus === "error" && (
            <div className="text-center space-y-3 py-4">
              <div className="flex justify-center">
                <AlertCircle size={48} className="text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-red-700 dark:text-red-400">
                Error
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {submitMessage}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 dark:border-slate-700 p-4 flex gap-2 bg-slate-50 dark:bg-slate-700/50">
          <button
            onClick={handleClose}
            className="flex-1 py-2 px-4 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
          >
            Close
          </button>
          {submitStatus === null && (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className={clsx(
                "flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors",
                isSubmitting
                  ? "bg-slate-400 text-white cursor-not-allowed"
                  : "bg-primary-600 text-white hover:bg-primary-700"
              )}
            >
              {isSubmitting ? "Submitting..." : "Submit Suggestion"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
