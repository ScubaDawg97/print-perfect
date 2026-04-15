"use client";

import clsx from "clsx";
import { Wrench, AlertCircle, Lightbulb, HelpCircle } from "lucide-react";
import type { ConcernResponse } from "@/lib/types";

interface ConcernCardProps {
  concern: ConcernResponse;
  problemDescription: string;
}

const CONCERN_STYLES: Record<string, { borderClass: string; bgClass: string; headerBg: string; headerIcon: string; headerTitle: string }> = {
  settings_fixable: {
    borderClass: "border-l-teal-500 dark:border-l-teal-400",
    bgClass: "bg-teal-50 dark:bg-teal-900/20",
    headerBg: "bg-teal-100 dark:bg-teal-900/40",
    headerIcon: "✓",
    headerTitle: "Fixable with Settings",
  },
  partially_settings: {
    borderClass: "border-l-amber-500 dark:border-l-amber-400",
    bgClass: "bg-amber-50 dark:bg-amber-900/20",
    headerBg: "bg-amber-100 dark:bg-amber-900/40",
    headerIcon: "⚡",
    headerTitle: "Partially Fixable",
  },
  hardware_maintenance: {
    borderClass: "border-l-red-500 dark:border-l-red-400",
    bgClass: "bg-red-50 dark:bg-red-900/20",
    headerBg: "bg-red-100 dark:bg-red-900/40",
    headerIcon: "🔧",
    headerTitle: "Hardware Issue",
  },
  unclear: {
    borderClass: "border-l-slate-400 dark:border-l-slate-500",
    bgClass: "bg-slate-50 dark:bg-slate-800/30",
    headerBg: "bg-slate-100 dark:bg-slate-800",
    headerIcon: "?",
    headerTitle: "Needs More Info",
  },
};

export default function ConcernCard({ concern, problemDescription }: ConcernCardProps) {
  const style = CONCERN_STYLES[concern.classification];

  return (
    <div className={clsx("card border-l-4 p-5 space-y-4", style.borderClass)}>
      {/* Header with icon and title */}
      <div className={clsx("flex items-start justify-between gap-3 p-3 rounded-lg -m-3 pr-4", style.headerBg)}>
        <div className="flex items-center gap-3">
          <span className="text-xl flex-shrink-0">{style.headerIcon}</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-900 dark:text-slate-100">
              {style.headerTitle}
            </p>
          </div>
        </div>
        {/* Right-side badge with problem description */}
        <span className="flex-shrink-0 text-xs font-medium px-2.5 py-1 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 whitespace-nowrap max-w-xs truncate" title={problemDescription}>
          "{problemDescription}"
        </span>
      </div>

      {/* Block 1: Direct answer (always shown) */}
      <div>
        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          {concern.directAnswer}
        </p>
      </div>

      {/* Block 2: Hardware note (conditional) */}
      {concern.hardwareNote && (
        <div className="flex gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40">
          <Wrench className="flex-shrink-0 w-4 h-4 text-slate-600 dark:text-slate-400 mt-0.5" />
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            {concern.hardwareNote}
          </p>
        </div>
      )}

      {/* Block 3: Settings impact list (conditional) */}
      {concern.settingsImpact && concern.settingsImpact.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
            Relevant settings to adjust:
          </p>
          <ul className="space-y-1">
            {concern.settingsImpact.map((impact, idx) => (
              <li key={idx} className="flex gap-2 text-sm text-slate-700 dark:text-slate-300">
                <span className="text-teal-600 dark:text-teal-400 font-bold flex-shrink-0">→</span>
                <span>{impact}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Block 4: Confidence note for unclear classification (conditional) */}
      {concern.classification === "unclear" && concern.confidenceNote && (
        <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
          <p className="text-xs italic text-slate-600 dark:text-slate-400">
            {concern.confidenceNote}
          </p>
        </div>
      )}

      {/* Footer note for hardware_maintenance */}
      {concern.classification === "hardware_maintenance" && (
        <div className="flex gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <AlertCircle className="flex-shrink-0 w-4 h-4 text-red-600 dark:text-red-400 mt-0.5" />
          <p className="text-xs text-red-700 dark:text-red-300">
            These results should be considered with the understanding that hardware maintenance may be required for optimal results.
          </p>
        </div>
      )}
    </div>
  );
}
