import type { GeometryAnalysis, UserInputs, PrintSettings, AdvancedSettings, FilamentDBResult, FilamentPropertyDetails } from "./types";

// ─── Filament density table (g/cm³) ──────────────────────────────────────────

const FILAMENT_DENSITY: Record<string, number> = {
  PLA:        1.24,
  "PLA+":     1.24,
  "PLA Silk": 1.24,
  "PLA-CF":   1.30,
  PETG:       1.27,
  "PETG-CF":  1.35,
  ABS:        1.05,
  ASA:        1.07,
  TPU:        1.21,
  Nylon:      1.14,
  PC:         1.20,
  Resin:      1.10,
};

/**
 * Estimates filament weight (g) and length (m) for a model.
 *
 * Shell volume (outer walls + top/bottom) prints at 100% density regardless
 * of infill. Everything inside is modulated by infillPct.
 *
 * @param volumeCm3      Solid mesh volume in cm³
 * @param surfaceAreaMm2 Total surface area in mm²
 * @param filamentType   Filament material key
 * @param infillPct      Infill percentage (0–100)
 * @param wallCount      Number of perimeter walls (default 3)
 * @param nozzleDiamMm   Nozzle diameter in mm (default 0.4)
 */
export function estimateFilamentUsage(
  volumeCm3: number,
  surfaceAreaMm2: number,
  filamentType: string,
  infillPct: number,
  wallCount = 3,
  nozzleDiamMm = 0.4
): { weightGrams: number; lengthMeters: number } {
  const density = FILAMENT_DENSITY[filamentType] ?? 1.24;

  // Shell: surface_area × shell_thickness, capped at 95% of total volume
  const shellThicknessMm = wallCount * nozzleDiamMm;          // e.g. 3 × 0.4 = 1.2 mm
  const shellVolumeCm3 = Math.min(
    (surfaceAreaMm2 * shellThicknessMm) / 1000,                // mm² × mm → mm³ → cm³
    volumeCm3 * 0.95
  );

  // Interior (everything inside the shell) filled at infillPct
  const innerVolumeCm3 = Math.max(0, volumeCm3 - shellVolumeCm3);
  const effectiveVolumeCm3 = shellVolumeCm3 + innerVolumeCm3 * (infillPct / 100);

  // Weight
  const weightGrams = Math.round(effectiveVolumeCm3 * density);

  // Filament length: volume_cm3 / cross-section_cm2
  // 1.75 mm filament → radius = 0.875 mm = 0.0875 cm
  const filamentRadiusCm = 0.0875;
  const crossSectionCm2 = Math.PI * filamentRadiusCm * filamentRadiusCm; // ≈ 0.02405 cm²
  const lengthCm = effectiveVolumeCm3 / crossSectionCm2;
  const lengthMeters = Math.round((lengthCm / 100) * 10) / 10;  // 1 decimal place

  return { weightGrams, lengthMeters };
}

// ─── Bed surface normalisation ────────────────────────────────────────────────

function normaliseBed(surface: string): string {
  const s = surface.toLowerCase();
  if (s.includes("cool plate")) return "CoolPlate";
  if (s.includes("engineering plate")) return "EngineeringPlate";
  if (s.includes("high-temp plate")) return "HighTempPlate";
  if (s.includes("garolite")) return "Garolite";
  if (s.includes("supertack") || s.includes("super tack")) return "SuperTack";
  if (s.includes("carborundum")) return "Carborundum";
  if (s.includes("glass")) return "Glass";
  if (s.includes("buildtak")) return "BuildTak";
  if (s.includes("wham") || s.includes("magnetic flex") || s.includes("pex")) return "MagFlex";
  if (s.includes("pei") || s.includes("dual-sided")) return "PEI";
  return "PEI";
}

// ─── Per-filament bed temperatures keyed by normalised surface ────────────────

