"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import clsx from "clsx";
import type { LoadDirection, UserInputs } from "@/lib/types";

interface Props {
  /** Current print purpose (controls visibility) */
  printPurpose: UserInputs["printPurpose"];
  /** Current load direction value */
  loadDirection: LoadDirection | undefined;
  /** Current load description value */
  loadDescription: string | undefined;
  /** Called when load direction changes */
  onLoadDirectionChange: (value: LoadDirection | undefined) => void;
  /** Called when load description changes */
  onLoadDescriptionChange: (value: string) => void;
}

// Load direction options with user-friendly icons and descriptions
const LOAD_DIRECTIONS: {
  id: LoadDirection;
  icon: string;
  name: string;
  shortDesc: string;
}[] = [
  {
    id: "vertical_tension",
    icon: "↓",
    name: "Vertical Tension",
    shortDesc: "Hangs under load",
  },
  {
    id: "vertical_compression",
    icon: "⬇️",
    name: "Vertical Compression",
    shortDesc: "Crushed from above",
  },
  {
    id: "cantilever",
    icon: "→",
    name: "Cantilever",
    shortDesc: "Extends horizontally",
  },
  {
    id: "torsional",
    icon: "⟲",
    name: "Torsional",
    shortDesc: "Twisting forces",
  },
  {
    id: "multi_directional",
    icon: "⬈",
    name: "Multi-directional",
    shortDesc: "Mixed loads",
  },
  {
    id: "impact",
    icon: "💥",
    name: "Impact",
    shortDesc: "Shock forces",
  },
  {
    id: "fatigue",
    icon: "🔄",
    name: "Fatigue",
    shortDesc: "Repeated cycling",
  },
];

export default function LoadDirectionInput({
  printPurpose,
  loadDirection,
  loadDescription,
  onLoadDirectionChange,
  onLoadDescriptionChange,
}: Props) {
  // Control expanded state for functional prints (collapsed by default)
  const [isExpanded, setIsExpanded] = useState(printPurpose === "structural");

  // Visibility rules
  if (printPurpose === "decorative") {
    return null; // Hidden for decorative
  }

  const isFunctional = printPurpose === "functional";
  const isStructural = printPurpose === "structural";

  return (
    <div className="space-y-3">
      {/* Header: Collapsed link for functional, regular for structural */}
      {isFunctional ? (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="w-full flex items-center justify-between px-0 py-1 text-left hover:opacity-80 transition-opacity"
        >
          <span className="text-sm font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
            <span>⚡ Load Direction (Optional)</span>
            {loadDirection && (
              <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded">
                {loadDirection.replace(/_/g, " ")}
              </span>
            )}
          </span>
          <ChevronDown
            size={16}
            className={clsx(
              "text-slate-400 transition-transform",
              isExpanded ? "rotate-180" : ""
            )}
          />
        </button>
      ) : (
        <div>
          <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">
            ⚡ Load Direction
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            How will this part be loaded? This affects optimal orientation.
          </p>
        </div>
      )}

      {/* Load direction options (shown when expanded for functional, always for structural) */}
      {isExpanded || isStructural ? (
        <div className="space-y-3">
          {/* Load direction grid */}
          <div className="grid grid-cols-2 gap-2">
            {LOAD_DIRECTIONS.map((dir) => (
              <button
                key={dir.id}
                type="button"
                onClick={() => onLoadDirectionChange(dir.id)}
                className={clsx(
                  "p-3 rounded-lg border-2 transition-all text-left",
                  loadDirection === dir.id
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                )}
              >
                <span className="text-lg">{dir.icon}</span>
                <p className="text-xs font-medium text-slate-900 dark:text-slate-100 mt-1.5">
                  {dir.name}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {dir.shortDesc}
                </p>
              </button>
            ))}
          </div>

          {/* Load description textarea (appears when load direction selected) */}
          {loadDirection && (
            <div className="pt-2">
              <label className="block text-xs font-medium text-slate-900 dark:text-slate-100 mb-1.5">
                Load Context
                <span className="text-slate-400 dark:text-slate-500 font-normal ml-1">
                  ({loadDescription?.length || 0} / 75 chars)
                </span>
              </label>
              <textarea
                value={loadDescription || ""}
                onChange={(e) => onLoadDescriptionChange(e.target.value.slice(0, 75))}
                placeholder="e.g., 'Suspends 5kg weight', 'Repeated bending 1000x/day', etc."
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 resize-none text-xs"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Optional — helps Claude assess if your current orientation is optimal
              </p>
            </div>
          )}

          {/* Clear button (when functional and expanded) */}
          {isFunctional && loadDirection && (
            <button
              type="button"
              onClick={() => {
                onLoadDirectionChange(undefined);
                onLoadDescriptionChange("");
                setIsExpanded(false);
              }}
              className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
            >
              Clear load direction
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
