"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronDown, ArrowRight, ArrowLeft, Info } from "lucide-react";
import clsx from "clsx";
import type { GeometryAnalysis, UserInputs, FilamentDBResult } from "@/lib/types";
import type { FilamentType, FilamentListResponse } from "@/lib/filamentSchemas";
import GeometryVisualizer from "./GeometryVisualizer";
import PrinterProfileManager, { SaveProfileDialog } from "./PrinterProfileManager";
import FilamentSuggestionForm, { type FilamentSuggestionFormData } from "./FilamentSuggestionForm";
import FilamentSuggestionModal from "./FilamentSuggestionModal";
import { queryFilament, fetchBrandList } from "@/lib/filamentDB";
import { loadProfiles } from "@/lib/printerProfiles";
import type { PrinterProfile } from "@/lib/printerProfiles";
import { usePublicConfig } from "@/lib/publicConfig";
import SearchableSelect from "./SearchableSelect";
import OtherEquipmentForm, { type OtherEquipmentFormData } from "./OtherEquipmentForm";
import EquipmentSuggestionModal from "./EquipmentSuggestionModal";
import LoadDirectionInput from "./LoadDirectionInput";
import type { EquipmentPrinter, EquipmentSurface, EquipmentListResponse } from "@/lib/equipmentSchemas";

// ─── Printer data (updated Q1 2026) ──────────────────────────────────────────
// No public vendor API exists for model lists; this curated list is maintained
// manually. Claude uses its training knowledge of each printer's specs.

const PRINTER_GROUPS: { group: string; models: string[] }[] = [
  {
    group: "Bambu Lab",
    models: [
      "Bambu Lab A1 Mini",
      "Bambu Lab A1 Mini Combo",
      "Bambu Lab A1",
      "Bambu Lab A1 Combo",
      "Bambu Lab P1P",
      "Bambu Lab P1S",
      "Bambu Lab P2S",
      "Bambu Lab X1 Carbon",
      "Bambu Lab X1E",
      "Bambu Lab H2D",
    ],
  },
  {
    group: "Creality",
    models: [
      "Creality Ender 3",
      "Creality Ender 3 V2",
      "Creality Ender 3 S1",
      "Creality Ender 3 S1 Pro",
      "Creality Ender 3 V3",
      "Creality Ender 3 V3 SE",
      "Creality Ender 3 V3 KE",
      "Creality Ender 5 S1",
      "Creality Ender 5 Plus",
      "Creality K1",
      "Creality K1 Max",
      "Creality K1C",
      "Creality K2 Plus",
      "Creality CR-10 Smart Pro",
      "Creality Sermoon V2",
    ],
  },
  {
    group: "Prusa",
    models: [
      "Prusa i3 MK3S+",
      "Prusa MK4",
      "Prusa MK4S",
      "Prusa MINI+",
      "Prusa XL",
      "Prusa Core One",
    ],
  },
  {
    group: "Elegoo",
    models: [
      "Elegoo Neptune 3 Pro",
      "Elegoo Neptune 4",
      "Elegoo Neptune 4 Pro",
      "Elegoo Neptune 4 Plus",
      "Elegoo Neptune 4 Max",
      "Elegoo Neptune 4 X",
      "Elegoo Mars 4 Ultra (Resin)",
      "Elegoo Mars 5 Ultra (Resin)",
      "Elegoo Saturn 4 Ultra (Resin)",
    ],
  },
  {
    group: "Bambu Lab (Resin)",
    models: [
      "Bambu Lab Photon Mono X2 (Resin)",
    ],
  },
  {
    group: "Flashforge",
    models: [
      "Flashforge Adventurer 5M",
      "Flashforge Adventurer 5M Pro",
      "Flashforge Creator 4",
      "Flashforge Guider 3 Ultra",
    ],
  },
  {
    group: "AnkerMake",
    models: [
      "AnkerMake M5",
      "AnkerMake M5C",
    ],
  },
  {
    group: "Artillery",
    models: [
      "Artillery Sidewinder X4 Plus",
      "Artillery Sidewinder X4 Pro",
      "Artillery Genius Pro",
      "Artillery Hornet",
    ],
  },
  {
    group: "Sovol",
    models: [
      "Sovol SV06",
      "Sovol SV06 Plus",
      "Sovol SV07 Plus",
      "Sovol SV08",
      "Sovol SV09",
    ],
  },
  {
    group: "QIDI Tech",
    models: [
      "QIDI Tech X-Plus 4",
      "QIDI Tech X-Max 4",
      "QIDI Tech X-CF Pro",
      "QIDI Tech Q1 Pro",
    ],
  },
  {
    group: "Voron",
    models: [
      "Voron 0.2",
      "Voron Trident",
      "Voron 2.4",
      "Voron Switchwire",
    ],
  },
  {
    group: "Bambu Lab (Budget)",
    models: [
      "Bambu Lab A2 Mini",
    ],
  },
  {
    group: "Other / DIY",
    models: ["Other / Custom Printer"],
  },
];

// ─── Bed surfaces (expanded) ──────────────────────────────────────────────────

