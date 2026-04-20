/**
 * Shrinkage compensation data for 3D printed materials.
 * Used to calculate scale factors and hole compensation for structural prints.
 *
 * Shrinkage rates (XY and Z) are given as percentages.
 * Based on typical values for common 3D printing filaments.
 */

export interface ShrinkageData {
  xyMin: number;    // Minimum XY shrinkage percentage
  xyMax: number;    // Maximum XY shrinkage percentage
  zMin: number;     // Minimum Z shrinkage percentage
  zMax: number;     // Maximum Z shrinkage percentage
  note?: string;    // Optional contextual note
}

export const SHRINKAGE_RATES: Record<string, ShrinkageData> = {
  PLA: {
    xyMin: 0.3, xyMax: 0.5,
    zMin: 0.2, zMax: 0.3,
    note: "Usually ignorable for non-precision parts",
  },
  "PLA+": {
    xyMin: 0.3, xyMax: 0.5,
    zMin: 0.2, zMax: 0.3,
  },
  "PLA Silk": {
    xyMin: 0.3, xyMax: 0.5,
    zMin: 0.2, zMax: 0.3,
  },
  "PLA Matte": {
    xyMin: 0.3, xyMax: 0.5,
    zMin: 0.2, zMax: 0.3,
  },
  "PLA-CF": {
    xyMin: 0.2, xyMax: 0.3,
    zMin: 0.1, zMax: 0.2,
    note: "Carbon fiber reduces shrinkage significantly",
  },
  PETG: {
    xyMin: 0.4, xyMax: 0.6,
    zMin: 0.3, zMax: 0.4,
  },
  "PETG-CF": {
    xyMin: 0.2, xyMax: 0.4,
    zMin: 0.2, zMax: 0.3,
  },
  ABS: {
    xyMin: 0.7, xyMax: 0.9,
    zMin: 0.4, zMax: 0.6,
    note: "Highest shrinkage — always compensate",
  },
  ASA: {
    xyMin: 0.6, xyMax: 0.8,
    zMin: 0.4, zMax: 0.5,
  },
  TPU: {
    xyMin: 0.5, xyMax: 1.5,
    zMin: 0.3, zMax: 0.8,
    note: "Highly variable by shore hardness",
  },
  Nylon: {
    xyMin: 1.0, xyMax: 2.0,
    zMin: 0.5, zMax: 1.0,
    note: "Highest of all — moisture affects this",
  },
  PC: {
    xyMin: 0.5, xyMax: 0.7,
    zMin: 0.3, zMax: 0.5,
  },
};

/**
 * Calculate shrinkage compensation scale factor.
 * Scale = 1 / (1 - shrinkage_rate)
 * Returns the percentage to scale the model (e.g., 100.8 means 100.8%)
 */
export function calculateScaleFactor(shrinkagePercent: number): number {
  const shrinkageDecimal = shrinkagePercent / 100;
  const scaleFactor = 1 / (1 - shrinkageDecimal);
  return Math.round(scaleFactor * 1000) / 10; // Return as percentage with 1 decimal
}

/**
 * Calculate hole compensation (added to hole diameter to account for shrinkage).
 * Compensation = model_dimension × (shrinkage_percent / 2)
 * Division by 2 because shrinkage affects radius from both sides.
 */
export function calculateHoleCompensation(shrinkagePercent: number): number {
  return Math.round((shrinkagePercent / 2) * 100) / 100; // mm compensation, 2 decimals
}

/**
 * Get shrinkage data for a filament type, return midpoint of range.
 */
export function getShrinkageForFilament(filamentType: string): { xyMid: number; zMid: number; data: ShrinkageData } {
  const data = SHRINKAGE_RATES[filamentType] ?? SHRINKAGE_RATES.PLA;
  return {
    xyMid: (data.xyMin + data.xyMax) / 2,
    zMid: (data.zMin + data.zMax) / 2,
    data,
  };
}

/**
 * Determine if shrinkage compensation is significant enough to recommend.
 * PLA/PLA variants < 0.4% XY shrinkage = minimal, can suggest skipping.
 * ABS/Nylon > 0.7% = significant, strongly recommend.
 */
export function shrinkageSignificance(xyMid: number): "minimal" | "moderate" | "significant" {
  if (xyMid < 0.4) return "minimal";
  if (xyMid < 0.7) return "moderate";
  return "significant";
}

/**
 * Generate sample hole compensation values for a filament.
 * Shows what common bolt hole sizes become when compensated.
 */
export function generateHoleCompensationTable(xyMid: number): Array<{
  nominal: string;
  compensated: string;
}> {
  const compensation = calculateHoleCompensation(xyMid);
  return [
    { nominal: "3mm", compensated: `${(3 + compensation).toFixed(2)}mm` },
    { nominal: "5mm", compensated: `${(5 + compensation).toFixed(2)}mm` },
    { nominal: "10mm", compensated: `${(10 + compensation).toFixed(2)}mm` },
    { nominal: "M3 thread", compensated: `+${compensation.toFixed(2)}mm` },
  ];
}
