"use client";

import { useState } from "react";
import { ThumbsUp, Check, X } from "lucide-react";
import clsx from "clsx";
import type { FilamentSuggestion } from "@/lib/filamentSchemas";

/**
 * ─── FilamentSuggestionsPanel Component ────────────────────────────────────────
 * Admin panel for reviewing user filament suggestions.
 * Allows voting, approving, or rejecting suggestions.
 */

export interface FilamentSuggestionsPanelProps {
  suggestions: FilamentSuggestion[];
  onUpdate: () => void;
}

export default function FilamentSuggestionsPanel({
  suggestions,
  onUpdate,
}: FilamentSuggestionsPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const pendingSuggestions = suggestions.filter((s) => s.status === "pending");
  const approvedSuggestions = suggestions.filter((s) => s.status === "approved");
  const rejectedSuggestions = suggestions.filter((s) => s.status === "rejected");

  const handleApprove = async (id: string) => {
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/filament-manage?id=${id}&action=approve`,
        { method: "PUT", headers: { "Content-Type": "application/json" }, body: "{}" }
      );

      if (response.ok) {
        onUpdate();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to approve");
      }
    } catch (err) {
      setError("Network error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async (id: string) => {
    if (!confirm("Reject this suggestion?")) return;

    setIsLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/filament-manage?id=${id}&action=reject`,
        { method: "PUT", headers: { "Content-Type": "application/json" }, body: "{}" }
      );

      if (response.ok) {
        onUpdate();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to reject");
      }
    } catch (err) {
      setError("Network error");
    } finally {
      setIsLoading(false);
    }
  };

  const SuggestionCard = ({
    suggestion,
    isPending = false,
  }: {
    suggestion: FilamentSuggestion;
    isPending?: boolean;
  }) => (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-white dark:bg-slate-800">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-slate-800 dark:text-slate-100">
            {suggestion.displayName}
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {new Date(suggestion.submissionTime).toLocaleDateString()}
          </p>
        </div>
        {!isPending && (
          <span
            className={clsx(
              "text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0",
              suggestion.status === "approved"
                ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400"
                : "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400"
            )}
          >
            {suggestion.status}
          </span>
        )}
      </div>

      <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
        {suggestion.userDescription}
      </p>

      {suggestion.characteristics && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 italic">
          Additional: {suggestion.characteristics}
        </p>
      )}

      {isPending && (
        <div className="flex items-center gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
            <ThumbsUp size={14} />
            <span className="text-xs font-medium">{suggestion.votes}</span>
          </div>
          <button
            onClick={() => handleApprove(suggestion.id)}
            disabled={isLoading}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 transition-colors"
          >
            <Check size={12} /> Approve
          </button>
          <button
            onClick={() => handleReject(suggestion.id)}
            disabled={isLoading}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:bg-slate-400 transition-colors"
          >
            <X size={12} /> Reject
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Pending suggestions */}
      <div>
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-500"></span>
          Pending Review ({pendingSuggestions.length})
        </h3>
        {pendingSuggestions.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No pending suggestions
          </p>
        ) : (
          <div className="space-y-3">
            {pendingSuggestions.map((s) => (
              <SuggestionCard key={s.id} suggestion={s} isPending={true} />
            ))}
          </div>
        )}
      </div>

      {/* Approved suggestions */}
      {approvedSuggestions.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            Approved ({approvedSuggestions.length})
          </h3>
          <div className="space-y-3 opacity-75">
            {approvedSuggestions.map((s) => (
              <SuggestionCard key={s.id} suggestion={s} />
            ))}
          </div>
        </div>
      )}

      {/* Rejected suggestions */}
      {rejectedSuggestions.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-red-500"></span>
            Rejected ({rejectedSuggestions.length})
          </h3>
          <div className="space-y-3 opacity-50">
            {rejectedSuggestions.map((s) => (
              <SuggestionCard key={s.id} suggestion={s} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
