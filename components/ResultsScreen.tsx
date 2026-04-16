"use client";

import { RotateCcw, Copy, Check, Download, ExternalLink, Pencil, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import clsx from "clsx";
import type { GeometryAnalysis, UserInputs, PrintSettings, AdvancedSettings, AIEnhancements, ConfidenceLevel, FilamentDBResult, OutcomeFlag, FilamentPropertyDetails } from "@/lib/types";
import GeometryVisualizer from "./GeometryVisualizer";
import OutcomeFlagSelector from "./OutcomeFlagSelector";
import ShareCardSection from "./ShareCardSection";
import ConcernCard from "./ConcernCard";
import type { ShareCardData } from "@/lib/shareCard";
import { updateSessionName } from "@/lib/historyStore";
import { usePublicConfig } from "@/lib/publicConfig";

interface Props {
  geometry: GeometryAnalysis;
  meshVertices?: Float32Array;
  inputs: UserInputs;
  settings: PrintSettings;
  advancedSettings: AdvancedSettings;
  ai: AIEnhancements;
  printTimeMin: number;
  printTimeMax: number;
  onReset: () => void;
  filamentDBResult?: FilamentDBResult | null;
  multiObjectWarning?: boolean;
  /** Set when this is a saved session — enables the inline name editor. */
  sessionId?: string;
  /** Auto-generated default name shown in the name editor. */
  defaultSessionName?: string;
  /** Override the "Start over" button label (e.g. "← Back to history"). */
  resetLabel?: string;
  /** Current outcome flag value — passed down from parent state. */
  outcomeFlag?: OutcomeFlag;
  /** Called when the user picks or clears a flag pill. */
  onOutcomeFlagChange?: (flag: OutcomeFlag) => void;
  /** ISO timestamp of when the session was saved — used in share card footer. */
  savedAt?: string;
  /** Opens the limit/unlock modal — only passed on the main results page, not history. */
  onOpenUnlockModal?: () => void;
  /** Filament property details panel data. Optional — absent on sessions saved before v1.7.0. */
  filamentPropertyDetails?: FilamentPropertyDetails;
}

function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ─── Confidence badge ─────────────────────────────────────────────────────────

const CONFIDENCE_STYLES: Record<ConfidenceLevel, string> = {
  high:   "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  low:    "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};
const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  high: "High confidence",
  medium: "Good starting point",
  low: "May need tuning",
};

function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  return (
    <span className={clsx("text-[10px] font-semibold px-1.5 py-0.5 rounded-full", CONFIDENCE_STYLES[level])}>
      {level === "high" ? "✓ " : level === "medium" ? "~ " : "? "}
      {CONFIDENCE_LABELS[level]}
    </span>
  );
}

// ─── Setting card ─────────────────────────────────────────────────────────────

interface SettingCardProps {
  icon: string;
  label: string;
  value: string;
  explanation: string;
  confidence?: ConfidenceLevel;
}

function SettingCard({ icon, label, value, explanation, confidence }: SettingCardProps) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="card p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl flex-shrink-0">{icon}</span>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide truncate">{label}</span>
        </div>
        <button
          onClick={handleCopy}
          className="no-print flex-shrink-0 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Copy value"
        >
          {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
        </button>
      </div>
      <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
      {confidence && <ConfidenceBadge level={confidence} />}
      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{explanation}</p>
    </div>
  );
}

// ─── Advanced setting row ─────────────────────────────────────────────────────
// Format: [Name]: [Value] — [Plain-English explanation]

function AdvancedRow({ name, value, explanation }: { name: string; value: string; explanation: string }) {
  return (
    <div className="py-2.5 border-b border-slate-100 dark:border-slate-800/80 last:border-0">
      <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
        <span className="font-semibold">{name}:</span>{" "}
        <span className="text-slate-900 dark:text-slate-100 font-medium">{value}</span>
        {" — "}
        <span className="text-slate-500 dark:text-slate-400">{explanation}</span>
      </p>
    </div>
  );
}

function AdvancedNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 text-xs bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-xl px-4 py-2.5 text-sky-800 dark:text-sky-300 leading-relaxed">
      {children}
    </div>
  );
}

// ─── Session name editor ──────────────────────────────────────────────────────
// Inline editable field shown when a session has been auto-saved to history.
// Debounces writes to localStorage at 500ms to avoid excessive I/O.

