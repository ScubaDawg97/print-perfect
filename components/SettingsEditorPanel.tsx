"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, ChevronDown, RotateCcw } from "lucide-react";
import clsx from "clsx";
import type { GeometryAnalysis, UserInputs, FilamentDBResult } from "@/lib/types";
import { queryFilament, fetchBrandList } from "@/lib/filamentDB";
import SearchableSelect from "./SearchableSelect";
import OtherEquipmentForm, { type OtherEquipmentFormData } from "./OtherEquipmentForm";
import EquipmentSuggestionModal from "./EquipmentSuggestionModal";
import type { EquipmentPrinter, EquipmentSurface, EquipmentListResponse } from "@/lib/equipmentSchemas";

interface Props {
  geometry: GeometryAnalysis;
  inputs: UserInputs;
  onClose: () => void;
  onRerun: (newInputs: UserInputs) => Promise<void>;
  remainingAnalyses: number;
}

const FILAMENT_TYPES: { id: UserInputs["filamentType"]; label: string; desc: string }[] = [
  { id: "PLA", label: "PLA", desc: "Easy, great for most prints" },
  { id: "PLA+", label: "PLA+", desc: "Tougher than standard PLA" },
  { id: "PLA Silk", label: "PLA Silk", desc: "Glossy finish — slower speed, higher temp" },
  { id: "PLA Matte", label: "PLA Matte", desc: "Matte finish — detailed look, slower print" },
  { id: "PETG", label: "PETG", desc: "Tough, moisture resistant" },
  { id: "ABS", label: "ABS", desc: "Tough, needs enclosure" },
  { id: "ASA", label: "ASA", desc: "UV resistant, outdoor use" },
  { id: "TPU", label: "TPU", desc: "Flexible, rubbery" },
  { id: "Nylon", label: "Nylon (PA)", desc: "Strong, hygroscopic" },
  { id: "PC", label: "Polycarbonate", desc: "Very strong, high temp" },
  { id: "PLA-CF", label: "PLA-CF", desc: "Carbon-filled PLA — stiffer" },
  { id: "PETG-CF", label: "PETG-CF", desc: "Carbon-filled PETG" },
  { id: "Resin", label: "Resin (MSLA/DLP)", desc: "High detail, for resin printers" },
];

const QUALITY_TIERS: { id: UserInputs["printPriority"]; icon: string; name: string; layerHeight: number; desc: string }[] = [
  { id: "Draft", icon: "⚡", name: "Draft", layerHeight: 0.28, desc: "Fast and rough" },
  { id: "Standard", icon: "✅", name: "Standard", layerHeight: 0.20, desc: "Everyday sweet spot" },
  { id: "Quality", icon: "✨", name: "Quality", layerHeight: 0.12, desc: "Smoother finish" },
  { id: "Ultra", icon: "💎", name: "Ultra", layerHeight: 0.08, desc: "Maximum detail" },
];

const PRINT_PURPOSES: { id: UserInputs["printPurpose"]; icon: string; name: string; desc: string }[] = [
  { id: "decorative", icon: "🎨", name: "Decorative", desc: "Visual appeal matters most" },
  { id: "functional", icon: "🔧", name: "Functional", desc: "Must perform a task" },
  { id: "structural", icon: "🏗️", name: "Structural", desc: "High durability required" },
];

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  hasChanges?: boolean;
}

function CollapsibleSection({ title, children, defaultOpen = false, hasChanges = false }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-slate-200 dark:border-slate-700">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-900 dark:text-slate-100">{title}</span>
          {hasChanges && (
            <span className="w-2 h-2 rounded-full bg-amber-400" title="This section has changes"></span>
          )}
        </div>
        <ChevronDown
          size={16}
          className={clsx("text-slate-400 transition-transform", open ? "rotate-180" : "")}
        />
      </button>

      {open && (
        <div className="px-4 py-3 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-700/50 space-y-4">
          {children}
        </div>
      )}
    </div>
  );
}

interface FormFieldProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

function FormField({ label, description, children }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-slate-900 dark:text-slate-100">{label}</label>
      {description && <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>}
      {children}
    </div>
  );
}