const BED_SURFACE_GROUPS: { group: string; surfaces: { id: string; label: string; desc: string }[] }[] = [
  {
    group: "PEI (most common)",
    surfaces: [
      { id: "PEI Textured",  label: "PEI Textured",   desc: "Spring steel w/ texture — ships with most modern printers" },
      { id: "PEI Smooth",    label: "PEI Smooth",      desc: "Smooth PEI — great adhesion, mirror-flat bottom" },
      { id: "PEI Satin",     label: "PEI Satin",       desc: "Matte finish, easier PETG/ABS release than smooth" },
    ],
  },
  {
    group: "Bambu Lab plates",
    surfaces: [
      { id: "Bambu Cool Plate",        label: "Bambu Cool Plate",        desc: "PEO-coated — PLA only, peel off when cool" },
      { id: "Bambu Engineering Plate", label: "Bambu Engineering Plate", desc: "For ABS/ASA/PC/PA — needs glue stick for PLA" },
      { id: "Bambu High-Temp Plate",   label: "Bambu High-Temp Plate",   desc: "PA, PC, PEI filament — rated 120°C+" },
      { id: "Bambu Dual-Sided Plate",  label: "Bambu Dual-Sided Plate",  desc: "Textured PEI one side, smooth PEI other" },
    ],
  },
  {
    group: "Specialty surfaces",
    surfaces: [
      { id: "Wham Bam",    label: "Wham Bam PEX",       desc: "Flexible magnetic system — good all-around adhesion" },
      { id: "Garolite",    label: "Garolite (G10)",      desc: "Excellent for Nylon/PA — mediocre for PLA" },
      { id: "BuildTak",    label: "BuildTak",             desc: "Adhesive surface — good for ABS, difficult to remove" },
      { id: "SuperTack",   label: "SuperTack Cool Plate", desc: "Self-releasing at room temp — no adhesives needed" },
      { id: "Magnetic Flex", label: "Magnetic Flex (generic)", desc: "Generic magnetic spring steel plate" },
    ],
  },
  {
    group: "Glass",
    surfaces: [
      { id: "Glass",          label: "Borosilicate Glass", desc: "Flat, needs glue stick or hairspray for most filaments" },
      { id: "Carborundum",    label: "Carborundum Glass",  desc: "Micro-textured glass — good PLA adhesion without glue" },
    ],
  },
  {
    group: "Other",
    surfaces: [
      { id: "Other", label: "Other / Unknown", desc: "Use generic defaults" },
    ],
  },
];

// Flat list for rule engine (all valid surface IDs)
export const ALL_BED_SURFACES = BED_SURFACE_GROUPS.flatMap((g) => g.surfaces.map((s) => s.id));

// ─── Filament types ───────────────────────────────────────────────────────────

const FILAMENT_TYPES: { id: UserInputs["filamentType"]; label: string; desc: string }[] = [
  { id: "PLA",       label: "PLA",              desc: "Easy, great for most prints" },
  { id: "PLA+",      label: "PLA+",             desc: "Tougher than standard PLA" },
  { id: "PLA Silk",  label: "PLA Silk",         desc: "Glossy finish — slower speed, higher temp" },
  { id: "PLA Matte", label: "PLA Matte",        desc: "Matte finish — detailed look, slower print" },
  { id: "PETG",      label: "PETG",             desc: "Tough, moisture resistant" },
  { id: "ABS",       label: "ABS",              desc: "Tough, needs enclosure" },
  { id: "ASA",       label: "ASA",              desc: "UV resistant, outdoor use" },
  { id: "TPU",       label: "TPU",              desc: "Flexible, rubbery" },
  { id: "Nylon",     label: "Nylon (PA)",        desc: "Strong, hygroscopic" },
  { id: "PC",        label: "Polycarbonate",     desc: "Very strong, high temp" },
  { id: "PLA-CF",    label: "PLA-CF",           desc: "Carbon-filled PLA — stiffer" },
  { id: "PETG-CF",   label: "PETG-CF",          desc: "Carbon-filled PETG" },
  { id: "Resin",     label: "Resin (MSLA/DLP)",  desc: "High detail, for resin printers" },
];

// ─── Quality tiers ────────────────────────────────────────────────────────────

const QUALITY_TIERS: { id: UserInputs["printPriority"]; icon: string; name: string; layerHeight: number; desc: string }[] = [
  { id: "Draft",    icon: "⚡", name: "Draft",    layerHeight: 0.28, desc: "Fast and rough. Great for fit tests and prototypes." },
  { id: "Standard", icon: "✅", name: "Standard", layerHeight: 0.20, desc: "The everyday sweet spot. Good quality, reasonable time." },
  { id: "Quality",  icon: "✨", name: "Quality",  layerHeight: 0.12, desc: "Noticeably smoother finish. Takes more time." },
  { id: "Ultra",    icon: "💎", name: "Ultra",    layerHeight: 0.08, desc: "Maximum detail. For display pieces and fine features only." },
];

/** Returns infill % matching what the rule engine will compute for this tier + print purpose. */
function getEstimatedInfill(priority: UserInputs["printPriority"], printPurpose: UserInputs["printPurpose"]): number {
  const base: Record<UserInputs["printPriority"], number> = { Draft: 12, Standard: 18, Quality: 22, Ultra: 27 };
  const baseInfill = base[priority] ?? 18;
  if (printPurpose === 'structural') return Math.max(baseInfill, 35);
  if (printPurpose === 'functional') return baseInfill + 10;
  return baseInfill; // decorative
}