function SessionNameEditor({
  sessionId,
  initialName,
  onNameChange,
}: {
  sessionId: string;
  initialName: string;
  onNameChange?: (name: string) => void;
}) {
  const [name, setName] = useState(initialName);
  const [editing, setEditing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.slice(0, 60);
    setName(val);
    onNameChange?.(val || initialName);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      updateSessionName(sessionId, val || initialName);
    }, 500);
  }

  function handleBlur() {
    setEditing(false);
    if (!name.trim()) {
      setName(initialName);
      onNameChange?.(initialName);
    }
  }

  return (
    <div className="no-print flex items-center gap-2 mt-2">
      <span className="text-xs text-slate-400 dark:text-slate-500 flex-shrink-0">Session name:</span>
      {editing ? (
        <input
          ref={inputRef}
          value={name}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={(e) => e.key === "Enter" && inputRef.current?.blur()}
          placeholder="e.g. Benchy - Standard PLA - first attempt"
          maxLength={60}
          className="flex-1 text-sm text-slate-700 dark:text-slate-200 bg-transparent border-b border-primary-400 focus:outline-none pb-0.5"
          autoComplete="off"
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 group"
          title="Click to edit session name"
        >
          <span className="truncate max-w-xs">{name}</span>
          <Pencil size={11} className="flex-shrink-0 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
        </button>
      )}
    </div>
  );
}

// ─── Filament showcase card ───────────────────────────────────────────────────

const MATERIAL_ACCENT: Record<string, string> = {
  PLA:       "border-l-teal-400 dark:border-l-teal-500",
  "PLA+":    "border-l-teal-400 dark:border-l-teal-500",
  "PLA Silk":"border-l-teal-400 dark:border-l-teal-500",
  "PLA-CF":  "border-l-teal-600 dark:border-l-teal-400",
  PETG:      "border-l-amber-400 dark:border-l-amber-500",
  "PETG-CF": "border-l-amber-500 dark:border-l-amber-400",
  ABS:       "border-l-orange-400 dark:border-l-orange-500",
  ASA:       "border-l-orange-500 dark:border-l-orange-400",
  TPU:       "border-l-purple-400 dark:border-l-purple-500",
  Nylon:     "border-l-sky-400 dark:border-l-sky-500",
  PC:        "border-l-blue-500 dark:border-l-blue-400",
  Resin:     "border-l-violet-400 dark:border-l-violet-500",
};

const MATERIAL_BADGE: Record<string, string> = {
  PLA:       "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  "PLA+":    "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  "PLA Silk":"bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  "PLA-CF":  "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-200",
  PETG:      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  "PETG-CF": "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
  ABS:       "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  ASA:       "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  TPU:       "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  Nylon:     "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  PC:        "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  Resin:     "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
};