const BED_TEMP_TABLE: Record<string, Record<string, number>> = {
  PLA: {
    PEI: 60, CoolPlate: 55, EngineeringPlate: 55, HighTempPlate: 55,
    Glass: 55, Carborundum: 55, BuildTak: 65, MagFlex: 60,
    Garolite: 60, SuperTack: 55, Other: 60,
  },
  "PLA+": {
    PEI: 60, CoolPlate: 55, EngineeringPlate: 60, HighTempPlate: 60,
    Glass: 55, Carborundum: 55, BuildTak: 65, MagFlex: 60,
    Garolite: 60, SuperTack: 55, Other: 60,
  },
  // PLA Silk needs slightly higher bed temp for better adhesion
  "PLA Silk": {
    PEI: 65, CoolPlate: 60, EngineeringPlate: 60, HighTempPlate: 60,
    Glass: 60, Carborundum: 60, BuildTak: 70, MagFlex: 65,
    Garolite: 65, SuperTack: 60, Other: 65,
  },
  "PLA-CF": {
    PEI: 60, CoolPlate: 55, EngineeringPlate: 60, HighTempPlate: 60,
    Glass: 60, Carborundum: 60, BuildTak: 65, MagFlex: 60,
    Garolite: 60, SuperTack: 60, Other: 60,
  },
  PETG: {
    PEI: 80, CoolPlate: 70, EngineeringPlate: 80, HighTempPlate: 80,
    Glass: 75, Carborundum: 75, BuildTak: 80, MagFlex: 80,
    Garolite: 75, SuperTack: 75, Other: 80,
  },
  "PETG-CF": {
    PEI: 85, CoolPlate: 75, EngineeringPlate: 85, HighTempPlate: 85,
    Glass: 80, Carborundum: 80, BuildTak: 85, MagFlex: 85,
    Garolite: 80, SuperTack: 80, Other: 85,
  },
  ABS: {
    PEI: 105, CoolPlate: 100, EngineeringPlate: 110, HighTempPlate: 110,
    Glass: 100, Carborundum: 100, BuildTak: 100, MagFlex: 100,
    Garolite: 100, SuperTack: 100, Other: 100,
  },
  ASA: {
    PEI: 100, CoolPlate: 95, EngineeringPlate: 105, HighTempPlate: 105,
    Glass: 100, Carborundum: 100, BuildTak: 100, MagFlex: 100,
    Garolite: 100, SuperTack: 100, Other: 100,
  },
  TPU: {
    PEI: 30, CoolPlate: 25, EngineeringPlate: 35, HighTempPlate: 35,
    Glass: 30, Carborundum: 30, BuildTak: 40, MagFlex: 35,
    Garolite: 30, SuperTack: 25, Other: 35,
  },
  Nylon: {
    PEI: 70, CoolPlate: 70, EngineeringPlate: 80, HighTempPlate: 80,
    Glass: 70, Carborundum: 70, BuildTak: 75, MagFlex: 70,
    Garolite: 85, SuperTack: 70, Other: 70,
  },
  PC: {
    PEI: 110, CoolPlate: 110, EngineeringPlate: 115, HighTempPlate: 120,
    Glass: 110, Carborundum: 110, BuildTak: 110, MagFlex: 110,
    Garolite: 110, SuperTack: 110, Other: 110,
  },
  Resin: {
    PEI: 0, CoolPlate: 0, EngineeringPlate: 0, HighTempPlate: 0,
    Glass: 0, Carborundum: 0, BuildTak: 0, MagFlex: 0,
    Garolite: 0, SuperTack: 0, Other: 0,
  },
};

// ─── Quality tier parameters ──────────────────────────────────────────────────
//
// These are the canonical values for each tier at a 0.4 mm nozzle.
// Layer height is expressed as a ratio of nozzle diameter so it scales for
// users with 0.2 / 0.6 / 0.8 mm nozzles.
//
// Infill values are for decorative prints; isFunctional adds +10%.

