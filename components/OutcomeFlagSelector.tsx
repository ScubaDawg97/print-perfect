"use client";

// ─── Outcome flag selector ────────────────────────────────────────────────────
// Three-pill toggle: ✓ Success · ~ Partial · ✗ Failed
// Clicking the active pill deselects it (returns null).
// Used in both ResultsScreen (normal size) and history cards (compact mode).

import type { OutcomeFlag } from "@/lib/types";

const FLAG_CONFIG: Array<{
  flag: NonNullable<OutcomeFlag>;
  label: string;
  color: string;
  bg: string;
  border: string;
}> = [
  { flag: "success", label: "✓ Success", color: "#1D9E75", bg: "rgba(29,158,117,0.13)",  border: "#1D9E75" },
  { flag: "partial", label: "~ Partial", color: "#BA7517", bg: "rgba(186,117,23,0.13)",  border: "#BA7517" },
  { flag: "failed",  label: "✗ Failed",  color: "#A32D2D", bg: "rgba(163,45,45,0.13)",   border: "#A32D2D" },
];

interface Props {
  currentFlag: OutcomeFlag;
  onFlagChange: (flag: OutcomeFlag) => void;
  /** Smaller pill size — used on history cards */
  compact?: boolean;
  disabled?: boolean;
}

export default function OutcomeFlagSelector({
  currentFlag,
  onFlagChange,
  compact = false,
  disabled = false,
}: Props) {
  return (
    <div className="flex gap-2 flex-wrap">
      {FLAG_CONFIG.map(({ flag, label, color, bg, border }) => {
        const isSelected = currentFlag === flag;
        return (
          <button
            key={flag}
            onClick={() => { if (!disabled) onFlagChange(isSelected ? null : flag); }}
            disabled={disabled}
            style={
              isSelected
                ? {
                    backgroundColor: bg,
                    borderColor: border,
                    color,
                    boxShadow: `0 0 0 1px ${border}`,
                  }
                : undefined
            }
            className={[
              "rounded-full border font-semibold transition-all duration-150 select-none inline-flex items-center",
              compact ? "text-xs px-3 py-1 gap-1" : "text-sm px-4 py-2 gap-1.5",
              isSelected
                ? ""
                : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600",
              disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