// ─── Filament live preview panel ──────────────────────────────────────────────
// Appears below the brand input when OFD returns a match. Fades in smoothly.
// Shows only fields the API actually returned — never empty lines.

function FilamentPreviewPanel({ data }: { data: FilamentDBResult }) {
  const hasTempLine  = data.printTempMin > 0 || data.printTempMax > 0;
  const hasExtraLine = data.density !== undefined || data.diameter !== undefined || (data.tags && data.tags.length > 0);

  return (
    <div className="animate-fade-in mt-2 border-l-[3px] border-l-[#1D9E75] border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 space-y-1.5">
      {/* Line 1 — confirmation */}
      <p className="text-xs font-medium" style={{ color: "#1D9E75" }}>
        ✓ Found in Open Filament Database
      </p>

      {/* Line 2 — temperatures */}
      {hasTempLine && (
        <p className="text-[13px] text-slate-700 dark:text-slate-200">
          Print temp:{" "}
          <span className="font-medium">{data.printTempMin}–{data.printTempMax}°C</span>
          {(data.bedTempMin > 0 || data.bedTempMax > 0) && (
            <>
              {"  ·  "}Bed temp:{" "}
              <span className="font-medium">{data.bedTempMin}–{data.bedTempMax}°C</span>
            </>
          )}
        </p>
      )}

      {/* Line 3 — density, diameter, flags */}
      {hasExtraLine && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-slate-500 dark:text-slate-400">
          {data.density !== undefined && (
            <span>Density: {data.density} g/cm³</span>
          )}
          {data.density !== undefined && data.diameter !== undefined && <span>·</span>}
          {data.diameter !== undefined && (
            <span>Diameter: {data.diameter}mm</span>
          )}
          {data.tags && data.tags.length > 0 && (
            <>
              {(data.density !== undefined || data.diameter !== undefined) && <span>·</span>}
              {data.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-medium capitalize"
                >
                  {tag}
                </span>
              ))}
            </>
          )}
        </div>
      )}

      {/* Line 4 — attribution */}
      <p className="text-[11px] text-slate-400 dark:text-slate-500">
        Data sourced from{" "}
        <a
          href="https://openfilamentdatabase.org"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          Open Filament Database
        </a>
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const DEFAULTS: UserInputs = {
  printerModel: "",
  filamentType: "PLA",
  filamentBrand: "",
  nozzleDiameter: 0.4,
  nozzleMaterial: "brass",
  nozzleType: "standard",
  flowRate: "standard_flow",
  bedSurface: "",
  humidity: "Normal",
  printPriority: "Standard",   // Standard is the recommended starting point
  printPurpose: "functional",  // Functional is the safe default (between decorative and structural)
  problemDescription: "",
  loadDirection: undefined,
  loadDescription: "",
};

interface Props {
  geometry: GeometryAnalysis;
  meshVertices?: Float32Array;
  onBack: () => void;
  onSubmit: (inputs: UserInputs, filamentDB?: FilamentDBResult | null) => void;
}