export default function SettingsEditorPanel({ geometry, inputs, onClose, onRerun, remainingAnalyses }: Props) {
  const [editedInputs, setEditedInputs] = useState<UserInputs>(inputs);
  const [isRerunning, setIsRerunning] = useState(false);
  const [rerunError, setRerunError] = useState<string | null>(null);
  const [printers, setPrinters] = useState<EquipmentPrinter[]>([]);
  const [surfaces, setSurfaces] = useState<EquipmentSurface[]>([]);
  const [equipmentLoading, setEquipmentLoading] = useState(true);
  const [isOtherPrinter, setIsOtherPrinter] = useState(false);
  const [isOtherSurface, setIsOtherSurface] = useState(false);
  const [showPrinterSuggestionModal, setShowPrinterSuggestionModal] = useState(false);
  const [showSurfaceSuggestionModal, setShowSurfaceSuggestionModal] = useState(false);
  const [pendingPrinterSuggestion, setPendingPrinterSuggestion] = useState<OtherEquipmentFormData | null>(null);
  const [pendingSurfaceSuggestion, setPendingSurfaceSuggestion] = useState<OtherEquipmentFormData | null>(null);
  const [filamentDBData, setFilamentDBData] = useState<FilamentDBResult | null>(null);
  const [filamentDBLoading, setFilamentDBLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch equipment lists
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
        console.error("[SettingsEditorPanel] Failed to fetch equipment:", error);
      } finally {
        setEquipmentLoading(false);
      }
    };

    fetchEquipment();
  }, []);

  // Check if we should show "Other" option
  useEffect(() => {
    const isPrinterUUID = editedInputs.printerModel?.startsWith("00000000-") ||
                          (editedInputs.printerModel?.length === 36 && editedInputs.printerModel?.includes("-"));
    setIsOtherPrinter(!isPrinterUUID && editedInputs.printerModel !== "");
  }, [editedInputs.printerModel]);

  useEffect(() => {
    const isSurfaceUUID = editedInputs.bedSurface?.startsWith("00000000-") ||
                          (editedInputs.bedSurface?.length === 36 && editedInputs.bedSurface?.includes("-"));
    setIsOtherSurface(!isSurfaceUUID && editedInputs.bedSurface !== "");
  }, [editedInputs.bedSurface]);

  // Filament DB lookup with debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!editedInputs.filamentBrand) {
      setFilamentDBData(null);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setFilamentDBLoading(true);
      try {
        const result = await queryFilament(editedInputs.filamentBrand, editedInputs.filamentType);
        setFilamentDBData(result);
      } catch (error) {
        console.error("[SettingsEditorPanel] Filament DB lookup failed:", error);
        setFilamentDBData(null);
      } finally {
        setFilamentDBLoading(false);
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [editedInputs.filamentBrand, editedInputs.filamentType]);

  function set<K extends keyof UserInputs>(key: K, value: UserInputs[K]) {
    setEditedInputs((prev) => ({ ...prev, [key]: value }));
    setRerunError(null);
  }

  // Helper to get display name for a printer UUID
  const getPrinterDisplayName = (printerId: string): string => {
    if (!printerId) return "";
    const printer = printers.find((p) => p.id === printerId);
    return printer ? `${printer.vendorName} ${printer.modelName}` : printerId;
  };

  // Helper to get display name for a surface UUID
  const getSurfaceDisplayName = (surfaceId: string): string => {
    if (!surfaceId) return "";
    const surface = surfaces.find((s) => s.id === surfaceId);
    return surface ? surface.displayName : surfaceId;
  };

  function calculateChanges(): string[] {
    const changes: string[] = [];
    if (editedInputs.printerModel !== inputs.printerModel) changes.push("Printer");
    if (editedInputs.filamentType !== inputs.filamentType) changes.push("Filament type");
    if (editedInputs.filamentBrand !== inputs.filamentBrand) changes.push("Filament brand");
    if (editedInputs.bedSurface !== inputs.bedSurface) changes.push("Bed surface");
    if (editedInputs.printPriority !== inputs.printPriority) changes.push("Quality tier");
    if (editedInputs.printPurpose !== inputs.printPurpose) changes.push("Print purpose");
    if (editedInputs.nozzleDiameter !== inputs.nozzleDiameter) changes.push("Nozzle diameter");
    if (editedInputs.humidity !== inputs.humidity) changes.push("Humidity");
    if (editedInputs.problemDescription !== inputs.problemDescription) changes.push("Problem description");
    return changes;
  }

  function handleReset() {
    setEditedInputs(inputs);
    setRerunError(null);
  }

  async function handleRerun() {
    setIsRerunning(true);
    setRerunError(null);
    try {
      await onRerun(editedInputs);
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to re-run analysis";
      setRerunError(message);
      setIsRerunning(false);
    }
  }

  const hasChanges = calculateChanges().length > 0;
  const changes = calculateChanges();

  const hasPrinterChanges = editedInputs.printerModel !== inputs.printerModel || editedInputs.nozzleDiameter !== inputs.nozzleDiameter;
  const hasFilamentChanges = editedInputs.filamentType !== inputs.filamentType || editedInputs.filamentBrand !== inputs.filamentBrand;
  const hasPrintSettingsChanges = editedInputs.printPriority !== inputs.printPriority || editedInputs.printPurpose !== inputs.printPurpose || editedInputs.bedSurface !== inputs.bedSurface || editedInputs.humidity !== inputs.humidity;
  const hasProblemChanges = editedInputs.problemDescription !== inputs.problemDescription;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/40 dark:bg-black/60 z-40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-in panel */}
      <div
        className={clsx(
          "fixed right-0 top-0 bottom-0 bg-white dark:bg-slate-900 shadow-2xl z-50 transition-transform duration-300",
          "w-full sm:w-[480px] overflow-y-auto flex flex-col"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <h2 className="font-bold text-lg text-slate-900 dark:text-slate-100">⚙️ Adjust Settings</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close panel"
          >
            <X size={20} className="text-slate-600 dark:text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {/* Printer & Nozzle section */}
            <CollapsibleSection
              title="Printer & Nozzle"
              defaultOpen={false}
              hasChanges={hasPrinterChanges}
            >
              <FormField label="Printer Model">
                <SearchableSelect
                  items={printers.map((p) => ({
                    id: p.id,
                    label: `${p.vendorName} ${p.modelName}`,
                  }))}
                  groups={Array.from(
                    new Set(printers.map((p) => p.vendorName))
                  ).map((vendor) => ({
                    name: vendor,
                    items: printers
                      .filter((p) => p.vendorName === vendor)
                      .map((p) => ({
                        id: p.id,
                        label: p.modelName,
                      })),
                  }))}
                  value={editedInputs.printerModel}
                  onChange={(value) => set("printerModel", value)}
                  placeholder="Select printer..."
                  disabled={equipmentLoading}
                />
                {editedInputs.printerModel && printers.length > 0 && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                    Current: {getPrinterDisplayName(editedInputs.printerModel)}
                  </p>
                )}
                {isOtherPrinter && (
                  <OtherEquipmentForm
                    equipmentType="printer"
                    isExpanded={isOtherPrinter}
                    onSubmit={(data) => {
                      setPendingPrinterSuggestion(data);
                      setShowPrinterSuggestionModal(true);
                    }}
                    onCancel={() => {
                      set("printerModel", "");
                      setIsOtherPrinter(false);
                    }}
                  />
                )}
              </FormField>

              <FormField label="Nozzle Diameter">
                <select
                  value={editedInputs.nozzleDiameter}
                  onChange={(e) => set("nozzleDiameter", parseFloat(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value={0.2}>0.2mm (ultra-detail)</option>
                  <option value={0.4}>0.4mm (standard)</option>
                  <option value={0.6}>0.6mm (fast)</option>
                  <option value={0.8}>0.8mm (very fast)</option>
                </select>
              </FormField>
            </CollapsibleSection>

            {/* Filament section */}
            <CollapsibleSection
              title="Filament"
              defaultOpen={false}
              hasChanges={hasFilamentChanges}
            >
              <FormField label="Material Type">
                <select
                  value={editedInputs.filamentType}
                  onChange={(e) => set("filamentType", e.target.value as UserInputs["filamentType"])}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  {FILAMENT_TYPES.map((ft) => (
                    <option key={ft.id} value={ft.id}>
                      {ft.label}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField
                label="Brand/Manufacturer"
                description="Optional — used to lookup specs in Open Filament Database"
              >
                <input
                  type="text"
                  value={editedInputs.filamentBrand}
                  onChange={(e) => set("filamentBrand", e.target.value)}
                  placeholder="e.g., Bambu Lab, MatterHackers..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
                />
              </FormField>

              {filamentDBData && (
                <div className="text-xs bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-2.5 text-emerald-700 dark:text-emerald-300">
                  ✓ Found in Open Filament Database: {filamentDBData.printTempMin}–{filamentDBData.printTempMax}°C
                </div>
              )}
            </CollapsibleSection>

            {/* Print Settings section */}
            <CollapsibleSection
              title="Print Settings"
              defaultOpen={true}
              hasChanges={hasPrintSettingsChanges}
            >
              <FormField label="Quality Tier">
                <div className="grid grid-cols-2 gap-2">
                  {QUALITY_TIERS.map((tier) => (
                    <button
                      key={tier.id}
                      onClick={() => set("printPriority", tier.id)}
                      className={clsx(
                        "p-3 rounded-lg border-2 transition-all text-left",
                        editedInputs.printPriority === tier.id
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                          : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                      )}
                    >
                      <span className="text-lg">{tier.icon}</span>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{tier.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{tier.desc}</p>
                    </button>
                  ))}
                </div>
              </FormField>

              <FormField label="Print Purpose">
                <div className="grid grid-cols-3 gap-2">
                  {PRINT_PURPOSES.map((purpose) => (
                    <button
                      key={purpose.id}
                      onClick={() => set("printPurpose", purpose.id)}
                      className={clsx(
                        "p-3 rounded-lg border-2 transition-all text-center",
                        editedInputs.printPurpose === purpose.id
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                          : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                      )}
                    >
                      <span className="text-xl">{purpose.icon}</span>
                      <p className="text-xs font-medium text-slate-900 dark:text-slate-100 mt-1">{purpose.name}</p>
                    </button>
                  ))}
                </div>
              </FormField>

              <FormField label="Bed Surface">
                <SearchableSelect
                  items={surfaces.map((s) => ({
                    id: s.id,
                    label: s.displayName,
                  }))}
                  groups={Array.from(
                    new Set(surfaces.map((s) => s.group || "Other"))
                  ).map((groupName) => ({
                    name: groupName,
                    items: surfaces
                      .filter((s) => (s.group || "Other") === groupName)
                      .map((s) => ({
                        id: s.id,
                        label: s.displayName,
                      })),
                  }))}
                  value={editedInputs.bedSurface}
                  onChange={(value) => set("bedSurface", value)}
                  placeholder="Select surface..."
                  disabled={equipmentLoading}
                />
                {editedInputs.bedSurface && surfaces.length > 0 && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                    Current: {getSurfaceDisplayName(editedInputs.bedSurface)}
                  </p>
                )}
                {isOtherSurface && (
                  <OtherEquipmentForm
                    equipmentType="surface"
                    isExpanded={isOtherSurface}
                    onSubmit={(data) => {
                      setPendingSurfaceSuggestion(data);
                      setShowSurfaceSuggestionModal(true);
                    }}
                    onCancel={() => {
                      set("bedSurface", "");
                      setIsOtherSurface(false);
                    }}
                  />
                )}
              </FormField>

              <FormField label="Ambient Humidity">
                <select
                  value={editedInputs.humidity}
                  onChange={(e) => set("humidity", e.target.value as UserInputs["humidity"])}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="Low">Low</option>
                  <option value="Normal">Normal</option>
                  <option value="High">High</option>
                </select>
              </FormField>
            </CollapsibleSection>

            {/* Problem Description section */}
            <CollapsibleSection
              title="Problem Description"
              defaultOpen={false}
              hasChanges={hasProblemChanges}
            >
              <FormField
                label="Describe Any Issues"
                description="Optional — helps Claude provide more targeted recommendations"
              >
                <textarea
                  value={editedInputs.problemDescription}
                  onChange={(e) => set("problemDescription", e.target.value)}
                  placeholder="e.g., 'Bed adhesion problems', 'Stringing issues', etc."
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 resize-none"
                />
              </FormField>
            </CollapsibleSection>
          </div>
        </div>

        {/* Footer with action buttons */}
        <div className="flex-shrink-0 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-5 py-4 space-y-4">
          {/* Changes summary */}
          {hasChanges && (
            <div className="text-xs bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-amber-700 dark:text-amber-300">
              <p className="font-medium mb-1">Changes:</p>
              <ul className="list-disc list-inside space-y-0.5">
                {changes.map((change, i) => (
                  <li key={i}>{change}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Rate limit warning */}
          {remainingAnalyses === 1 && (
            <div className="text-xs bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg p-3 text-rose-700 dark:text-rose-300">
              <p className="font-medium">⚠️ Last free analysis today</p>
              <p className="mt-1">After this, you'll need to unlock for more analyses.</p>
            </div>
          )}

          {/* Error message */}
          {rerunError && (
            <div className="text-xs bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg p-3 text-rose-700 dark:text-rose-300">
              <p className="font-medium">Error re-running analysis</p>
              <p className="mt-1">{rerunError}</p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleReset}
              disabled={!hasChanges || isRerunning}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RotateCcw size={14} />
              Reset
            </button>

            <button
              onClick={handleRerun}
              disabled={!hasChanges || isRerunning || remainingAnalyses <= 0}
              className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isRerunning ? "Re-running..." : "Re-run Analysis"}
            </button>
          </div>
        </div>
      </div>

      {/* Suggestion modals */}
      {showPrinterSuggestionModal && pendingPrinterSuggestion && (
        <EquipmentSuggestionModal
          equipmentType="printer"
          data={pendingPrinterSuggestion}
          onClose={() => setShowPrinterSuggestionModal(false)}
          onSubmit={() => {
            setShowPrinterSuggestionModal(false);
            setPendingPrinterSuggestion(null);
          }}
        />
      )}

      {showSurfaceSuggestionModal && pendingSurfaceSuggestion && (
        <EquipmentSuggestionModal
          equipmentType="surface"
          data={pendingSurfaceSuggestion}
          onClose={() => setShowSurfaceSuggestionModal(false)}
          onSubmit={() => {
            setShowSurfaceSuggestionModal(false);
            setPendingSurfaceSuggestion(null);
          }}
        />
      )}
    </>
  );
}
