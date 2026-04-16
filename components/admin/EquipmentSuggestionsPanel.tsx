"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown, Trash2, Loader2 } from "lucide-react";
import clsx from "clsx";

interface Suggestion {
  id: string;
  equipmentType: "printer" | "surface" | "nozzle";
  proposedName: string;
  userDescription: string;
  userCharacteristics?: string;
  submissionTime: string;
  submitterIp: string;
  votes: number;
  status: "pending" | "approved" | "rejected";
}

interface EquipmentSuggestionsPanelProps {
  suggestions: Suggestion[];
  onRefresh: () => void;
}

export default function EquipmentSuggestionsPanel({
  suggestions,
  onRefresh,
}: EquipmentSuggestionsPanelProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const pending = suggestions.filter((s) => s.status === "pending");

  const handleReject = async (id: string) => {
    if (!confirm("Reject this suggestion?")) return;

    setIsUpdating(true);
    try {
      const res = await fetch(`/api/admin/equipment-manage?id=${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setMessage({ type: "success", text: "Suggestion rejected" });
        onRefresh();
      } else {
        setMessage({ type: "error", text: "Failed to reject" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleVote = async (id: string, direction: "up" | "down") => {
    setIsUpdating(true);
    try {
      const res = await fetch("/api/admin/equipment-manage", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          voteDirection: direction,
        }),
      });

      if (res.ok) {
        onRefresh();
      } else {
        setMessage({ type: "error", text: "Failed to vote" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="text-xs text-slate-500 dark:text-slate-400">
        {pending.length} pending suggestion{pending.length !== 1 ? "s" : ""}
      </div>

      {/* Message */}
      {message && (
        <div
          className={clsx(
            "text-xs p-2 rounded",
            message.type === "success"
              ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
              : "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300"
          )}
        >
          {message.text}
        </div>
      )}

      {/* Suggestions list */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {pending.length === 0 ? (
          <div className="p-4 text-xs text-slate-500 dark:text-slate-400 text-center border border-slate-300 dark:border-slate-700 rounded">
            No pending suggestions
          </div>
        ) : (
          pending.map((suggestion) => {
            const typeLabel =
              suggestion.equipmentType === "printer"
                ? "🖨️ Printer"
                : suggestion.equipmentType === "surface"
                ? "🛏️ Bed Surface"
                : "🔧 Nozzle";

            const submittedAt = new Date(suggestion.submissionTime).toLocaleDateString();

            return (
              <div
                key={suggestion.id}
                className="p-3 border border-slate-300 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800/50 space-y-2"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {typeLabel}
                    </div>
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mt-0.5">
                      {suggestion.proposedName}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {submittedAt} · Vote: {suggestion.votes}
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div className="bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700">
                  <div className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3">
                    {suggestion.userDescription}
                  </div>
                </div>

                {/* Characteristics (if present) */}
                {suggestion.userCharacteristics && (
                  <div className="text-xs text-slate-600 dark:text-slate-400 italic">
                    <span className="font-semibold">Characteristics:</span> {suggestion.userCharacteristics}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleVote(suggestion.id, "up")}
                    disabled={isUpdating}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors disabled:opacity-50"
                    title="Upvote"
                  >
                    {isUpdating ? <Loader2 size={12} className="animate-spin" /> : <ThumbsUp size={12} />}
                  </button>
                  <button
                    onClick={() => handleVote(suggestion.id, "down")}
                    disabled={isUpdating}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
                    title="Downvote"
                  >
                    <ThumbsDown size={12} />
                  </button>
                  <button
                    onClick={() => handleReject(suggestion.id)}
                    disabled={isUpdating}
                    className="flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 hover:bg-rose-200 dark:hover:bg-rose-900/50 transition-colors disabled:opacity-50"
                    title="Reject"
                  >
                    {isUpdating ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                  </button>
                </div>

                {/* Note */}
                <div className="text-xs text-slate-500 dark:text-slate-400 italic">
                  💡 Review and manually add to equipment list if approved
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
