export interface GeometryAnalysis {
  dimensions: { x: number; y: number; z: number }; // mm
  volume: number; // cm³
  surfaceArea: number; // mm²
  baseSurfaceArea: number; // mm² (faces near Z=0)
  triangleCount: number;
  overhangPercentage: number; // % of downward-facing faces
  hasSignificantOverhangs: boolean; // any face past 45°
  overhangSeverity: "none" | "minor" | "moderate" | "severe";
  complexity: "simple" | "moderate" | "complex";
  complexityReason: string;
  fileName: string;
  fileType: "stl" | "obj" | "3mf";
  wasAutoOriented: boolean; // true if mesh was rotated to optimal build-plate position
}

export interface UserInputs {
  printerModel: string;
  filamentType: "PLA" | "PLA+" | "PLA Silk" | "PLA-CF" | "PETG" | "PETG-CF" | "ABS" | "ASA" | "TPU" | "Nylon" | "PC" | "Resin";
  filamentBrand: string;
  nozzleDiameter: 0.2 | 0.4 | 0.6 | 0.8;
  bedSurface: string; // flexible — see BED_SURFACE_GROUPS in InputForm for valid values
  humidity: "Low" | "Normal" | "High";
  /** Quality tier. Strength is now handled by isFunctional (+10% infill, +1 wall). */
  printPriority: "Draft" | "Standard" | "Quality" | "Ultra";
  isFunctional: boolean;
}

export interface PrintSettings {
  layerHeight: number; // mm
  printTemp: number; // °C
  bedTemp: number; // °C
  printSpeed: number; // mm/s
  coolingFan: number; // %
  infill: number; // %
  supportType: "None" | "Normal" | "Tree";
  supportDensity: number; // %
  adhesion: "None" | "Brim" | "Raft";
  adhesionWidth: number; // mm
  wallCount: number;
  topBottomLayers: number;
}

export type ConfidenceLevel = "high" | "medium" | "low";

export interface AIEnhancements {
  geometrySummary: string;
  settingExplanations: {
    layerHeight: string;
    printTemp: string;
    bedTemp: string;
    printSpeed: string;
    coolingFan: string;
    infill: string;
    supports: string;
    adhesion: string;
    walls: string;
  };
  settingConfidence: {
    layerHeight: ConfidenceLevel;
    printTemp: ConfidenceLevel;
    bedTemp: ConfidenceLevel;
    printSpeed: ConfidenceLevel;
    coolingFan: ConfidenceLevel;
    infill: ConfidenceLevel;
    supports: ConfidenceLevel;
    adhesion: ConfidenceLevel;
    walls: ConfidenceLevel;
  };
  watchOutFor: string[];
  tipsForSuccess: string[];
  commonMistakes: string[];
  /** 2-3 plain-English sentences about the filament material type. Used in the FilamentShowcaseCard. */
  materialBlurb?: string;
  _debugPrompt?: string;
}

export interface Recommendation {
  settings: PrintSettings;
  aiEnhancements: AIEnhancements;
  estimatedPrintTimeMin: number;
  estimatedPrintTimeMax: number;
}

export type AppStep = "upload" | "form" | "loading" | "results";

// ─── Print session history ────────────────────────────────────────────────────

export type OutcomeFlag = "success" | "partial" | "failed" | null;

export interface PrintOutcome {
  stars: 1 | 2 | 3 | 4 | 5 | null;
  note: string | null;
  updatedAt: string | null; // ISO timestamp
  /** Optional — not present on sessions saved before v1.2.0 */
  outcomeFlag?: OutcomeFlag;
}

export interface PrintSession {
  id: string;            // crypto.randomUUID()
  savedAt: string;       // ISO timestamp
  name: string;          // user-editable; default: "<filename> — <tier>"
  geometry: GeometryAnalysis;
  inputs: UserInputs;
  settings: PrintSettings;
  advancedSettings: AdvancedSettings;
  ai: AIEnhancements;
  filamentDBResult: FilamentDBResult | null;
  printTimeMin: number;
  printTimeMax: number;
  multiObjectWarning: boolean;
  outcome: PrintOutcome;
}

// ─── Open Filament Database ───────────────────────────────────────────────────

export interface AdvancedSettings {
  // Print speed panel
  outerWallSpeed: number;      // mm/s
  innerWallSpeed: number;      // mm/s
  topBottomSpeed: number;      // mm/s
  firstLayerSpeed: number;     // mm/s
  bridgeSpeed: number;         // mm/s
  travelSpeed: number;         // mm/s

  // Temperature panel
  firstLayerTemp: number;                    // °C
  standbyTemp: number;                       // °C
  chamberTempRecommendation: string | null;  // null if not applicable
  tempTowerMin: number;                      // °C
  tempTowerMax: number;                      // °C

  // Supports panel
  supportZDistance: number;       // mm
  supportInterfaceLayers: number;
  interfaceSpacing: number;       // mm
  horizontalExpansion: number;    // mm
  supportPattern: "Grid" | "Tree";
  supportRoofEnabled: boolean;

  // Cooling panel
  minLayerTime: number;     // seconds
  fanRampUp: string;        // human-readable description
  bridgeFanOverride: number; // %
  overhangFanBoost: number;  // %

  // Bed & adhesion panel
  firstLayerHeight: number;          // mm
  elephantFootCompensation: number;  // mm
  brimGap: number | null;            // mm — null if no brim
  skirtLines: number;
}

export interface FilamentDBResult {
  name: string;
  manufacturer: string;
  material: string;
  printTempMin: number;
  printTempMax: number;
  bedTempMin: number;
  bedTempMax: number;
  dataUrl: string; // link to entry on openfilamentdatabase.org
  // Extended fields — present only when the OFD API returns them
  diameter?: number;   // mm (e.g. 1.75)
  density?: number;    // g/cm³ (e.g. 1.24)
  color?: string;      // color name (e.g. "Fire Engine Red")
  finish?: string;     // surface finish (e.g. "Silk", "Matte", "Glossy")
  tags?: string[];     // special flags: e.g. ["food safe", "abrasive", "flexible"]
}