const TIER_LAYER_RATIO: Record<string, number> = {
  Draft:    0.70,  // → 0.28 mm at 0.4 mm nozzle
  Standard: 0.50,  // → 0.20 mm
  Quality:  0.30,  // → 0.12 mm
  Ultra:    0.20,  // → 0.08 mm
};

const TIER_SPEED: Record<string, number> = {
  Draft:    90,
  Standard: 55,
  Quality:  40,
  Ultra:    25,
};

const TIER_INFILL_DECORATIVE: Record<string, number> = {
  Draft:    12,
  Standard: 18,
  Quality:  22,
  Ultra:    27,
};

const TIER_WALLS: Record<string, number> = {
  Draft:    2,
  Standard: 3,
  Quality:  3,
  Ultra:    4,
};

const TIER_TOP_BOTTOM: Record<string, number> = {
  Draft:    3,
  Standard: 4,
  Quality:  5,
  Ultra:    5,
};

export function computeSettings(
  geometry: GeometryAnalysis,
  inputs: UserInputs
): PrintSettings {
  const { filamentType, nozzleDiameter, printPriority, isFunctional, humidity, bedSurface } = inputs;
  const normSurface = normaliseBed(bedSurface);

  // ── Layer height ───────────────────────────────────────────────────────────
  let layerRatio = TIER_LAYER_RATIO[printPriority] ?? 0.50;
  // Don't go finer than 0.30 ratio on complex geometry (too slow, risk of fails)
  if (geometry.complexity === "complex") layerRatio = Math.min(layerRatio, 0.50);
  const layerHeight = Math.round(nozzleDiameter * layerRatio * 100) / 100;

  // ── Print temperature ──────────────────────────────────────────────────────
  const baseTemps: Record<string, number> = {
    PLA: 210, "PLA+": 215, "PLA Silk": 230, "PLA-CF": 220,
    PETG: 240, "PETG-CF": 250,
    ABS: 245, ASA: 250,
    TPU: 225,
    Nylon: 250, PC: 270,
    Resin: 0,
  };
  let printTemp = baseTemps[filamentType] ?? 210;
  // PLA Silk runs at the high end of its range — no humidity bump needed
  if (humidity === "High" && filamentType !== "PLA Silk") printTemp += 5;

  // ── Bed temperature ────────────────────────────────────────────────────────
  const filamentTable = BED_TEMP_TABLE[filamentType] ?? BED_TEMP_TABLE.PLA;
  const bedTemp = filamentTable[normSurface] ?? filamentTable["PEI"] ?? 60;

  // ── Print speed ────────────────────────────────────────────────────────────
  let printSpeed = TIER_SPEED[printPriority] ?? 55;
  if (geometry.complexity === "complex") printSpeed = Math.round(printSpeed * 0.8);
  // Per-material speed caps
  if (filamentType === "PLA Silk")                           printSpeed = Math.min(printSpeed, 35);
  if (filamentType === "TPU")                                printSpeed = Math.min(printSpeed, 25);
  if (filamentType === "ABS" || filamentType === "ASA")      printSpeed = Math.min(printSpeed, 60);
  if (filamentType === "Nylon" || filamentType === "PC")     printSpeed = Math.min(printSpeed, 50);
  if (filamentType === "Resin")                              printSpeed = 0;

  // ── Cooling fan ────────────────────────────────────────────────────────────
  const coolingMap: Record<string, number> = {
    PLA:        100,
    "PLA+":     100,
    "PLA Silk": 90,   // full cooling preserves the glossy silk finish
    "PLA-CF":   60,
    PETG:       40,
    "PETG-CF":  30,
    ABS:        5,
    ASA:        25,
    TPU:        50,
    Nylon:      20,
    PC:         10,
    Resin:      0,
  };
  const coolingFan = coolingMap[filamentType] ?? 80;

  // ── Infill ─────────────────────────────────────────────────────────────────
  let infill = TIER_INFILL_DECORATIVE[printPriority] ?? 18;
  // Functional parts: +10% on top of tier default
  if (isFunctional) infill += 10;
  // Complex geometry gets an extra bump
  if (geometry.complexity === "complex") infill = Math.min(infill + 5, 80);

  // ── Supports ───────────────────────────────────────────────────────────────
  let supportType: PrintSettings["supportType"] = "None";
  let supportDensity = 0;
  if (geometry.hasSignificantOverhangs) {
    supportType = geometry.complexity === "complex" ? "Tree" : "Normal";
    supportDensity = geometry.overhangSeverity === "severe" ? 20 : 12;
  }

  // ── Bed adhesion ───────────────────────────────────────────────────────────
  const isTallThin =
    geometry.dimensions.z > 100 &&
    (geometry.dimensions.x < 30 || geometry.dimensions.y < 30);

  let adhesion: PrintSettings["adhesion"] = "None";
  let adhesionWidth = 0;

  const needsStrongAdhesion = filamentType === "ABS" || filamentType === "ASA"
    || filamentType === "PC" || filamentType === "Nylon";
  const isGoodSurface  = normSurface === "PEI" || normSurface === "SuperTack";
  const isGlassLike    = normSurface === "Glass" || normSurface === "Carborundum";
  const isCoolPlate    = normSurface === "CoolPlate";
  const isPLAFamily    = filamentType === "PLA" || filamentType === "PLA+" || filamentType === "PLA Silk";

  if (needsStrongAdhesion) {
    adhesion = "Brim";
    adhesionWidth = filamentType === "PC" ? 15 : 10;
  } else if (isTallThin) {
    adhesion = "Brim";
    adhesionWidth = 8;
  } else if (isGlassLike) {
    adhesion = "Brim";
    adhesionWidth = 5;
  } else if (normSurface === "BuildTak") {
    adhesion = "None";
  } else if (isCoolPlate && isPLAFamily) {
    adhesion = "None";  // Cool plate designed for PLA family
  } else if (isGoodSurface && isPLAFamily) {
    adhesion = "None";  // PEI + PLA family = excellent adhesion
  } else if (geometry.baseSurfaceArea < 200) {
    adhesion = "Brim";
    adhesionWidth = 8;
  } else {
    adhesion = "Brim";
    adhesionWidth = 3;
  }

  // ── Walls & top/bottom layers ──────────────────────────────────────────────
  let wallCount = TIER_WALLS[printPriority] ?? 3;
  // Functional parts get an extra wall for strength, capped at 4
  if (isFunctional) wallCount = Math.min(wallCount + 1, 4);

  const topBottomLayers = TIER_TOP_BOTTOM[printPriority] ?? 4;

  return {
    layerHeight,
    printTemp,
    bedTemp,
    printSpeed,
    coolingFan,
    infill,
    supportType,
    supportDensity,
    adhesion,
    adhesionWidth,
    wallCount,
    topBottomLayers,
  };
}

