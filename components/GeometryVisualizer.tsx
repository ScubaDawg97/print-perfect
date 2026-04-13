"use client";

import dynamic from "next/dynamic";
import type { GeometryAnalysis } from "@/lib/types";
import { estimateFilamentUsage } from "@/lib/ruleEngine";
import clsx from "clsx";

// Load Three.js viewer client-side only (no SSR)
const ModelViewer = dynamic(() => import("./ModelViewer"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-56 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse flex items-center justify-center text-slate-400 text-sm">
      Loading 3D viewer…
    </div>
  ),
});

interface Props {
  geometry: GeometryAnalysis;
  meshVertices?: Float32Array;
  /** When provided, Volume is replaced with estimated weight + filament length. */
  filamentType?: string;
  /** Infill percentage (0–100). Used with filamentType for usage estimate. */
  infillPct?: number;
}

const OVERHANG_STYLES = {
  none:     { bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-800", dot: "bg-emerald-500", label: "No significant overhangs" },
  minor:    { bg: "bg-sky-50 dark:bg-sky-900/20",         text: "text-sky-700 dark:text-sky-400",         border: "border-sky-200 dark:border-sky-800",         dot: "bg-sky-400",     label: "Minor overhangs (< 30°)"     },
  moderate: { bg: "bg-amber-50 dark:bg-amber-900/20",     text: "text-amber-700 dark:text-amber-400",     border: "border-amber-200 dark:border-amber-800",     dot: "bg-amber-400",   label: "Moderate overhangs past 45°" },
  severe:   { bg: "bg-orange-50 dark:bg-orange-900/20",   text: "text-orange-700 dark:text-orange-400",   border: "border-orange-200 dark:border-orange-800",   dot: "bg-orange-500",  label: "Severe overhangs — supports needed" },
};

const COMPLEXITY_ICONS = { simple: "🟢", moderate: "🟡", complex: "🔴" };

export default function GeometryVisualizer({ geometry, meshVertices, filamentType, infillPct }: Props) {
  const { dimensions, volume, surfaceArea, triangleCount, overhangSeverity, complexity, complexityReason, wasAutoOriented } = geometry;
  const overhangStyle = OVERHANG_STYLES[overhangSeverity];

  // Compute filament usage when caller supplies filament info
  const usage = filamentType != null && infillPct != null
    ? estimateFilamentUsage(volume, surfaceArea, filamentType, infillPct)
    : null;

  return (
    <div className="space-y-4">
      {/* 3D model viewer */}
      {meshVertices && meshVertices.length > 0 ? (
        <ModelViewer meshVertices={meshVertices} className="w-full h-56 sm:h-64" />
      ) : null}

      {/* Auto-orient note */}
      {wasAutoOriented && (
        <div className="flex items-center gap-2 rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-900/20 px-3 py-2 text-xs text-sky-700 dark:text-sky-400">
          <span>🔄</span>
          <span>Model auto-oriented to optimal build plate position</span>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatBadge
          label="Dimensions"
          value={`${dimensions.x} × ${dimensions.y} × ${dimensions.z} mm`}
          icon="📐"
        />

        {usage ? (
          <StatBadge
            label="Filament (est.)"
            value={`~${usage.weightGrams}g · ~${usage.lengthMeters}m`}
            icon="🧵"
            sub={`at ${infillPct}% infill`}
          />
        ) : (
          <StatBadge
            label="Volume"
            value={`${volume} cm³`}
            icon="📦"
          />
        )}

        <StatBadge
          label="Triangle count"
          value={triangleCount.toLocaleString()}
          icon="△"
          sub="mesh resolution"
        />

        {/* Complexity with explanation */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-2.5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Complexity</p>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5 flex items-center gap-1">
            {COMPLEXITY_ICONS[complexity]}
            {complexity.charAt(0).toUpperCase() + complexity.slice(1)}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 leading-tight">{complexityReason}</p>
        </div>
      </div>

      {/* Overhang badge */}
      <div
        className={clsx(
          "rounded-xl border px-4 py-3 flex items-center gap-3",
          overhangStyle.bg,
          overhangStyle.border
        )}
      >
        <span className={clsx("w-2.5 h-2.5 rounded-full flex-shrink-0", overhangStyle.dot)} />
        <div className="flex-1 min-w-0">
          <span className={clsx("text-sm font-semibold", overhangStyle.text)}>
            {overhangStyle.label}
          </span>
          {geometry.overhangPercentage > 0 && (
            <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">
              ({geometry.overhangPercentage}% of faces face downward)
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function StatBadge({ label, value, icon, sub }: { label: string; value: string; icon: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-2.5">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5 flex items-center gap-1">
        <span>{icon}</span>
        <span className="truncate">{value}</span>
      </p>
      {sub && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}