export default function InputForm({ geometry, meshVertices, onBack, onSubmit }: Props) {
  const publicConfig = usePublicConfig();
  const [inputs, setInputs] = useState<UserInputs>(DEFAULTS);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [filamentDBData, setFilamentDBData] = useState<FilamentDBResult | null>(null);
  const [filamentDBLoading, setFilamentDBLoading] = useState(false);
  const [savedProfiles, setSavedProfiles] = useState<PrinterProfile[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Equipment system state
  const [printers, setPrinters] = useState<EquipmentPrinter[]>([]);
  const [surfaces, setSurfaces] = useState<EquipmentSurface[]>([]);
  const [equipmentLoading, setEquipmentLoading] = useState(true);

  // Filament system state
  const [filaments, setFilaments] = useState<FilamentType[]>([]);
  const [filamentsLoading, setFilamentsLoading] = useState(true);

  // "Other" equipment forms
  const [isOtherPrinter, setIsOtherPrinter] = useState(false);
  const [isOtherSurface, setIsOtherSurface] = useState(false);
  const [showPrinterSuggestionModal, setShowPrinterSuggestionModal] = useState(false);
  const [showSurfaceSuggestionModal, setShowSurfaceSuggestionModal] = useState(false);
  const [pendingPrinterSuggestion, setPendingPrinterSuggestion] = useState<OtherEquipmentFormData | null>(null);
  const [pendingSurfaceSuggestion, setPendingSurfaceSuggestion] = useState<OtherEquipmentFormData | null>(null);

  // Filament suggestion form
  const [isOtherFilament, setIsOtherFilament] = useState(false);
  const [showFilamentSuggestionModal, setShowFilamentSuggestionModal] = useState(false);
  const [pendingFilamentSuggestion, setPendingFilamentSuggestion] = useState<FilamentSuggestionFormData | null>(null);

  // Load saved profiles on mount
  useEffect(() => {
    setSavedProfiles(loadProfiles());
  }, []);

  // Fetch equipment lists from API
  useEffect(() => {
    const fetchEquipment = async () => {
      try {
        setEquipmentLoading(true);
        const response = await fetch("/api/equipment");
        if (response.ok) {
          const data: EquipmentListResponse = await response.json();
          setPrinters(data.printers || []);
          setSurfaces(data.surfaces || []);
        }
      } catch (error) {
        console.error("[InputForm] Failed to fetch equipment:", error);
      } finally {
        setEquipmentLoading(false);
      }
    };

    fetchEquipment();
  }, []);

  // Fetch filament types from API
  useEffect(() => {
    const fetchFilaments = async () => {
      try {
        setFilamentsLoading(true);
        const response = await fetch("/api/filament");
        if (response.ok) {
          const data: FilamentListResponse = await response.json();
          setFilaments(data.filaments || []);
        }
      } catch (error) {
        console.error("[InputForm] Failed to fetch filaments:", error);
      } finally {
        setFilamentsLoading(false);
      }
    };

    fetchFilaments();
  }, []);

  // Pre-warm the OFD brand list cache so the first lookup is instant (only when enabled)
  useEffect(() => {
    if (publicConfig.filamentDbEnabled) fetchBrandList().catch(() => {});
  }, [publicConfig.filamentDbEnabled]);

  // Listen for weather widget humidity event
  useEffect(() => {
    function handler(e: Event) {
      const { level } = (e as CustomEvent<{ level: "Low" | "Normal" | "High" }>).detail;
      setInputs((prev) => ({ ...prev, humidity: level }));
    }
    window.addEventListener("pp-humidity", handler);
    return () => window.removeEventListener("pp-humidity", handler);
  }, []);

  function set<K extends keyof UserInputs>(key: K, value: UserInputs[K]) {
    setInputs((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => { const e = { ...prev }; delete e[key]; return e; });
  }

  // Debounced filament DB lookup when brand or filament type changes
  const triggerFilamentLookup = useCallback(
    (brand: string, type: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      // Skip lookup when feature is disabled or inputs are empty
      if (!publicConfig.filamentDbEnabled || !brand.trim() || !type) {
        setFilamentDBData(null);
        return;
      }
      debounceRef.current = setTimeout(async () => {
        setFilamentDBLoading(true);
        const result = await queryFilament(brand, type);
        setFilamentDBData(result);
        setFilamentDBLoading(false);
      }, 600);
    },
    [publicConfig.filamentDbEnabled]
  );

  function handleBrandChange(brand: string) {
    set("filamentBrand", brand);
    triggerFilamentLookup(brand, inputs.filamentType);
  }

  function handleFilamentTypeChange(type: UserInputs["filamentType"]) {
    set("filamentType", type);
    triggerFilamentLookup(inputs.filamentBrand, type);
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!inputs.printerModel) e.printerModel = "Please select your printer";
    if (!inputs.bedSurface) e.bedSurface = "Please select a bed surface";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (validate()) onSubmit(inputs, filamentDBData);
  }

  function handleLoadProfile(profile: PrinterProfile) {
    // Handle both legacy string-based printer names and new equipment IDs
    let printerModelValue = profile.printerModel;

    // If the saved profile has a string name (legacy format), try to find matching equipment by name
    if (printerModelValue && !printerModelValue.startsWith("00000000-") && printers.length > 0) {
      const matchingEquipment = printers.find(
        (p) => `${p.vendorName} ${p.modelName}`.toLowerCase() === printerModelValue.toLowerCase()
      );
      if (matchingEquipment) {
        printerModelValue = matchingEquipment.id; // Use equipment ID instead of string name
      }
    }

    // Similarly for bed surface - try to find by name if it's a string
    let bedSurfaceValue = profile.bedSurface;
    if (bedSurfaceValue && !bedSurfaceValue.startsWith("00000000-") && surfaces.length > 0) {
      const matchingSurface = surfaces.find(
        (s) => s.displayName.toLowerCase() === bedSurfaceValue.toLowerCase()
      );
      if (matchingSurface) {
        bedSurfaceValue = matchingSurface.id;
      }
    }

    setInputs((prev) => ({
      ...prev,
      printerModel: printerModelValue,
      nozzleDiameter: profile.nozzleDiameter,
      nozzleMaterial: profile.nozzleMaterial ?? "brass",
      nozzleType: profile.nozzleType ?? "standard",
      flowRate: profile.flowRate ?? "standard_flow",
      bedSurface: bedSurfaceValue,
    }));
    // Clear validation errors for fields that are now filled by the profile
    setErrors((prev) => {
      const e = { ...prev };
      delete e.printerModel;
      delete e.bedSurface;
      return e;
    });
    setSavedProfiles(loadProfiles());
  }

  // Auto-logic: when user selects cht/volcano/induction, auto-set flowRate to high_flow
  function handleNozzleTypeChange(type: UserInputs["nozzleType"]) {
    set("nozzleType", type);
    if (["cht", "volcano", "induction"].includes(type)) {
      set("flowRate", "high_flow");
    }
  }

  // Check if "Other" equipment is selected (either by ID or legacy string)
  const selectedPrinter = printers.find((p) => p.id === inputs.printerModel);
  const isOtherPrinterSelected = isOtherPrinter || selectedPrinter?.modelName === "Other / Custom Printer" || inputs.printerModel === "Other / Custom Printer";

  const selectedSurface = surfaces.find((s) => s.id === inputs.bedSurface);

  // Check if filament is abrasive (needs harder nozzle material)
  const isAbrasiveFilament = ["PLA-CF", "PETG-CF", "Nylon"].includes(inputs.filamentType);
  const showAbrasiveWarning = isAbrasiveFilament && inputs.nozzleMaterial === "brass";

  return (
    <div className="animate-slide-up">
      {/* Geometry summary */}
      <div className="card p-6 mb-6">
        <h2 className="font-bold text-slate-800 dark:text-slate-100 mb-1 flex items-center gap-2">
          <span>📐</span> Your Model
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{geometry.fileName}</p>
        <GeometryVisualizer
          geometry={geometry}
          meshVertices={meshVertices}
          filamentType={inputs.filamentType}
          infillPct={getEstimatedInfill(inputs.printPriority, inputs.printPurpose)}
        />
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Printer & Filament */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span>🖨️</span> Printer &amp; Filament
            </h2>
            <div className="flex items-center gap-3">
              {/* Load saved printer dropdown */}
              {savedProfiles.length > 0 && (
                <div className="relative">
                  <select
                    className="text-xs text-primary-600 dark:text-primary-400 bg-transparent border-none cursor-pointer focus:outline-none appearance-none pr-4 font-medium hover:text-primary-700 dark:hover:text-primary-300"
                    defaultValue=""
                    onChange={(e) => {
                      const profile = savedProfiles.find((p) => p.id === e.target.value);
                      if (profile) handleLoadProfile(profile);
                      e.target.value = "";
                    }}
                    title="Load a saved printer profile"
                  >
                    <option value="" disabled>Load saved printer ▾</option>
                    {savedProfiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nickname} ({p.nozzleDiameter}mm)
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <PrinterProfileManager onLoadProfile={handleLoadProfile} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Printer */}
            <div className="sm:col-span-2">
              <label className="label">Printer model *</label>

              {equipmentLoading ? (
                <div className="h-10 bg-slate-100 dark:bg-slate-700 rounded-lg animate-pulse" />
              ) : (
                <>
                  <SearchableSelect
                    items={printers.map((p) => ({
                      id: p.id,
                      displayName: `${p.vendorName} ${p.modelName}`,
                      label: `${p.vendorName} ${p.modelName}`,
                      group: p.group,
                    }))}
                    groups={
                      Array.from(
                        new Map(printers.map((p) => [p.group, p]))
                      ).map(([group, _]) => ({
                        name: group,
                        items: printers
                          .filter((p) => p.group === group)
                          .map((p) => ({
                            id: p.id,
                            displayName: `${p.vendorName} ${p.modelName}`,
                            label: `${p.vendorName} ${p.modelName}`,
                            group: p.group,
                          })),
                      }))
                    }
                    value={inputs.printerModel}
                    onChange={(id) => {
                      set("printerModel", id);
                      // Check if the selected printer is "Other / Custom Printer"
                      const selectedPrinterOption = printers.find((p) => p.id === id);
                      setIsOtherPrinter(selectedPrinterOption?.modelName === "Other / Custom Printer");
                    }}
                    placeholder="Search or select your printer…"
                    disabled={equipmentLoading}
                    className={errors.printerModel ? "ring-2 ring-orange-200" : ""}
                  />
                </>
              )}

              {errors.printerModel && <p className="text-xs text-orange-600 mt-1">{errors.printerModel}</p>}

              {/* Other equipment form */}
              {isOtherPrinter && (
                <OtherEquipmentForm
                  equipmentType="printer"
                  isExpanded={isOtherPrinter}
                  onSubmit={(data) => {
                    setPendingPrinterSuggestion(data);
                    setShowPrinterSuggestionModal(true);
                  }}
                  onCancel={() => {
                    setIsOtherPrinter(false);
                    // Note: printerModel value is retained — user can proceed with "Other" selected
                  }}
                />
              )}

              {/* Info message */}
              {isOtherPrinter ? (
                <div className="mt-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2 flex gap-2 text-xs text-amber-700 dark:text-amber-400">
                  <Info size={14} className="mt-0.5 flex-shrink-0" />
                  <span>Share details about your printer so Claude can recommend the best settings for your specific hardware.</span>
                </div>
              ) : inputs.printerModel && !isOtherPrinter ? (
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  Claude knows this printer&apos;s specs (enclosure, drive type, bed size) and factors them in automatically.
                </p>
              ) : null}
            </div>

            {/* Filament type */}
            <div>
              <label className="label">Filament type</label>
              <div className="relative">
                <select
                  className="select pr-10"
                  value={inputs.filamentType}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "Other / Custom Filament") {
                      setIsOtherFilament(true);
                    } else {
                      setIsOtherFilament(false);
                      handleFilamentTypeChange(value as UserInputs["filamentType"]);
                    }
                  }}
                  disabled={filamentsLoading}
                >
                  {filamentsLoading ? (
                    <option disabled>Loading filaments...</option>
                  ) : filaments.length > 0 ? (
                    <>
                      {filaments.map((f) => (
                        <option key={f.id} value={f.displayName}>{f.displayName} — {f.description}</option>
                      ))}
                      <option value="Other / Custom Filament">Other / Custom Filament</option>
                    </>
                  ) : (
                    <>
                      {FILAMENT_TYPES.map((f) => (
                        <option key={f.id} value={f.id}>{f.label} — {f.desc}</option>
                      ))}
                      <option value="Other / Custom Filament">Other / Custom Filament</option>
                    </>
                  )}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Filament suggestion form */}
            {isOtherFilament && (
              <FilamentSuggestionForm
                isExpanded={isOtherFilament}
                onSubmit={(data) => {
                  setPendingFilamentSuggestion(data);
                  setShowFilamentSuggestionModal(true);
                }}
                onCancel={() => {
                  setIsOtherFilament(false);
                  // Note: filamentType value is retained — user can proceed with "Other / Custom Filament" selected
                }}
              />
            )}

            {/* Filament brand */}
            <div>
              <label className="label">Filament brand <span className="text-slate-400 font-normal">(optional)</span></label>
              <input
                type="text"
                className="input"
                placeholder={isOtherPrinterSelected ? "Brand + describe your printer…" : "e.g. Hatchbox, eSUN, Bambu…"}
                value={inputs.filamentBrand}
                onChange={(e) => handleBrandChange(e.target.value)}
              />
              {/* Filament live preview — loading state */}
              {filamentDBLoading && (
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5 animate-pulse">
                  Looking up filament data…
                </p>
              )}
              {/* Filament live preview — data panel */}
              {!filamentDBLoading && filamentDBData && (
                <FilamentPreviewPanel data={filamentDBData} />
              )}
            </div>

          </div>
        </div>

        {/* Nozzle Configuration */}
        <div className="card p-6">
          <h2 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
            <span>🔧</span> Nozzle Configuration
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Nozzle diameter */}
            <div className="sm:col-span-2">
              <label className="label">Nozzle diameter</label>
              <div className="flex gap-2 flex-wrap">
                {([0.2, 0.4, 0.6, 0.8] as const).map((d) => (
                  <button key={d} type="button" onClick={() => set("nozzleDiameter", d)}
                    className={clsx(
                      "flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-all",
                      inputs.nozzleDiameter === d
                        ? "bg-primary-600 text-white border-primary-600"
                        : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-primary-400"
                    )}>
                    {d}mm
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Most printers ship with 0.4mm. Larger nozzles are faster; smaller ones provide more detail.
              </p>
            </div>

            {/* Nozzle material */}
            <div>
              <label className="label">Nozzle material</label>
              <div className="relative">
                <select
                  className="select pr-10"
                  value={inputs.nozzleMaterial}
                  onChange={(e) => set("nozzleMaterial", e.target.value as UserInputs["nozzleMaterial"])}
                >
                  <option value="brass">Brass (standard)</option>
                  <option value="hardened_steel">Hardened Steel</option>
                  <option value="stainless_steel">Stainless Steel</option>
                  <option value="ruby_tipped">Ruby-Tipped</option>
                  <option value="tungsten_carbide">Tungsten Carbide</option>
                  <option value="copper_plated">Copper-Plated</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Harder materials handle abrasive filaments; brass is most common.
              </p>
            </div>

            {/* Nozzle type */}
            <div>
              <label className="label">Nozzle type</label>
              <div className="relative">
                <select
                  className="select pr-10"
                  value={inputs.nozzleType}
                  onChange={(e) => handleNozzleTypeChange(e.target.value as UserInputs["nozzleType"])}
                >
                  <option value="standard">Standard</option>
                  <option value="cht">CHT (Closure Head)</option>
                  <option value="volcano">Volcano</option>
                  <option value="induction">Induction</option>
                  <option value="quick_swap">Quick Swap</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                High-flow types (CHT, Volcano, Induction) enable higher speeds.
              </p>
            </div>

            {/* Flow rate */}
            <div>
              <label className="label">Flow rate</label>
              <div className="relative">
                <select
                  className="select pr-10"
                  value={inputs.flowRate}
                  onChange={(e) => set("flowRate", e.target.value as UserInputs["flowRate"])}
                >
                  <option value="standard_flow">Standard Flow (≤12 mm³/s)</option>
                  <option value="high_flow">High Flow (≤28 mm³/s)</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                High-flow nozzles support faster volumetric speeds.
              </p>
            </div>

            {/* Abrasive filament warning */}
            {showAbrasiveWarning && (
              <div className="sm:col-span-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2.5 flex gap-2 text-xs text-amber-700 dark:text-amber-400">
                <Info size={14} className="mt-0.5 flex-shrink-0" />
                <span>
                  <strong>⚠️ Abrasive filament warning:</strong> Carbon-filled and nylon filaments will wear out brass nozzles quickly. Consider upgrading to hardened steel, stainless steel, or tungsten carbide.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Environment */}
        <div className="card p-6">
          <h2 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
            <span>🏠</span> Your Environment
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Bed surface */}
            <div>
              <label className="label">Bed surface</label>

              {equipmentLoading ? (
                <div className="h-10 bg-slate-100 dark:bg-slate-700 rounded-lg animate-pulse" />
              ) : (
                <>
                  <SearchableSelect
                    items={surfaces.map((s) => ({
                      id: s.id,
                      displayName: s.displayName,
                      label: s.displayName,
                      group: s.group,
                    }))}
                    groups={
                      Array.from(
                        new Map(surfaces.map((s) => [s.group, s]))
                      ).map(([group, _]) => ({
                        name: group,
                        items: surfaces
                          .filter((s) => s.group === group)
                          .map((s) => ({
                            id: s.id,
                            displayName: s.displayName,
                            label: s.displayName,
                            group: s.group,
                          })),
                      }))
                    }
                    value={inputs.bedSurface}
                    onChange={(id) => {
                      set("bedSurface", id as UserInputs["bedSurface"]);
                      // Check if the selected surface is "Other / Unknown"
                      const selectedSurfaceOption = surfaces.find((s) => s.id === id);
                      setIsOtherSurface(selectedSurfaceOption?.displayName === "Other / Unknown");
                    }}
                    placeholder="Search or select your bed surface…"
                    disabled={equipmentLoading}
                    className={errors.bedSurface ? "ring-2 ring-orange-200" : ""}
                  />
                  {errors.bedSurface && <p className="text-xs text-orange-600 mt-1">{errors.bedSurface}</p>}
                </>
              )}

              {/* Other equipment form */}
              {isOtherSurface && (
                <OtherEquipmentForm
                  equipmentType="surface"
                  isExpanded={isOtherSurface}
                  onSubmit={(data) => {
                    setPendingSurfaceSuggestion(data);
                    setShowSurfaceSuggestionModal(true);
                  }}
                  onCancel={() => {
                    setIsOtherSurface(false);
                    // Note: bedSurface value is retained — user can proceed with "Other / Unknown" selected
                  }}
                />
              )}

              {/* Description */}
              {isOtherSurface ? (
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  Tell us about your build plate so Claude can recommend optimal temperature and adhesion settings.
                </p>
              ) : (
                surfaces
                  .find((s) => s.id === inputs.bedSurface)
                  ?.description && (
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    {surfaces.find((s) => s.id === inputs.bedSurface)?.description}
                  </p>
                )
              )}
            </div>

            {/* Humidity */}
            <div>
              <label className="label">Room humidity</label>
              <div className="flex gap-2">
                {(["Low", "Normal", "High"] as const).map((h) => (
                  <button key={h} type="button" onClick={() => set("humidity", h)}
                    className={clsx(
                      "flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-all",
                      inputs.humidity === h
                        ? "bg-primary-600 text-white border-primary-600"
                        : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-primary-400"
                    )}>
                    {h}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                High = coastal / rainy season — affects Nylon, PA, PC most
              </p>
            </div>
          </div>
        </div>

        {/* Print Quality */}
        <div className="card p-6">
          <h2 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
            <span>🎯</span> Print Quality
          </h2>
          <div className="space-y-4">
            <div>
              <label className="label">Select quality tier</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {QUALITY_TIERS.map((tier) => (
                  <button key={tier.id} type="button" onClick={() => set("printPriority", tier.id)}
                    className={clsx(
                      "rounded-xl border p-3 text-left transition-all",
                      inputs.printPriority === tier.id
                        ? "bg-primary-50 dark:bg-primary-900/30 border-primary-500 ring-2 ring-primary-200 dark:ring-primary-800"
                        : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 hover:border-primary-300"
                    )}>
                    <div className="text-xl mb-1">{tier.icon}</div>
                    <div className="font-semibold text-sm text-slate-800 dark:text-slate-200">{tier.name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{tier.desc}</div>
                    <div className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-mono">{tier.layerHeight}mm layers</div>
                  </button>
                ))}
              </div>
              {inputs.printPriority === "Ultra" && (
                <div className="mt-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2 flex gap-2 text-xs text-amber-700 dark:text-amber-400">
                  <Info size={14} className="mt-0.5 flex-shrink-0" />
                  <span>Ultra quality significantly increases print time. Not recommended for large models.</span>
                </div>
              )}
            </div>

            <div>
              <label className="label">What is this part?</label>
              <div className="grid grid-cols-3 gap-3">
                {([
                  { value: "decorative" as const, icon: "🎨", label: "Decorative", desc: "Display models, figurines, art pieces" },
                  { value: "functional" as const, icon: "🔧", label: "Functional", desc: "Moving parts, moderate loads, enclosures" },
                  { value: "structural" as const, icon: "🏗️", label: "Structural", desc: "Load-bearing, precision, dimensional accuracy", isNew: true },
                ] as const).map((opt) => (
                  <div key={opt.label} className="relative">
                    <button type="button" onClick={() => set("printPurpose", opt.value)}
                      className={clsx(
                        "w-full rounded-xl border p-3 text-left transition-all",
                        inputs.printPurpose === opt.value
                          ? "bg-primary-50 dark:bg-primary-900/30 border-primary-500 ring-2 ring-primary-200 dark:ring-primary-800"
                          : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 hover:border-primary-300"
                      )}>
                      <div className="text-xl mb-1">{opt.icon}</div>
                      <div className="font-semibold text-sm text-slate-800 dark:text-slate-200">{opt.label}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{opt.desc}</div>
                    </button>
                    {("isNew" in opt && opt.isNew) && (
                      <div className="absolute -top-2 -right-2 inline-flex items-center justify-center bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                        New
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Load Direction (for structural/functional prints) */}
        <LoadDirectionInput
          printPurpose={inputs.printPurpose}
          loadDirection={inputs.loadDirection}
          loadDescription={inputs.loadDescription}
          onLoadDirectionChange={(value) => set("loadDirection", value)}
          onLoadDescriptionChange={(value) => set("loadDescription", value)}
        />

        {/* Problem Description — Optional */}
        <div className="card p-6">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-3 block">
            Having a specific problem? <span className="font-normal">(optional)</span>
          </label>
          <div className="space-y-2">
            <textarea
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition resize-none"
              rows={2}
              placeholder="e.g. PETG stringing badly, first layer not sticking, top surface rough..."
              value={inputs.problemDescription}
              onChange={(e) => {
                const val = e.target.value.slice(0, 75);
                set("problemDescription", val);
              }}
              maxLength={75}
              spellCheck="false"
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Describe your print issue in a few words. This helps us tailor every recommendation to your specific situation.
              </p>
              <span className={clsx(
                "text-xs font-medium",
                inputs.problemDescription.length < 60 ? "text-slate-400" :
                inputs.problemDescription.length < 75 ? "text-amber-600 dark:text-amber-500" :
                "text-red-600 dark:text-red-500"
              )}>
                {inputs.problemDescription.length} / 75
              </span>
            </div>
          </div>
        </div>

        {/* Save setup / Submit row */}
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={onBack} className="btn-secondary">
            <ArrowLeft size={16} /> Back
          </button>

          <div className="flex items-center gap-2">
            {inputs.printerModel && !profileSaved && (
              <button
                type="button"
                onClick={() => setShowSaveDialog(true)}
                className="btn-secondary text-sm"
                title="Save this printer setup as a profile"
              >
                💾 Save setup
              </button>
            )}
            {profileSaved && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">✓ Saved!</span>
            )}

            {/* Validation errors displayed at button level */}
            {(errors.printerModel || errors.bedSurface) && (
              <div className="rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 px-4 py-3">
                <p className="text-sm font-semibold text-orange-900 dark:text-orange-100 mb-2">
                  Missing required information:
                </p>
                <ul className="text-sm text-orange-800 dark:text-orange-200 space-y-1">
                  {errors.printerModel && <li>• {errors.printerModel}</li>}
                  {errors.bedSurface && <li>• {errors.bedSurface}</li>}
                </ul>
              </div>
            )}

            <button
              type="submit"
              className={clsx(
                "btn-primary",
                (errors.printerModel || errors.bedSurface) && "ring-2 ring-orange-400 bg-orange-600 hover:bg-orange-700"
              )}
            >
              Get My Settings <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </form>

      {/* Save profile dialog */}
      {showSaveDialog && (
        <SaveProfileDialog
          printerModel={inputs.printerModel}
          nozzleDiameter={inputs.nozzleDiameter}
          nozzleMaterial={inputs.nozzleMaterial}
          nozzleType={inputs.nozzleType}
          flowRate={inputs.flowRate}
          bedSurface={inputs.bedSurface}
          onClose={() => setShowSaveDialog(false)}
          onSaved={() => {
            setProfileSaved(true);
            setSavedProfiles(loadProfiles());
            setTimeout(() => setProfileSaved(false), 3000);
          }}
        />
      )}

      {/* Printer suggestion modal */}
      {pendingPrinterSuggestion && (
        <EquipmentSuggestionModal
          isOpen={showPrinterSuggestionModal}
          equipmentType="printer"
          name={pendingPrinterSuggestion.name}
          description={pendingPrinterSuggestion.description}
          characteristics={pendingPrinterSuggestion.characteristics}
          onClose={() => {
            setShowPrinterSuggestionModal(false);
            setPendingPrinterSuggestion(null);
          }}
          onSubmit={async () => {
            // Response is handled by modal itself
            return { status: "submitted" as const, message: "Thanks!" };
          }}
        />
      )}

      {/* Surface suggestion modal */}
      {pendingSurfaceSuggestion && (
        <EquipmentSuggestionModal
          isOpen={showSurfaceSuggestionModal}
          equipmentType="surface"
          name={pendingSurfaceSuggestion.name}
          description={pendingSurfaceSuggestion.description}
          characteristics={pendingSurfaceSuggestion.characteristics}
          onClose={() => {
            setShowSurfaceSuggestionModal(false);
            setPendingSurfaceSuggestion(null);
          }}
          onSubmit={async () => {
            return { status: "submitted" as const, message: "Thanks!" };
          }}
        />
      )}

      {/* Filament suggestion modal */}
      {pendingFilamentSuggestion && (
        <FilamentSuggestionModal
          isOpen={showFilamentSuggestionModal}
          displayName={pendingFilamentSuggestion.displayName}
          userDescription={pendingFilamentSuggestion.userDescription}
          characteristics={pendingFilamentSuggestion.characteristics}
          onClose={() => {
            setShowFilamentSuggestionModal(false);
            setPendingFilamentSuggestion(null);
          }}
        />
      )}
    </div>
  );
}