// ─── Advanced settings ────────────────────────────────────────────────────────
//
// Derived from the same inputs and base settings as computeSettings(). Every
// value here is calculated — nothing is hardcoded in isolation.

export function computeAdvancedSettings(
  _geometry: GeometryAnalysis,
  inputs: UserInputs,
  settings: PrintSettings
): AdvancedSettings {
  const { filamentType, printPriority, nozzleDiameter } = inputs;

  // ── Print speed panel ────────────────────────────────────────────────────────
  // Surface speeds are fractions of the base print speed, with sane minimums.
  const outerWallSpeed = Math.max(20, Math.round(settings.printSpeed * 0.50));
  const innerWallSpeed = Math.max(25, Math.round(settings.printSpeed * 0.80));
  const topBottomSpeed = Math.max(20, Math.round(settings.printSpeed * 0.50));
  const firstLayerSpeed = Math.min(25, Math.max(15, Math.round(settings.printSpeed * 0.35)));
  const bridgeSpeed     = Math.min(40, Math.max(20, Math.round(settings.printSpeed * 0.55)));
  // TPU needs slower travel to prevent stringing at filament joints.
  const travelSpeed = filamentType === "TPU" ? 100 : 150;

  // ── Temperature panel ─────────────────────────────────────────────────────────
  const firstLayerTemp = settings.printTemp > 0 ? settings.printTemp + 5 : 0;
  // Standby: keep the nozzle warm during long travel moves; ~85% of print temp.
  const standbyTemp = settings.printTemp > 0
    ? Math.max(100, Math.round(settings.printTemp * 0.85))
    : 0;

  // Temperature tower ranges per material (°C min–max).
  const TEMP_TOWER_RANGES: Record<string, [number, number]> = {
    PLA:        [195, 225],
    "PLA+":     [200, 235],
    "PLA Silk": [220, 245],
    "PLA-CF":   [210, 235],
    PETG:       [230, 255],
    "PETG-CF":  [240, 265],
    ABS:        [235, 260],
    ASA:        [240, 265],
    TPU:        [210, 235],
    Nylon:      [240, 270],
    PC:         [255, 290],
    Resin:      [0, 0],
  };
  const [tempTowerMin, tempTowerMax] = TEMP_TOWER_RANGES[filamentType] ?? [200, 230];

  const HIGH_TEMP_FILAMENTS = ["ABS", "ASA", "PC", "Nylon"];
  const chamberTempRecommendation = HIGH_TEMP_FILAMENTS.includes(filamentType)
    ? (filamentType === "PC" ? "45–60°C" : "40–50°C")
    : null;

  // ── Supports panel ─────────────────────────────────────────────────────────────
  // Z distance equals one layer height — easy to remove, acceptable surface quality.
  const supportZDistance      = settings.layerHeight;
  const supportInterfaceLayers = printPriority === "Draft" ? 1 : 2;
  const interfaceSpacing       = 0.2;
  const horizontalExpansion    = 0.5;
  const supportPattern: "Grid" | "Tree" =
    settings.supportType === "Tree" ? "Tree" : "Grid";
  const supportRoofEnabled = printPriority === "Quality" || printPriority === "Ultra";

  // ── Cooling panel ───────────────────────────────────────────────────────────────
  const MIN_LAYER_TIME_MAP: Record<string, number> = {
    Draft: 8, Standard: 10, Quality: 15, Ultra: 15,
  };
  const minLayerTime = MIN_LAYER_TIME_MAP[printPriority] ?? 10;

  let fanRampUp: string;
  if (settings.coolingFan === 0) {
    fanRampUp = "Fan off for entire print";
  } else if (settings.coolingFan <= 10) {
    fanRampUp = "Minimal fan from layer 5 onward";
  } else if (settings.coolingFan <= 40) {
    fanRampUp = "Ramp to partial speed from layer 3";
  } else {
    fanRampUp = "Full speed from layer 3";
  }

  const bridgeFanOverride = 100;
  const overhangFanBoost  = settings.coolingFan > 0
    ? Math.min(100, settings.coolingFan + 20)
    : 0;

  // ── Bed & adhesion panel ────────────────────────────────────────────────────────
  // First layer height: thicker than layer height regardless of tier, for grip.
  const firstLayerHeight        = Math.round(Math.max(0.2, nozzleDiameter * 0.70) * 100) / 100;
  const elephantFootCompensation = 0.1;
  const brimGap  = settings.adhesion === "Brim" ? 0.1 : null;
  const skirtLines = 2;

  return {
    outerWallSpeed, innerWallSpeed, topBottomSpeed, firstLayerSpeed, bridgeSpeed, travelSpeed,
    firstLayerTemp, standbyTemp, chamberTempRecommendation, tempTowerMin, tempTowerMax,
    supportZDistance, supportInterfaceLayers, interfaceSpacing, horizontalExpansion,
    supportPattern, supportRoofEnabled,
    minLayerTime, fanRampUp, bridgeFanOverride, overhangFanBoost,
    firstLayerHeight, elephantFootCompensation, brimGap, skirtLines,
  };
}