function FilamentShowcaseCard({
  filamentType,
  filamentDB,
  materialBlurb,
}: {
  filamentType: string;
  filamentDB: FilamentDBResult;
  materialBlurb?: string;
}) {
  const accentClass = MATERIAL_ACCENT[filamentType] ?? "border-l-slate-300 dark:border-l-slate-600";
  const badgeClass  = MATERIAL_BADGE[filamentType]  ?? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";

  return (
    <div className={clsx(
      "card border-l-4 p-5 space-y-4",
      accentClass,
    )}>
      {/* Top row — brand, material badge, finish/color chips */}
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
            Filament Profile
          </p>
          <p className="font-bold text-slate-900 dark:text-slate-100 text-base leading-tight">
            {filamentDB.name || filamentDB.manufacturer}
          </p>
          {filamentDB.name && filamentDB.name !== filamentDB.manufacturer && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{filamentDB.manufacturer}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 flex-shrink-0">
          <span className={clsx("text-xs font-semibold px-2.5 py-1 rounded-full", badgeClass)}>
            {filamentType}
          </span>
          {filamentDB.finish && (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {filamentDB.finish}
            </span>
          )}
          {filamentDB.color && (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              🎨 {filamentDB.color}
            </span>
          )}
        </div>
      </div>

      {/* Temp + spec chips */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 px-2.5 py-1 text-orange-700 dark:text-orange-400 font-medium">
          🌡️ Nozzle {filamentDB.printTempMin}–{filamentDB.printTempMax}°C
        </span>
        {(filamentDB.bedTempMin > 0 || filamentDB.bedTempMax > 0) && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-2.5 py-1 text-red-700 dark:text-red-400 font-medium">
            🔥 Bed {filamentDB.bedTempMin}–{filamentDB.bedTempMax}°C
          </span>
        )}
        {filamentDB.diameter !== undefined && (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-slate-600 dark:text-slate-300 font-medium">
            Ø {filamentDB.diameter}mm
          </span>
        )}
        {filamentDB.density !== undefined && (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-slate-600 dark:text-slate-300 font-medium">
            {filamentDB.density} g/cm³
          </span>
        )}
      </div>

      {/* Material blurb from Claude */}
      {materialBlurb && (
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-3.5">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">About this material</p>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{materialBlurb}</p>
        </div>
      )}

      {/* Attribution footer */}
      <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
        Data from{" "}
        <a
          href={filamentDB.dataUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary-500 dark:text-primary-400 hover:underline inline-flex items-center gap-0.5"
        >
          Open Filament Database <ExternalLink size={10} />
        </a>
        {" "}· Community-sourced · settings above may differ based on your specific printer and goals
      </p>
    </div>
  );
}

// ─── Concern callout extraction ─────────────────────────────────────────────────

/**
 * Extracts concern callouts from card explanations.
 * Pattern: "(This specifically addresses your [concern in 5 words].)"
 * Returns array of extracted callouts (max 3)
 */
function extractConcernCallouts(cards: SettingCardProps[]): string[] {
  const callouts: string[] = [];
  const pattern = /\(This specifically addresses your ([^)]+)\.\)/g;

  for (const card of cards) {
    if (callouts.length >= 3) break;
    const match = pattern.exec(card.explanation);
    if (match && match[1]) {
      callouts.push(match[1]);
    }
  }

  return callouts;
}

// ─── Settings panel with expandable advanced section ──────────────────────────

function SettingsPanel({
  panelIcon,
  panelTitle,
  cards,
  advanced,
}: {
  panelIcon: string;
  panelTitle: string;
  cards: SettingCardProps[];
  advanced: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const concernCallouts = extractConcernCallouts(cards);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen((o) => !o);
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="p-5 pb-4">
        <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <span>{panelIcon}</span> {panelTitle}
        </p>
        <div className={`grid gap-3 ${cards.length >= 2 ? "sm:grid-cols-2" : ""}`}>
          {cards.map((card) => (
            <SettingCard key={card.label} {...card} />
          ))}
        </div>

        {/* Concern callouts — shown when Claude flagged this panel as relevant to user's concern */}
        {concernCallouts.length > 0 && (
          <div className="mt-3 space-y-2">
            {concernCallouts.map((callout, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 p-2.5 rounded-lg bg-teal-50 dark:bg-teal-900/20 border-l-2 border-teal-500 dark:border-teal-400"
              >
                <span className="text-teal-600 dark:text-teal-400 flex-shrink-0 mt-0.5 text-sm">💡</span>
                <p className="text-xs text-teal-700 dark:text-teal-300">
                  <span className="font-medium">Addresses your concern:</span> {callout}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Expand toggle — hidden in print */}
      <button
        className="no-print w-full flex items-center gap-2 px-5 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 transition-colors select-none"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={handleKeyDown}
        aria-expanded={open}
        aria-label={`${open ? "Collapse" : "Expand"} advanced settings for ${panelTitle}`}
      >
        <span
          className="text-sm leading-none transition-transform duration-200 inline-block"
          style={{ transform: open ? "rotate(45deg)" : "rotate(0deg)" }}
          aria-hidden="true"
        >
          +
        </span>
        Advanced settings
      </button>

      {/* Smooth height animation using CSS grid-template-rows trick */}
      <div
        className="no-print grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="px-5 pb-5 pt-1 border-t border-slate-100 dark:border-slate-800">
            {advanced}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Filament Property Details panel ─────────────────────────────────────────

const LS_DETAILS_KEY = "printperfect_filament_details_collapsed";

function DetailSubSection({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3.5 space-y-1.5">
      <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
        <span>{icon}</span> {title}
      </p>
      {children}
    </div>
  );
}

function DetailRow({ label, value, ofd = false }: { label: string; value: string; ofd?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-xs border-b border-slate-200 dark:border-slate-700/60 last:border-0 py-1 first:pt-0 last:pb-0">
      <span className="text-slate-500 dark:text-slate-400 flex-shrink-0">{label}</span>
      <span className={clsx("font-semibold text-right", ofd ? "text-teal-600 dark:text-teal-400" : "text-slate-800 dark:text-slate-100")}>
        {value}
        {ofd && <span className="ml-1.5 text-[10px] font-medium px-1 py-0.5 rounded bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400">OFD</span>}
      </span>
    </div>
  );
}

function FilamentPropertyDetailsPanel({ details, filamentType }: { details: FilamentPropertyDetails; filamentType: string }) {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(LS_DETAILS_KEY) === "1"; } catch { return false; }
  });

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem(LS_DETAILS_KEY, next ? "1" : "0"); } catch { /* private mode */ }
  }

  const isResin = details.recommendedPrintTemp === 0;
  const paNotApplicable = details.pressureAdvanceRange === null;

  return (
    <div
      className="card overflow-hidden border-l-4 no-print"
      style={{ borderLeftColor: "#7F77DD" }}
    >
      {/* Panel header / toggle */}
      <button
        type="button"
        onClick={toggle}
        aria-expanded={!collapsed}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-lg">🧬</span>
          <div>
            <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">Filament Property Details</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{filamentType} — deep dive into material-specific values</p>
          </div>
        </div>
        <ChevronDown
          size={16}
          className={clsx("flex-shrink-0 text-slate-400 transition-transform duration-200", collapsed && "rotate-180")}
        />
      </button>

      {/* Collapsible body */}
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: collapsed ? "0fr" : "1fr" }}
      >
        <div className="overflow-hidden">
          <div className="px-5 pb-5 pt-1 border-t border-slate-100 dark:border-slate-800 space-y-3">

            {/* Material description */}
            {details.materialDescription && (
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed italic">
                {details.materialDescription}
              </p>
            )}

            {/* 2-column sub-section grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

              {/* Temperature Profile */}
              <DetailSubSection icon="🌡️" title="Temperature Profile">
                <DetailRow label="Print range" value={`${details.printTempMin}–${details.printTempMax}°C`} ofd={details.ofdPrintTempRange} />
                <DetailRow label="Recommended" value={isResin ? "N/A" : `${details.recommendedPrintTemp}°C`} />
                <DetailRow label="First layer" value={isResin ? "N/A" : `${details.firstLayerTemp}°C`} />
                <DetailRow label="Standby" value={isResin ? "N/A" : `${details.standbyTemp}°C`} />
                {!isResin && <DetailRow label="Temp tower range" value={`${details.tempTowerMin}–${details.tempTowerMax}°C`} />}
              </DetailSubSection>

              {/* Cooling Settings */}
              <DetailSubSection icon="❄️" title="Cooling Settings">
                <DetailRow label="Fan speed" value={`${details.coolingFanPct}%`} />
                <DetailRow label="Min layer time" value={`${details.minLayerTimeSec}s`} />
                <DetailRow label="Fan ramp" value={details.fanRampStrategy} />
                <DetailRow label="Bridge fan" value={`${details.bridgeFanOverridePct}%`} />
                <DetailRow
                  label="Overhang boost"
                  value={details.overhangFanBoostPct > 0 ? `${details.overhangFanBoostPct}%` : "Not applicable"}
                />
              </DetailSubSection>

              {/* Retraction Settings */}
              <DetailSubSection icon="🔄" title="Retraction Settings">
                {isResin ? (
                  <p className="text-xs text-slate-400 dark:text-slate-500 italic py-1">Retraction does not apply to resin printers.</p>
                ) : (
                  <>
                    <DetailRow label="Direct drive" value={`${details.retractionDirectDriveMm}mm`} />
                    <DetailRow label="Bowden" value={`${details.retractionBowdenMm}mm`} />
                    <DetailRow label="Retraction speed" value={`${details.retractionSpeedMms}mm/s`} />
                    <DetailRow label="Z-hop" value={details.zHopMm > 0 ? `${details.zHopMm}mm` : "Off"} />
                  </>
                )}
              </DetailSubSection>

              {/* Pressure Advance / Linear Advance */}
              <DetailSubSection icon="📐" title="Pressure / Linear Advance">
                {paNotApplicable ? (
                  <p className="text-xs text-slate-400 dark:text-slate-500 italic py-1">{details.pressureAdvanceNote}</p>
                ) : (
                  <>
                    <DetailRow
                      label="Starting range"
                      value={`${details.pressureAdvanceRange!.min} – ${details.pressureAdvanceRange!.max}`}
                    />
                    <p className="text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed pt-1">
                      {details.pressureAdvanceNote}
                    </p>
                  </>
                )}
              </DetailSubSection>

              {/* Filament Physical Properties */}
              <DetailSubSection icon="⚖️" title="Physical Properties">
                <DetailRow label="Density" value={`${details.densityGcm3} g/cm³`} ofd={details.ofdDensity} />
                <DetailRow label="Diameter" value={`${details.diameterMm}mm`} ofd={details.ofdDiameter} />
              </DetailSubSection>

              {/* Special Notes */}
              <DetailSubSection icon="💬" title="Special Notes">
                {details.specialNotes.length > 0 ? (
                  <ul className="space-y-2 pt-0.5">
                    {details.specialNotes.map((note, i) => (
                      <li key={i} className="flex gap-2 items-start text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        <span className="flex-shrink-0 text-violet-400 dark:text-violet-500 mt-0.5 text-[10px]">•</span>
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-400 dark:text-slate-500 italic py-1">No special notes for this setup.</p>
                )}
              </DetailSubSection>

            </div>

            {/* OFD attribution note when any OFD values are present */}
            {(details.ofdPrintTempRange || details.ofdDensity || details.ofdDiameter) && (
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                <span className="inline-block px-1 py-0.5 rounded bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400 font-medium mr-1">OFD</span>
                Values sourced from the Open Filament Database for your specific filament.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ResultsScreen({
  geometry, meshVertices, inputs, settings, advancedSettings, ai, printTimeMin, printTimeMax, onReset, filamentDBResult, multiObjectWarning, sessionId, defaultSessionName: propSessionName, resetLabel, outcomeFlag, onOutcomeFlagChange, savedAt, onOpenUnlockModal, filamentPropertyDetails,
}: Props) {

  // Dynamic config — drives feature flags and URL overrides
  const publicConfig = usePublicConfig();

  // Track the displayed session name so ShareCardSection can stay current
  const [displayedSessionName, setDisplayedSessionName] = useState(propSessionName ?? "");
  // Whether the user has ever interacted with the outcome flag picker this session
  const [flagInteracted, setFlagInteracted] = useState(
    outcomeFlag !== null && outcomeFlag !== undefined,
  );

  const conf = ai.settingConfidence ?? {};
  const adv  = advancedSettings;

  // Share card data — rebuilt whenever relevant state changes
  // Null when shareCardEnabled=false so ShareCardSection is hidden
  const shareData: ShareCardData | null = (sessionId && publicConfig.shareCardEnabled)
    ? {
        sessionName: displayedSessionName || propSessionName || geometry.fileName,
        inputs,
        settings,
        geometry,
        outcomeFlag: outcomeFlag ?? null,
        savedAt,
      }
    : null;

  function handleFlagChange(flag: OutcomeFlag) {
    setFlagInteracted(true);
    onOutcomeFlagChange?.(flag);
  }

  // ── Individual setting card definitions ──────────────────────────────────────

  const layerHeightCard: SettingCardProps = {
    icon: "📏", label: "Layer Height",
    value: `${settings.layerHeight}mm`,
    confidence: conf.layerHeight,
    explanation: ai.settingExplanations.layerHeight,
  };
  const printTempCard: SettingCardProps = {
    icon: "🌡️", label: "Print Temperature",
    value: `${settings.printTemp}°C`,
    confidence: conf.printTemp,
    explanation: ai.settingExplanations.printTemp,
  };
  const bedTempCard: SettingCardProps = {
    icon: "🔥", label: "Bed Temperature",
    value: settings.bedTemp > 0 ? `${settings.bedTemp}°C` : "N/A",
    confidence: conf.bedTemp,
    explanation: ai.settingExplanations.bedTemp,
  };
  const printSpeedCard: SettingCardProps = {
    icon: "⚡", label: "Print Speed",
    value: settings.printTemp > 0 ? `${settings.printSpeed}mm/s` : "Per resin profile",
    confidence: conf.printSpeed,
    explanation: ai.settingExplanations.printSpeed,
  };
  const coolingFanCard: SettingCardProps = {
    icon: "❄️", label: "Cooling Fan",
    value: `${settings.coolingFan}%`,
    confidence: conf.coolingFan,
    explanation: ai.settingExplanations.coolingFan,
  };
  const infillCard: SettingCardProps = {
    icon: "🏗️", label: "Infill",
    value: `${settings.infill}%`,
    confidence: conf.infill,
    explanation: ai.settingExplanations.infill,
  };
  const supportsCard: SettingCardProps = {
    icon: "🌳", label: "Supports",
    value: settings.supportType === "None"
      ? "None needed"
      : `${settings.supportType} at ${settings.supportDensity}%`,
    confidence: conf.supports,
    explanation: ai.settingExplanations.supports,
  };
  const adhesionCard: SettingCardProps = {
    icon: "🧲", label: "Bed Adhesion",
    value: settings.adhesion === "None"
      ? "None needed"
      : `${settings.adhesion}${settings.adhesionWidth > 0 ? ` (${settings.adhesionWidth}mm)` : ""}`,
    confidence: conf.adhesion,
    explanation: ai.settingExplanations.adhesion,
  };
  const wallCountCard: SettingCardProps = {
    icon: "🧱", label: "Wall Count",
    value: `${settings.wallCount} walls`,
    confidence: conf.walls,
    explanation: ai.settingExplanations.walls,
  };

  // ── Advanced panel content per category ──────────────────────────────────────

  const temperatureAdvanced = (
    <div>
      {settings.printTemp > 0 ? (
        <>
          <AdvancedRow
            name="First layer nozzle temp"
            value={`${adv.firstLayerTemp}°C`}
            explanation="Slightly hotter first layer improves bed adhesion — the extra heat helps plastic squish into the surface texture."
          />
          <AdvancedRow
            name="Standby temperature"
            value={`${adv.standbyTemp}°C`}
            explanation="Temperature the nozzle holds during long travel moves; keeps it ready without oozing filament onto the model."
          />
          {adv.chamberTempRecommendation && (
            <AdvancedRow
              name="Chamber temp recommendation"
              value={adv.chamberTempRecommendation}
              explanation="If your printer is enclosed, a warm chamber helps prevent warping and layer delamination for this material. Keep the door closed during the print."
            />
          )}
          <AdvancedNote>
            💡 If this is a new filament brand, consider printing a temperature tower between {adv.tempTowerMin}°C and {adv.tempTowerMax}°C to find the sweet spot for your specific spool.
          </AdvancedNote>
        </>
      ) : (
        <p className="text-xs text-slate-500 dark:text-slate-400 italic py-1">
          Resin printers use UV exposure time rather than temperature — consult your resin brand&apos;s data sheet for exposure settings.
        </p>
      )}
    </div>
  );

  const speedAdvanced = (
    <div>
      {settings.printTemp > 0 ? (
        <>
          <AdvancedRow
            name="Outer wall speed"
            value={`${adv.outerWallSpeed}mm/s`}
            explanation="The outermost surface layer; slower speed gives a smoother, cleaner visible finish."
          />
          <AdvancedRow
            name="Inner wall speed"
            value={`${adv.innerWallSpeed}mm/s`}
            explanation="Interior perimeter walls; can be faster since they're hidden inside the model."
          />
          <AdvancedRow
            name="Top/bottom surface speed"
            value={`${adv.topBottomSpeed}mm/s`}
            explanation="Flat top and bottom layers; slower gives a cleaner, more even surface texture."
          />
          <AdvancedRow
            name="First layer speed"
            value={`${adv.firstLayerSpeed}mm/s`}
            explanation="Always slower to ensure good bed adhesion before the rest of the print starts."
          />
          <AdvancedRow
            name="Bridge speed"
            value={`${adv.bridgeSpeed}mm/s`}
            explanation="Speed for spans printed in mid-air with no support below; slower reduces sagging."
          />
          <AdvancedRow
            name="Travel speed"
            value={`${adv.travelSpeed}mm/s`}
            explanation="Speed when the nozzle moves without extruding; faster travel reduces the chance of stringing."
          />
        </>
      ) : (
        <p className="text-xs text-slate-500 dark:text-slate-400 italic py-1">
          Speed settings do not apply to resin printers.
        </p>
      )}
    </div>
  );

  const coolingAdvanced = (
    <div>
      <AdvancedRow
        name="Minimum layer time"
        value={`${adv.minLayerTime}s`}
        explanation="Forces the printer to slow down on very small layers so they have time to cool before the next layer is added on top."
      />
      <AdvancedRow
        name="Fan ramp-up"
        value={adv.fanRampUp}
        explanation="First layers print with less cooling to improve bed adhesion; the fan ramps up to full speed after those early layers are done."
      />
      <AdvancedRow
        name="Bridge fan override"
        value={`${adv.bridgeFanOverride}%`}
        explanation="Bridges always use maximum cooling regardless of other fan settings, to prevent mid-air sections from sagging."
      />
      <AdvancedRow
        name="Overhang fan boost"
        value={adv.overhangFanBoost > 0 ? `${adv.overhangFanBoost}%` : "Not applicable"}
        explanation="Fan increases for steep overhangs to help the plastic hold its shape before the next layer arrives."
      />
    </div>
  );

  const supportsAdvanced = (
    <div>
      {settings.supportType === "None" && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 italic">
          Supports are not required for this model. If you manually enable them in your slicer, these are the recommended settings:
        </p>
      )}
      <AdvancedRow
        name="Support Z distance"
        value={`${adv.supportZDistance}mm`}
        explanation="Gap between the top of supports and the bottom of your model; too small = hard to remove, too large = rough surface where they touched."
      />
      <AdvancedRow
        name="Support interface layers"
        value={String(adv.supportInterfaceLayers)}
        explanation="Dense smooth layers at the top of supports for a better surface finish where the support meets your model."
      />
      <AdvancedRow
        name="Interface layer spacing"
        value={`${adv.interfaceSpacing}mm`}
        explanation="A tiny gap in the interface layer makes supports easier to peel off cleanly after the print."
      />
      <AdvancedRow
        name="Horizontal expansion"
        value={`${adv.horizontalExpansion}mm`}
        explanation="How far supports extend outward from the overhang edge; a small overlap ensures overhanging edges are properly caught."
      />
      <AdvancedRow
        name="Support pattern"
        value={adv.supportPattern}
        explanation={
          adv.supportPattern === "Tree"
            ? "Tree supports branch up from the bed to touch overhangs at minimal contact points — easier to remove and less material waste."
            : "Grid pattern provides uniform coverage and is compatible with all slicers — reliable for moderate overhangs."
        }
      />
      <AdvancedRow
        name="Support roof"
        value={adv.supportRoofEnabled ? "Enabled" : "Disabled"}
        explanation={
          adv.supportRoofEnabled
            ? "A dense roof layer between support and model improves the surface quality of overhanging areas at the cost of slightly harder removal."
            : "Disabled for faster prints; enable manually in your slicer if the underside of overhangs needs a cleaner finish."
        }
      />
    </div>
  );

  const adhesionAdvanced = (
    <div>
      <AdvancedRow
        name="First layer height"
        value={`${adv.firstLayerHeight}mm`}
        explanation="Slightly thicker than subsequent layers to squish into the bed surface for better grip — applies regardless of your quality tier layer height."
      />
      <AdvancedRow
        name="Elephant foot compensation"
        value={`${adv.elephantFootCompensation}mm`}
        explanation="Corrects for the slight squishing of the first layer that can make the base of a model wider than intended."
      />
      {adv.brimGap !== null && (
        <AdvancedRow
          name="Brim gap"
          value={`${adv.brimGap}mm`}
          explanation="A tiny gap between the brim and your model makes the brim much easier to snap off cleanly without leaving marks."
        />
      )}
      <AdvancedRow
        name="Skirt lines"
        value={String(adv.skirtLines)}
        explanation="Priming lines printed around the model before it starts, ensuring filament is flowing consistently before the real print begins."
      />
      <AdvancedNote>
        💡 If your first layer isn&apos;t sticking or is being scraped off, adjusting your Live Z offset on your printer is often the real fix — not changing slicer settings.
      </AdvancedNote>
    </div>
  );

  return (
    <div className="animate-slide-up space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 no-print">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Your Print Settings</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            Tailored for <strong>{inputs.filamentType}</strong> on <strong>{inputs.printerModel}</strong> · Priority: {inputs.printPriority}
          </p>
          {sessionId && propSessionName && (
            <SessionNameEditor
              sessionId={sessionId}
              initialName={propSessionName}
              onNameChange={setDisplayedSessionName}
            />
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="btn-secondary text-sm"
            title="Save as PDF via browser print dialog"
          >
            <Download size={15} /> Save as PDF
          </button>
          <button onClick={onReset} className="btn-secondary text-sm">
            <RotateCcw size={15} /> {resetLabel ?? "Start over"}
          </button>
        </div>
      </div>

      {/* Multi-object warning banner */}
      {multiObjectWarning && (
        <div className="no-print rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 flex items-center gap-3 text-sm text-amber-800 dark:text-amber-300">
          <span className="text-base flex-shrink-0">⚠️</span>
          <span>
            <strong>Note:</strong> These results are based on a multi-object .3mf file. Geometry analysis may be less accurate — overhang detection and support estimates in particular may be off.
          </span>
        </div>
      )}

      {/* Print header (shows only in print/PDF) */}
      <div className="hidden print:block mb-4">
        <h1 className="text-2xl font-bold">PrintPerfect — Recommended Settings</h1>
        <p className="text-sm text-slate-600 mt-1">
          {inputs.filamentType} · {inputs.printerModel} · Nozzle {inputs.nozzleDiameter}mm · Priority: {inputs.printPriority}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">Generated at printperfect.app</p>
      </div>

      {/* Concern card — shown when user described a problem and Claude classified it */}
      {ai.concernResponse && inputs.problemDescription && (
        <ConcernCard
          concern={ai.concernResponse}
          problemDescription={inputs.problemDescription}
        />
      )}

      {/* Filament showcase card — shown when OFD returned a match */}
      {filamentDBResult && (
        <FilamentShowcaseCard
          filamentType={inputs.filamentType}
          filamentDB={filamentDBResult}
          materialBlurb={ai.materialBlurb}
        />
      )}

      {/* Geometry summary */}
      <div className="card p-6">
        <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
          <span>📐</span> Geometry Summary
        </h3>
        <GeometryVisualizer
          geometry={geometry}
          meshVertices={meshVertices}
          filamentType={inputs.filamentType}
          infillPct={settings.infill}
        />
        {ai.geometrySummary && (
          <p className="mt-4 text-slate-600 dark:text-slate-300 text-sm leading-relaxed bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
            {ai.geometrySummary}
          </p>
        )}
      </div>

      {/* Print time estimate */}
      <div className="rounded-2xl bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 p-5 flex items-center gap-4">
        <span className="text-3xl">⏱️</span>
        <div>
          <p className="text-xs font-semibold text-primary-600 dark:text-primary-400 uppercase tracking-wide">Estimated print time</p>
          <p className="text-2xl font-bold text-primary-800 dark:text-primary-300">
            {formatTime(printTimeMin)} – {formatTime(printTimeMax)}
          </p>
          <p className="text-xs text-primary-600 dark:text-primary-400 mt-0.5">
            Rough estimate — your slicer will give a more accurate time after slicing
          </p>
        </div>
      </div>

      {/* ── Tip jar — positioned between print time and recommended settings ── */}
      <div className="no-print space-y-3">
        {/* Section heading */}
        <div className="text-center">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Keep Print Perfect free</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed max-w-[480px] mx-auto">
            Every analysis runs on real AI that costs real money. If Print Perfect helped you, here&apos;s how to say thanks.
          </p>
        </div>

        {/* Side-by-side cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">

          {/* Ko-fi card */}
          <div
            className="flex flex-col rounded-2xl border border-slate-200/50 dark:border-slate-700/50 bg-white dark:bg-slate-900 p-5"
            style={{ borderTop: "3px solid #29ABE0" }}
          >
            <span className="text-[28px] leading-none mb-3">☕</span>
            <p className="font-medium text-slate-800 dark:text-slate-100 text-base mb-2">Buy me a coffee</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
              The preferred way to support. Even $1–$2 covers real API costs and keeps analyses free for everyone.
            </p>
            <div className="mt-auto flex flex-col gap-2">
              <a
                href={publicConfig.kofiUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block"
              >
                <img
                  src="https://storage.ko-fi.com/cdn/kofi2.png?v=3"
                  alt="Buy Me a Coffee at ko-fi.com"
                  className="h-10 hover:opacity-90 transition-opacity"
                />
              </a>
            </div>
          </div>

          {/* MakerWorld card */}
          <div
            className="flex flex-col rounded-2xl border border-slate-200/50 dark:border-slate-700/50 bg-white dark:bg-slate-900 p-5"
            style={{ borderTop: "3px solid #1D9E75" }}
          >
            <span className="text-[28px] leading-none mb-3">🌟</span>
            <p className="font-medium text-slate-800 dark:text-slate-100 text-base mb-2">No budget? No problem.</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
              If you have a MakerWorld account, a free Boost or Like on our page takes 10 seconds and helps more makers discover this tool.
            </p>
            <div className="mt-auto flex flex-col gap-2">
              <a
                href={publicConfig.makerWorldUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center w-full px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Visit us on MakerWorld →
              </a>
              <p className="text-[12px] text-slate-400 dark:text-slate-500 italic">
                Completely free — no payment needed.
              </p>
            </div>
          </div>

        </div>

        {/* Footer note */}
        <p className="text-[13px] text-center text-slate-400 dark:text-slate-500 mt-1">
          Print Perfect will always be free. No ads, no accounts required, no data stored. Just a maker helping makers. 🖨️
        </p>
      </div>

      {/* Confidence legend (screen only) */}
      <div className="no-print flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400 items-center">
        <span className="font-semibold">Confidence:</span>
        <span className={clsx("px-2 py-0.5 rounded-full font-medium", CONFIDENCE_STYLES.high)}>✓ High — well established</span>
        <span className={clsx("px-2 py-0.5 rounded-full font-medium", CONFIDENCE_STYLES.medium)}>~ Medium — good start, may need tuning</span>
        <span className={clsx("px-2 py-0.5 rounded-full font-medium", CONFIDENCE_STYLES.low)}>? Low — dial in with test prints</span>
      </div>

      {/* Recommended settings — section heading */}
      <h3 className="font-bold text-slate-800 dark:text-slate-100">Recommended Settings</h3>

      {/* Core settings — no advanced section (print-visible) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 print-settings-grid">
        <SettingCard {...layerHeightCard} />
        <SettingCard {...infillCard} />
        <SettingCard {...wallCountCard} />
      </div>

      {/* ── Grouped panels with expandable advanced sections ── */}

      <SettingsPanel
        panelIcon="🌡️"
        panelTitle="Temperature"
        cards={[printTempCard, bedTempCard]}
        advanced={temperatureAdvanced}
      />

      <SettingsPanel
        panelIcon="⚡"
        panelTitle="Print Speed"
        cards={[printSpeedCard]}
        advanced={speedAdvanced}
      />

      <SettingsPanel
        panelIcon="❄️"
        panelTitle="Cooling Fan"
        cards={[coolingFanCard]}
        advanced={coolingAdvanced}
      />

      <SettingsPanel
        panelIcon="🌳"
        panelTitle="Supports"
        cards={[supportsCard]}
        advanced={supportsAdvanced}
      />

      <SettingsPanel
        panelIcon="🧲"
        panelTitle="Bed &amp; Adhesion"
        cards={[adhesionCard]}
        advanced={adhesionAdvanced}
      />

      {/* Filament Property Details panel */}
      {filamentPropertyDetails && (
        <FilamentPropertyDetailsPanel
          details={filamentPropertyDetails}
          filamentType={inputs.filamentType}
        />
      )}

      {/* Watch out for */}
      {ai.watchOutFor?.length > 0 && (
        <div className="card p-6">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
            <span>⚠️</span> Watch Out For
          </h3>
          <ul className="space-y-3">
            {ai.watchOutFor.map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                <span className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tips for success */}
      {ai.tipsForSuccess?.length > 0 && (
        <div className="card p-6">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
            <span>💡</span> Tips for Success
          </h3>
          <ul className="space-y-3">
            {ai.tipsForSuccess.map((tip, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                <span className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Common mistakes */}
      {ai.commonMistakes?.length > 0 && (
        <div className="card p-6">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-1 flex items-center gap-2">
            <span>🚫</span> Common Mistakes to Avoid
          </h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">
            Specific to {inputs.filamentType} on {inputs.printerModel}
          </p>
          <ul className="space-y-3">
            {ai.commonMistakes.map((mistake, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center justify-center">✕</span>
                <span className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{mistake}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Outcome flag + share card (only when a session is active) ── */}
      {sessionId && onOutcomeFlagChange && (
        <>
          {/* How did your print go? */}
          <div
            className="no-print card p-5 space-y-3 transition-opacity duration-300"
            style={{ opacity: flagInteracted ? 1 : 0.65 }}
          >
            <div>
              <p className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <span>🖨️</span>
                {flagInteracted && outcomeFlag
                  ? outcomeFlag === "success"
                    ? "Great — glad it worked out!"
                    : outcomeFlag === "partial"
                    ? "Partial success — noted for next time."
                    : "Noted — check tips and try again."
                  : "How did your print go?"}
              </p>
              {!flagInteracted && (
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  Flag the outcome after your print finishes — it&apos;ll appear on your share card too.
                </p>
              )}
            </div>
            <OutcomeFlagSelector
              currentFlag={outcomeFlag ?? null}
              onFlagChange={handleFlagChange}
            />
          </div>

          {/* Share card */}
          {shareData && <ShareCardSection data={shareData} />}
        </>
      )}

    </div>
  );
}
