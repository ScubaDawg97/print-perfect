"use client";

import type { GeometryAnalysis } from "@/lib/types";
import { getShrinkageForFilament, calculateScaleFactor, generateHoleCompensationTable, shrinkageSignificance } from "@/lib/shrinkageCompensation";
import clsx from "clsx";

interface DimensionalAccuracyProps {
  filamentType: string;
  geometry: GeometryAnalysis;
  structuralAssessment?: {
    materialSuitability?: string;
    geometryConsiderations?: string;
    estimatedDimensionalVariation?: string;
  } | null;
}

export default function DimensionalAccuracy({
  filamentType,
  geometry,
  structuralAssessment,
}: DimensionalAccuracyProps) {
  const { xyMid, zMid, data } = getShrinkageForFilament(filamentType);
  const scaleFactorXY = calculateScaleFactor(xyMid);
  const scaleFactorZ = calculateScaleFactor(zMid);
  const holeTable = generateHoleCompensationTable(xyMid);
  const significance = shrinkageSignificance(xyMid);

  // Determine primary dimension for layer orientation guidance
  const isZLayered = geometry.dimensions.z >= geometry.dimensions.x && geometry.dimensions.z >= geometry.dimensions.y;
  const isPrecisionCritical = geometry.complexity === "complex"; // Complex geometries need careful attention

  // Material-specific guidance
  const materialNotes: Record<string, { warning?: string; tips: string[] }> = {
    PLA: {
      tips: [
        "Shrinkage is minimal — often negligible for non-precision parts",
        "Compensation is optional for most hobby prints",
        "Consider skipping compensation for decorative prints",
      ],
    },
    "PLA+": {
      tips: [
        "Slightly higher shrinkage than standard PLA",
        "Still minimal for most applications",
        "Compensation recommended for functional parts with tight tolerances",
      ],
    },
    "PLA-CF": {
      tips: [
        "Carbon fiber significantly reduces shrinkage",
        "More dimensionally stable than standard PLA",
        "Excellent for structural parts requiring precision",
      ],
    },
    PETG: {
      warning: "Moderate shrinkage — account for this in tolerance calculations",
      tips: [
        "Shrinkage increases with print temperature and cooling rate",
        "Higher cooling fan speeds reduce shrinkage slightly",
        "Bed temperature drift during print can increase variation",
      ],
    },
    "PETG-CF": {
      tips: [
        "Carbon fiber moderates shrinkage compared to standard PETG",
        "Good balance of dimensional stability and strength",
        "Reliable for functional parts with moderate tolerances",
      ],
    },
    ABS: {
      warning: "Significant shrinkage — compensation is strongly recommended",
      tips: [
        "ABS shrinkage is the highest of common FDM materials",
        "Enclosed chamber prevents drafts and reduces variation",
        "Higher print temperatures slightly increase shrinkage",
        "Cooling rate during print affects final dimensions substantially",
      ],
    },
    ASA: {
      warning: "High shrinkage — plan for compensation",
      tips: [
        "Similar to ABS but slightly less shrinkage",
        "Requires careful temperature control",
        "Moisture absorption can increase dimensional variation",
      ],
    },
    TPU: {
      warning: "Highly variable shrinkage depending on shore hardness",
      tips: [
        "Different hardness grades shrink differently",
        "Check your specific filament's technical data sheet",
        "Flexible prints are inherently more variable",
      ],
    },
    Nylon: {
      warning: "Highest shrinkage of all FDM materials — compensation essential",
      tips: [
        "Nylon is hygroscopic (absorbs moisture from air)",
        "Store in dry environment; use desiccant storage",
        "Moisture content affects shrinkage significantly",
        "Post-print cooling duration impacts final dimensions",
      ],
    },
    PC: {
      warning: "High shrinkage — compensation required",
      tips: [
        "Polycarbonate requires careful thermal management",
        "Very slow cooling increases shrinkage",
        "High print temperatures are necessary",
        "Chamber enclosure helps reduce variation",
      ],
    },
  };

  const notes = materialNotes[filamentType] || { tips: ["Check filament technical data for shrinkage rates"] };

  return (
    <div className="card overflow-hidden border-l-4" style={{ borderLeftColor: "#DC2626" }}>
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700">
        <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
          <span>📏</span> Dimensional Accuracy & Shrinkage Compensation
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
          Structural prints require high dimensional accuracy. This section guides you through compensating for material shrinkage.
        </p>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Scale Compensation Section */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Scale Compensation
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3.5 border border-slate-200 dark:border-slate-700">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">XY Shrinkage (horizontal)</p>
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{xyMid.toFixed(1)}%</p>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5">
                Scale your model to <strong>{scaleFactorXY.toFixed(1)}%</strong> in your slicer
              </p>
              {data.note && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 italic">{data.note}</p>
              )}
            </div>

            <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3.5 border border-slate-200 dark:border-slate-700">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Z Shrinkage (vertical layers)</p>
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{zMid.toFixed(1)}%</p>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5">
                Z shrinkage is typically {zMid < xyMid ? "less" : "similar to"} XY shrinkage
              </p>
            </div>
          </div>

          <div
            className={clsx(
              "rounded-lg p-3.5 border text-xs",
              significance === "significant"
                ? "bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300"
                : significance === "moderate"
                ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300"
                : "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
            )}
          >
            {significance === "significant" && (
              <p>
                <strong>⚠️ Significant shrinkage:</strong> Compensation is essential for dimensional accuracy. Apply scale factor in your slicer before printing.
              </p>
            )}
            {significance === "moderate" && (
              <p>
                <strong>~ Moderate shrinkage:</strong> Compensation is recommended if tolerances are tight (&lt;0.5mm). Optional for looser fit.
              </p>
            )}
            {significance === "minimal" && (
              <p>
                <strong>✓ Minimal shrinkage:</strong> Compensation is usually optional. Consider skipping for non-precision prints.
              </p>
            )}
          </div>
        </div>

        {/* Hole Compensation Table */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Common Hole Sizes (with compensation)
          </p>
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left px-3 py-2.5 font-semibold text-slate-700 dark:text-slate-300">Nominal Size</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-slate-700 dark:text-slate-300">Compensated Size</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {holeTable.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="text-left px-3 py-2.5 text-slate-700 dark:text-slate-300 font-medium">{row.nominal}</td>
                    <td className="text-right px-3 py-2.5 text-slate-600 dark:text-slate-400">{row.compensated}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Add the compensation value to your hole diameters. For example, a 5mm hole becomes {(5 + (xyMid / 2)).toFixed(2)}mm.
          </p>
        </div>

        {/* Layer Orientation Guidance */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Layer Orientation
          </p>
          <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3.5 text-xs text-blue-700 dark:text-blue-300">
            {isZLayered ? (
              <>
                <p className="font-medium mb-1">ℹ️ Z-axis dominant</p>
                <p>
                  Your model is taller than it is wide. Z shrinkage will affect <strong>height</strong> more than horizontal dimensions. Consider this when designing mating parts or joints.
                </p>
              </>
            ) : (
              <>
                <p className="font-medium mb-1">ℹ️ XY-dominant</p>
                <p>
                  Your model is wider than it is tall. XY shrinkage will be the primary concern. Ensure your compensation accounts for this in width and depth dimensions.
                </p>
              </>
            )}

            {isPrecisionCritical && (
              <p className="mt-2 font-medium text-blue-800 dark:text-blue-200">
                ⚠️ Complex geometry detected: Shrinkage is especially critical for accurate mating parts.
              </p>
            )}
          </div>
        </div>

        {/* Material-Specific Notes */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            {filamentType}-Specific Guidance
          </p>

          {notes.warning && (
            <div className="rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 p-3.5">
              <p className="text-xs text-rose-700 dark:text-rose-300 font-medium">{notes.warning}</p>
            </div>
          )}

          <ul className="space-y-1.5">
            {notes.tips.map((tip, idx) => (
              <li key={idx} className="flex gap-2 text-xs text-slate-600 dark:text-slate-400">
                <span className="text-slate-400 dark:text-slate-600 flex-shrink-0 mt-0.5">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Structural Assessment (if provided) */}
        {structuralAssessment?.materialSuitability && (
          <div className="space-y-2 border-t border-slate-200 dark:border-slate-700 pt-4">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Structural Suitability
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {structuralAssessment.materialSuitability}
            </p>
          </div>
        )}

        {structuralAssessment?.estimatedDimensionalVariation && (
          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3.5 border border-slate-200 dark:border-slate-700">
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Estimated Dimensional Variation</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {structuralAssessment.estimatedDimensionalVariation}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