// ─── Filament property details ────────────────────────────────────────────────
//
// Assembles the full FilamentPropertyDetails object from rule-engine values,
// optional OFD data, and optional AI-generated extras (specialNotes, pressureAdvanceRange).
// Geometry is accepted but currently unused — reserved for future geometry-aware tuning.

interface RetractionProfile {
  directDriveMm: number;
  bowdenMm: number;
  speedMms: number;
  zHopMm: number;
}

const RETRACTION_TABLE: Record<string, RetractionProfile> = {
  PLA:        { directDriveMm: 1.0, bowdenMm: 5.0, speedMms: 45, zHopMm: 0.10 },
  "PLA+":     { directDriveMm: 1.0, bowdenMm: 5.0, speedMms: 45, zHopMm: 0.10 },
  "PLA Silk": { directDriveMm: 1.5, bowdenMm: 6.0, speedMms: 35, zHopMm: 0.15 },
  "PLA-CF":   { directDriveMm: 0.8, bowdenMm: 4.5, speedMms: 40, zHopMm: 0.10 },
  PETG:       { directDriveMm: 1.0, bowdenMm: 5.0, speedMms: 30, zHopMm: 0.20 },
  "PETG-CF":  { directDriveMm: 0.8, bowdenMm: 4.0, speedMms: 30, zHopMm: 0.20 },
  ABS:        { directDriveMm: 1.0, bowdenMm: 5.0, speedMms: 40, zHopMm: 0.30 },
  ASA:        { directDriveMm: 1.0, bowdenMm: 5.0, speedMms: 40, zHopMm: 0.30 },
  TPU:        { directDriveMm: 1.0, bowdenMm: 2.0, speedMms: 20, zHopMm: 0.00 },
  Nylon:      { directDriveMm: 1.5, bowdenMm: 6.0, speedMms: 40, zHopMm: 0.20 },
  PC:         { directDriveMm: 1.0, bowdenMm: 5.0, speedMms: 40, zHopMm: 0.30 },
  Resin:      { directDriveMm: 0.0, bowdenMm: 0.0, speedMms: 0,  zHopMm: 0.00 },
};

