"use client";

import { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import clsx from "clsx";
import type { OrientationRecommendation, OrientationAssessment } from "@/lib/types";

interface Props {
  recommendation: OrientationRecommendation;
  sessionId?: string;
}

// Color scheme based on assessment
const ASSESSMENT_COLORS: Record<OrientationAssessment, { bg: string; text: string; border: string }> = {
  excellent: {
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-800",
  },
  good: {
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-800",
  },
  suboptimal: {
    bg: "bg-amber-50 dark:bg-amber-900/20",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-800",
  },
  poor: {
    bg: "bg-rose-50 dark:bg-rose-900/20",
    text: "text-rose-700 dark:text-rose-300",
    border: "border-rose-200 dark:border-rose-800",
  },
};

export default function OrientationRecommendationPanel({
  recommendation,
  sessionId,
}: Props) {
  const [isOpen, setIsOpen] = useState(true);
  const storageKey = sessionId ? `pp_orientation_open_${sessionId}` : null;

  // Persist collapse state to localStorage
  useEffect(() => {
    if (!storageKey) return;
    const stored = localStorage.getItem(storageKey);
    if (stored === "false") {
      setIsOpen(false);
    }
  }, [storageKey]);

  const handleToggle = () => {
    setIsOpen(!isOpen);
    if (storageKey) {
      localStorage.setItem(storageKey, String(!isOpen));
    }
  };

  const colors = ASSESSMENT_COLORS[recommendation.currentOrientationAssessment];
  const assessmentLabel = recommendation.currentOrientationAssessment
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">⚡</span>
          <div className="text-left">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">
              Print Orientation Recommendation
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Based on load direction and FDM anisotropy
            </p>
          </div>
        </div>
        <ChevronDown
          size={18}
          className={clsx(
            "text-slate-400 transition-transform flex-shrink-0",
            isOpen ? "rotate-180" : ""
          )}
        />
      </button>

      {/* Content */}
      {isOpen && (
        <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-4 space-y-4">
          {/* Assessment status with color coding */}
          <div
            className={clsx(
              "rounded-lg border p-3",
              colors.bg,
              colors.border,
              colors.text
            )}
          >
            <p className="text-xs font-medium mb-1">Current Orientation Assessment</p>
            <p className="text-sm font-semibold">{assessmentLabel}</p>
            <p className="text-xs mt-2 opacity-90">{recommendation.currentOrientationReason}</p>
          </div>

          {/* FDM Anisotropy Principle */}
          <div>
            <h4 className="text-xs font-medium text-slate-900 dark:text-slate-100 mb-1.5">
              FDM Anisotropy Principle
            </h4>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {recommendation.principle}
            </p>
          </div>

          {/* Main recommendation with purple border */}
          <div className="rounded-lg border-2 border-purple-400 dark:border-purple-600 bg-purple-50 dark:bg-purple-900/20 p-3.5">
            <h4 className="text-xs font-medium text-purple-700 dark:text-purple-300 mb-1.5">
              Recommended Orientation
            </h4>
            <p className="text-sm font-semibold text-purple-900 dark:text-purple-100">
              {recommendation.recommendation}
            </p>
          </div>

          {/* Strength improvement */}
          <div>
            <h4 className="text-xs font-medium text-slate-900 dark:text-slate-100 mb-1.5">
              Expected Strength Improvement
            </h4>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              {recommendation.strengthImprovement}
            </p>
          </div>

          {/* Slicer instructions */}
          <div>
            <h4 className="text-xs font-medium text-slate-900 dark:text-slate-100 mb-1.5">
              How to Reorient in Your Slicer
            </h4>
            <p className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/50 rounded p-3 whitespace-pre-wrap font-mono text-xs leading-relaxed">
              {recommendation.slicerInstructions}
            </p>
          </div>

          {/* Additional considerations */}
          <div>
            <h4 className="text-xs font-medium text-slate-900 dark:text-slate-100 mb-1.5">
              Material & Filament Considerations
            </h4>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {recommendation.additionalConsiderations}
            </p>
          </div>

          {/* Warning if ignored */}
          <div className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20 p-3">
            <p className="text-xs font-medium text-rose-700 dark:text-rose-300 mb-1">
              ⚠️ If You Ignore This Recommendation
            </p>
            <p className="text-sm text-rose-700 dark:text-rose-300">
              {recommendation.warningIfIgnored}
            </p>
          </div>

          {/* Footer disclaimer */}
          <div className="text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700 pt-3">
            <p>
              This recommendation is based on FDM printing principles and the load direction you
              specified. Your exact optimal orientation may vary depending on geometry, infill
              pattern, and material batch. Always validate with test prints.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
