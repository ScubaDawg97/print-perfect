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
  orientationReason?: string; // why orientation was chosen (e.g. "already well-oriented", "optimal multi-candidate", "container detected")
  orientationWarning?: string | null; // cautions about the orientation
  isDetectedContainer?: boolean; // true if container/hollow geometry detected
}

export interface UserInputs {
  printerModel: string;
  filamentType: "PLA" | "PLA+" | "PLA Silk" | "PLA Matte" | "PLA-CF" | "PETG" | "PETG-CF" | "ABS" | "ASA" | "TPU" | "Nylon" | "PC" | "Resin";
  filamentBrand: string;
  nozzleDiameter: 0.2 | 0.4 | 0.6 | 0.8;
  /** Nozzle material affects temperature, speed, and abrasive-filament capability */
  nozzleMaterial: "brass" | "hardened_steel" | "stainless_steel" | "ruby_tipped" | "tungsten_carbide" | "copper_plated";
  /** Nozzle type affects flow capability and melt characteristics */
  nozzleType: "standard" | "cht" | "volcano" | "induction" | "quick_swap";
  /** Flow rate capability affects maximum volumetric speed */
  flowRate: "standard_flow" | "high_flow";
  bedSurface: string; // flexible — see BED_SURFACE_GROUPS in InputForm for valid values
  humidity: "Low" | "Normal" | "High";
  /** Quality tier. Strength is now handled by isFunctional (+10% infill, +1 wall). */
  printPriority: "Draft" | "Standard" | "Quality" | "Ultra";
  isFunctional: boolean;
  /** Optional user-described problem (max 75 chars). Used to tailor recommendations. */
  problemDescription: string;
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

// ─── Concern Response ────────────────────────────────────────────────────────

export type ConcernClassification = "settings_fixable" | "partially_settings" | "hardware_maintenance" | "unclear";

export interface ConcernResponse {
  classification: ConcernClassification;
  directAnswer: string;
  hardwareNote: string | null;
  settingsImpact: string[];
  confidenceNote: string | null;
}

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
  /** 2-4 practical notes specific to this filament+printer setup. Populated from /api/recommend. */
  specialNotes?: string[];
  /** Starting PA/LA range for this filament on this printer. null = not applicable (e.g. TPU). */
  pressureAdvanceRange?: { min: number; max: number } | null;
  /** Concern response when user described a specific problem. null when no problem described. */
  concernResponse?: ConcernResponse | null;
  /** Equipment display name for printer (looked up from UUID by API). Used in results header. */
  _printerModelName?: string;
  /** Equipment display name for bed surface (looked up from UUID by API). Used in results header. */
  _bedSurfaceName?: string;
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
  /** Computed filament property details panel data. Optional — absent on sessions saved before v1.7.0. */
  filamentPropertyDetails?: FilamentPropertyDetails;
  /** Concern response when user described a problem. Optional — absent on sessions saved before v1.8.0. */
  concernResponse?: ConcernResponse | null;
}

// ─── Filament Property Details ────────────────────────────────────────────────

export interface FilamentPropertyDetails {
  // Temperature Profile
  printTempMin: number;         // °C — lower end of material print range
  printTempMax: number;         // °C — upper end of material print range
  recommendedPrintTemp: number; // °C — the value used for this print
  firstLayerTemp: number;       // °C
  standbyTemp: number;          // °C
  tempTowerMin: number;         // °C
  tempTowerMax: number;         // °C

  // Cooling Settings
  coolingFanPct: number;        // %
  minLayerTimeSec: number;      // seconds
  fanRampStrategy: string;      // human-readable
  bridgeFanOverridePct: number; // %
  overhangFanBoostPct: number;  // %

  // Retraction Settings
  retractionDirectDriveMm: number; // mm — for direct-drive extruders
  retractionBowdenMm: number;      // mm — for Bowden setups
  retractionSpeedMms: number;      // mm/s
  zHopMm: number;                  // mm

  // Pressure Advance / Linear Advance
  pressureAdvanceRange: { min: number; max: number } | null; // null = not applicable
  pressureAdvanceNote: string;  // context / tuning guidance

  // Filament Physical Properties
  densityGcm3: number;          // g/cm³
  diameterMm: number;           // mm (typically 1.75)
  materialDescription: string;  // plain-English summary of the material

  // OFD source flags — true when the value came from Open Filament Database
  ofdPrintTempRange: boolean;
  ofdDensity: boolean;
  ofdDiameter: boolean;

  // AI-generated
  specialNotes: string[];       // 2-4 notes specific to this filament+setup
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