const PRINT_TEMP_RANGES: Record<string, [number, number]> = {
  PLA:        [195, 225],
  "PLA+":     [200, 235],
  "PLA Silk": [220, 245],
  "PLA-CF":   [210, 235],
  PETG:       [230, 255],
  "PETG-CF":  [240, 265],
  ABS:        [235, 260],
  ASA:        [240, 265],
  TPU:        [210, 235],
  Nylon:      [240, 270],
  PC:         [255, 290],
  Resin:      [0, 0],
};

// Fallback PA/LA starting ranges when AI hasn't provided values
const PA_DEFAULTS: Record<string, [number, number]> = {
  PLA:        [0.03, 0.08],
  "PLA+":     [0.03, 0.08],
  "PLA Silk": [0.05, 0.10],
  "PLA-CF":   [0.02, 0.05],
  PETG:       [0.04, 0.09],
  "PETG-CF":  [0.03, 0.07],
  ABS:        [0.04, 0.09],
  ASA:        [0.04, 0.09],
  Nylon:      [0.03, 0.07],
  PC:         [0.04, 0.09],
};

const PA_NOTES: Record<string, string> = {
  PLA:        "Start around 0.05 (direct drive) or 0.5 (Bowden). Print a PA calibration tower to find your sweet spot.",
  "PLA+":     "Similar to PLA — start around 0.05 (direct drive) or 0.5 (Bowden) and tune from there.",
  "PLA Silk": "Silk PLA typically needs slightly higher PA than standard PLA due to its flow characteristics. Start at 0.06–0.08.",
  "PLA-CF":   "CF filaments build less pressure than standard versions. Start low (~0.03) and increase if you see corner blobs.",
  PETG:       "PETG benefits greatly from PA tuning — it's prone to blobs at corners. Start at 0.05–0.08 on direct drive.",
  "PETG-CF":  "Similar to PETG but stiffer flow. Start at 0.04–0.07 on direct drive and adjust based on corner quality.",
  ABS:        "ABS prints well with moderate PA values. Start at 0.04–0.08 and run a calibration test print.",
  ASA:        "Similar to ABS. Start at 0.04–0.08 on direct drive and tune for your specific printer.",
  TPU:        "Pressure Advance is generally not recommended for flexible filaments — the elasticity makes it counterproductive and can cause jams.",
  Nylon:      "Nylon benefits from PA but is sensitive to over-correction. Start conservative (0.03–0.05) and increase slowly.",
  PC:         "PC works well with PA. Tune carefully at high temperatures — over-correction artifacts can be amplified.",
  Resin:      "Pressure Advance does not apply to resin MSLA/DLP printers.",
};

const MATERIAL_DESCRIPTIONS: Record<string, string> = {
  PLA:        "Polylactic Acid — the most beginner-friendly filament. Biodegradable, low-odor, easy to print. Not suitable for high-heat or outdoor applications.",
  "PLA+":     "Enhanced PLA with improved impact resistance and slightly better heat tolerance than standard PLA. Same ease of printing.",
  "PLA Silk": "PLA blended with metallic pigments for a glossy, silk-like finish. Prints slower than standard PLA for best results.",
  "PLA-CF":   "Carbon-fiber reinforced PLA — stiffer and stronger than standard PLA. Abrasive; requires a hardened steel or ruby nozzle.",
  PETG:       "Polyethylene Terephthalate Glycol — stronger and more heat-resistant than PLA with good chemical resistance. Food-safe variants exist.",
  "PETG-CF":  "Carbon-fiber reinforced PETG — very stiff and strong. Abrasive material; hardened nozzle required.",
  ABS:        "Acrylonitrile Butadiene Styrene — strong, heat-resistant, and acetone-smoothable. Prone to warping; enclosed printer strongly recommended.",
  ASA:        "Acrylonitrile Styrene Acrylate — UV and weather-resistant variant of ABS. Ideal for outdoor parts. Enclosed printer recommended.",
  TPU:        "Thermoplastic Polyurethane — flexible and rubber-like. Excellent for phone cases, gaskets, and shock absorbers.",
  Nylon:      "Strong, flexible, and chemical-resistant. Extremely hygroscopic — must be dry-stored and dry-printed for reliable results.",
  PC:         "Polycarbonate — extremely strong and heat-resistant. Requires high temperatures and an enclosed printer.",
  Resin:      "UV-curable photopolymer for MSLA/DLP printers. Exceptional fine detail possible. Requires post-curing and ventilation.",
};

export function computeFilamentPropertyDetails(
  _geometry: GeometryAnalysis,
  inputs: UserInputs,
  settings: PrintSettings,
  advanced: AdvancedSettings,
  filamentDB?: FilamentDBResult | null,
  aiExtras?: {
    specialNotes?: string[];
    pressureAdvanceRange?: { min: number; max: number } | null;
  }
): FilamentPropertyDetails {
  const { filamentType } = inputs;

  // ── Temperature profile ──────────────────────────────────────────────────────
  const ofdPrintTempRange = !!(filamentDB?.printTempMin && filamentDB?.printTempMax);
  const defaultRange = PRINT_TEMP_RANGES[filamentType] ?? [200, 230];
  const printTempMin = ofdPrintTempRange ? filamentDB!.printTempMin : defaultRange[0];
  const printTempMax = ofdPrintTempRange ? filamentDB!.printTempMax : defaultRange[1];

  // ── Physical properties ──────────────────────────────────────────────────────
  const ofdDensity = filamentDB?.density !== undefined;
  const densityGcm3 = ofdDensity ? filamentDB!.density! : (FILAMENT_DENSITY[filamentType] ?? 1.24);

  const ofdDiameter = filamentDB?.diameter !== undefined;
  const diameterMm = ofdDiameter ? filamentDB!.diameter! : 1.75;

  // ── Retraction ───────────────────────────────────────────────────────────────
  const retraction = RETRACTION_TABLE[filamentType] ?? RETRACTION_TABLE.PLA;

  // ── Pressure Advance ─────────────────────────────────────────────────────────
  // Use AI-provided value when available; fall back to sensible defaults, or null
  // for materials where PA is not applicable.
  let pressureAdvanceRange: FilamentPropertyDetails["pressureAdvanceRange"] = null;
  if (aiExtras?.pressureAdvanceRange !== undefined) {
    pressureAdvanceRange = aiExtras.pressureAdvanceRange ?? null;
  } else {
    const defaults = PA_DEFAULTS[filamentType];
    if (defaults) pressureAdvanceRange = { min: defaults[0], max: defaults[1] };
  }

  return {
    // Temperature
    printTempMin,
    printTempMax,
    recommendedPrintTemp: settings.printTemp,
    firstLayerTemp: advanced.firstLayerTemp,
    standbyTemp: advanced.standbyTemp,
    tempTowerMin: advanced.tempTowerMin,
    tempTowerMax: advanced.tempTowerMax,
    // Cooling
    coolingFanPct: settings.coolingFan,
    minLayerTimeSec: advanced.minLayerTime,
    fanRampStrategy: advanced.fanRampUp,
    bridgeFanOverridePct: advanced.bridgeFanOverride,
    overhangFanBoostPct: advanced.overhangFanBoost,
    // Retraction
    retractionDirectDriveMm: retraction.directDriveMm,
    retractionBowdenMm: retraction.bowdenMm,
    retractionSpeedMms: retraction.speedMms,
    zHopMm: retraction.zHopMm,
    // Pressure Advance
    pressureAdvanceRange,
    pressureAdvanceNote: PA_NOTES[filamentType] ?? PA_NOTES.PLA,
    // Physical
    densityGcm3,
    diameterMm,
    materialDescription: MATERIAL_DESCRIPTIONS[filamentType] ?? filamentType,
    // OFD flags
    ofdPrintTempRange,
    ofdDensity,
    ofdDiameter,
    // AI-generated
    specialNotes: aiExtras?.specialNotes ?? [],
  };
}

// ─── Print time estimation ────────────────────────────────────────────────────
//
// Calibration target: a 50×50×50 mm solid cube at Standard quality should
// estimate ~2–3 hours. Verified:
//   Standard (0.20mm, 55mm/s, 18% infill) → ~122–199 min ✓

export function estimatePrintTime(
  geometry: GeometryAnalysis,
  settings: PrintSettings
): { min: number; max: number } {
  // Resin printers: time is dominated by layer cure time, not movement
  if (settings.printTemp === 0) {
    const hours = geometry.dimensions.z / 50;
    return { min: Math.round(hours * 60 * 0.8), max: Math.round(hours * 60 * 1.3) };
  }

  const nozzle = 0.4;  // mm — used as line width approximation
  const flowRate = settings.printSpeed * settings.layerHeight * nozzle; // mm³/s

  const volumeMm3   = geometry.volume * 1000;
  // Shell volume: total surface area × wall count × nozzle width, with 0.3 packing factor
  const shellVolume = geometry.surfaceArea * settings.wallCount * nozzle * 0.3;
  const innerVolume = Math.max(0, volumeMm3 - shellVolume);
  // Effective volume is what actually gets extruded
  const effectiveVolume = shellVolume + innerVolume * (settings.infill / 100);

  const baseSeconds  = effectiveVolume / Math.max(1, flowRate);
  // 1.5× overhead accounts for travel moves, layer changes, acceleration ramp-up
  const withOverhead = baseSeconds * 1.5;
  const minutes      = Math.round(withOverhead / 60);

  return {
    min: Math.max(5,  Math.round(minutes * 0.8)),
    max: Math.max(10, Math.round(minutes * 1.3)),
  };
}
