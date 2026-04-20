"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSession, formatSessionDate } from "@/lib/historyStore";
import type { PrintSession } from "@/lib/types";
import type { EquipmentSurface, EquipmentPrinter, EquipmentListResponse } from "@/lib/equipmentSchemas";

// ── Comparison helpers ────────────────────────────────────────────────────────

interface CompareRow {
  label: string;
  a: string;
  b: string;
}

function fmt(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

// ── Section heading ───────────────────────────────────────────────────────────

function SectionHead({ title }: { title: string }) {
  return (
    <tr>
      <td
        colSpan={3}
        className="pt-6 pb-1 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest"
      >
        {title}
      </td>
    </tr>
  );
}

// ── Comparison row ────────────────────────────────────────────────────────────

function CompareRow({
  label,
  a,
  b,
}: {
  label: string;
  a: string;
  b: string;
}) {
  const different = a !== b;

  const cellBase = `py-2 px-3 text-sm align-top ${
    different
      ? "bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-200 font-medium"
      : "text-slate-700 dark:text-slate-300"
  }`;

  return (
    <tr className="border-b border-slate-100 dark:border-slate-800/60 last:border-0">
      {/* Label */}
      <td className="py-2 pr-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap align-top w-44">
        {label}
      </td>
      {/* Session A */}
      <td className={`${cellBase} rounded-l-lg`}>
        {a}
        {different && (
          <span className="ml-1.5 text-amber-500 dark:text-amber-400 text-xs" aria-hidden="true">
            ≠
          </span>
        )}
      </td>
      {/* Session B */}
      <td className={`${cellBase} rounded-r-lg`}>{b}</td>
    </tr>
  );
}

// ── Differences summary ───────────────────────────────────────────────────────

interface DiffEntry {
  label: string;
  a: string;
  b: string;
}

function DiffSummary({ diffs }: { diffs: DiffEntry[] }) {
  if (diffs.length === 0) {
    return (
      <div className="card p-6 text-center text-sm text-slate-500 dark:text-slate-400">
        ✓ No differences found between these two sessions.
      </div>
    );
  }

  return (
    <div className="card p-6 space-y-3">
      <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
        <span>🔍</span> Key differences at a glance
      </h3>
      <ul className="space-y-1.5">
        {diffs.map(({ label, a, b }) => (
          <li key={label} className="text-sm text-slate-600 dark:text-slate-300 flex gap-2">
            <span className="text-amber-500 flex-shrink-0">•</span>
            <span>
              <span className="font-medium text-slate-700 dark:text-slate-200">{label}:</span>{" "}
              {a} <span className="text-slate-400">(A)</span> vs {b}{" "}
              <span className="text-slate-400">(B)</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Main comparison view ──────────────────────────────────────────────────────

function CompareContent() {
  const sp     = useSearchParams();
  const router = useRouter();
  const aId    = sp.get("a") ?? "";
  const bId    = sp.get("b") ?? "";

  const [sessionA, setSessionA] = useState<PrintSession | null | undefined>(undefined);
  const [sessionB, setSessionB] = useState<PrintSession | null | undefined>(undefined);
  const [printers, setPrinters] = useState<EquipmentPrinter[]>([]);
  const [surfaces, setSurfaces] = useState<EquipmentSurface[]>([]);

  useEffect(() => {
    setSessionA(getSession(aId));
    setSessionB(getSession(bId));
  }, [aId, bId]);

  // Fetch equipment (printers and surfaces) to resolve IDs to names
  useEffect(() => {
    const fetchEquipment = async () => {
      try {
        const response = await fetch("/api/equipment");
        if (response.ok) {
          const data: EquipmentListResponse = await response.json();
          setPrinters(data.printers || []);
          setSurfaces(data.surfaces || []);
        }
      } catch (error) {
        console.error("Failed to fetch equipment:", error);
      }
    };
    fetchEquipment();
  }, []);

  // Helper function to resolve printer ID to display name
  const resolvePrinterName = (printerId: string): string => {
    if (!printerId) return "—";
    // Check if it's a UUID (equipment ID)
    if (printerId.includes("-") && printerId.length === 36) {
      const printer = printers.find((p) => p.id === printerId);
      return printer ? `${printer.vendorName} ${printer.modelName}` : printerId;
    }
    // Otherwise it's a legacy string name, return as-is
    return printerId;
  };

  // Helper function to resolve bed surface ID to display name
  const resolveSurfaceName = (surfaceId: string): string => {
    if (!surfaceId) return "—";
    // Check if it's a UUID (equipment ID)
    if (surfaceId.includes("-") && surfaceId.length === 36) {
      const surface = surfaces.find((s) => s.id === surfaceId);
      return surface?.displayName || surfaceId;
    }
    // Otherwise it's a legacy string name, return as-is
    return surfaceId;
  };

  // Loading
  if (sessionA === undefined || sessionB === undefined) {
    return (
      <div className="py-24 text-center text-slate-400">
        <div className="w-8 h-8 border-2 border-slate-200 border-t-primary-500 rounded-full animate-spin mx-auto mb-4" />
        Loading comparison…
      </div>
    );
  }

  // One or both missing
  if (!sessionA || !sessionB) {
    return (
      <div className="py-24 text-center space-y-4">
        <div className="text-5xl">🔍</div>
        <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-300">
          Sessions not found
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
          One or both sessions could not be found. They may have been deleted, or the link is from a different device.
        </p>
        <button onClick={() => router.push("/history")} className="btn-secondary">
          ← Back to history
        </button>
      </div>
    );
  }

  const sA = sessionA.settings;
  const sB = sessionB.settings;
  const advA = sessionA.advancedSettings;
  const advB = sessionB.advancedSettings;
  const inpA = sessionA.inputs;
  const inpB = sessionB.inputs;
  const geoA = sessionA.geometry;
  const geoB = sessionB.geometry;
  const outA = sessionA.outcome;
  const outB = sessionB.outcome;

  // Build all rows for the "differences" summary
  const allFields: { label: string; a: unknown; b: unknown }[] = [
    // Inputs
    { label: "Printer",           a: resolvePrinterName(inpA.printerModel),   b: resolvePrinterName(inpB.printerModel) },
    { label: "Filament type",     a: inpA.filamentType,   b: inpB.filamentType },
    { label: "Filament brand",    a: inpA.filamentBrand || "—", b: inpB.filamentBrand || "—" },
    { label: "Nozzle diameter",   a: `${inpA.nozzleDiameter}mm`, b: `${inpB.nozzleDiameter}mm` },
    { label: "Bed surface",       a: resolveSurfaceName(inpA.bedSurface),     b: resolveSurfaceName(inpB.bedSurface) },
    { label: "Quality tier",      a: inpA.printPriority,  b: inpB.printPriority },
    { label: "Print purpose",   a: inpA.printPurpose,   b: inpB.printPurpose },
    { label: "Humidity",          a: inpA.humidity,       b: inpB.humidity },
    { label: "Problem description", a: inpA.problemDescription || "—", b: inpB.problemDescription || "—" },
    // Geometry
    { label: "Dimensions",
      a: `${geoA.dimensions.x}×${geoA.dimensions.y}×${geoA.dimensions.z}mm`,
      b: `${geoB.dimensions.x}×${geoB.dimensions.y}×${geoB.dimensions.z}mm` },
    { label: "Complexity",        a: geoA.complexity,     b: geoB.complexity },
    { label: "Has overhangs",     a: geoA.hasSignificantOverhangs, b: geoB.hasSignificantOverhangs },
    // Main settings
    { label: "Layer height",      a: `${sA.layerHeight}mm`, b: `${sB.layerHeight}mm` },
    { label: "Print temp",        a: `${sA.printTemp}°C`,   b: `${sB.printTemp}°C` },
    { label: "Bed temp",          a: `${sA.bedTemp}°C`,     b: `${sB.bedTemp}°C` },
    { label: "Print speed",       a: `${sA.printSpeed}mm/s`, b: `${sB.printSpeed}mm/s` },
    { label: "Infill",            a: `${sA.infill}%`,       b: `${sB.infill}%` },
    { label: "Cooling fan",       a: `${sA.coolingFan}%`,   b: `${sB.coolingFan}%` },
    { label: "Supports",          a: sA.supportType,       b: sB.supportType },
    { label: "Adhesion",          a: sA.adhesion,          b: sB.adhesion },
    { label: "Wall count",        a: `${sA.wallCount}`,    b: `${sB.wallCount}` },
    // Advanced
    { label: "Outer wall speed",  a: `${advA.outerWallSpeed}mm/s`, b: `${advB.outerWallSpeed}mm/s` },
    { label: "Inner wall speed",  a: `${advA.innerWallSpeed}mm/s`, b: `${advB.innerWallSpeed}mm/s` },
    { label: "First layer speed", a: `${advA.firstLayerSpeed}mm/s`, b: `${advB.firstLayerSpeed}mm/s` },
    { label: "Bridge speed",      a: `${advA.bridgeSpeed}mm/s`, b: `${advB.bridgeSpeed}mm/s` },
    { label: "Travel speed",      a: `${advA.travelSpeed}mm/s`, b: `${advB.travelSpeed}mm/s` },
    { label: "First layer temp",  a: `${advA.firstLayerTemp}°C`, b: `${advB.firstLayerTemp}°C` },
    { label: "Min layer time",    a: `${advA.minLayerTime}s`, b: `${advB.minLayerTime}s` },
    { label: "Elephant foot",     a: `${advA.elephantFootCompensation}mm`, b: `${advB.elephantFootCompensation}mm` },
    // Print time
    { label: "Est. print time",
      a: `${sessionA.printTimeMin}–${sessionA.printTimeMax} min`,
      b: `${sessionB.printTimeMin}–${sessionB.printTimeMax} min` },
  ];

  const diffs: DiffEntry[] = allFields
    .filter(({ a, b }) => fmt(a) !== fmt(b))
    .map(({ label, a, b }) => ({ label, a: fmt(a), b: fmt(b) }));

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div>
        <button
          onClick={() => router.push("/history")}
          className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors mb-4"
        >
          <ArrowLeft size={14} /> Back to history
        </button>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Session comparison</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Differences are highlighted in{" "}
          <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded text-xs font-medium">amber</span>
        </p>
      </div>

      {/* Session A/B header cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { label: "A", session: sessionA },
          { label: "B", session: sessionB },
        ].map(({ label, session }) => (
          <div key={label} className="card p-4 flex items-start gap-3">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 text-sm font-bold flex items-center justify-center">
              {label}
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm truncate">{session.name}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                {formatSessionDate(session.savedAt)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Comparison table */}
      <div className="card overflow-hidden">
        {/* Column headers */}
        <div className="grid grid-cols-[1fr_1fr_1fr] bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 gap-3">
          <span>Setting</span>
          <span className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 text-xs font-bold flex items-center justify-center flex-shrink-0">
              A
            </span>
            <span className="truncate">{sessionA.name}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 text-xs font-bold flex items-center justify-center flex-shrink-0">
              B
            </span>
            <span className="truncate">{sessionB.name}</span>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full px-4">
            <tbody className="divide-y divide-transparent">
              {/* ── Inputs ── */}
              <SectionHead title="Setup" />
              <CompareRow label="Printer"        a={resolvePrinterName(inpA.printerModel)}   b={resolvePrinterName(inpB.printerModel)} />
              <CompareRow label="Filament"       a={inpA.filamentType}   b={inpB.filamentType} />
              <CompareRow label="Brand"          a={inpA.filamentBrand || "—"} b={inpB.filamentBrand || "—"} />
              <CompareRow label="Nozzle"         a={`${inpA.nozzleDiameter}mm`} b={`${inpB.nozzleDiameter}mm`} />
              <CompareRow label="Bed surface"    a={resolveSurfaceName(inpA.bedSurface)}     b={resolveSurfaceName(inpB.bedSurface)} />
              <CompareRow label="Quality tier"   a={inpA.printPriority}  b={inpB.printPriority} />
              <CompareRow label="Print purpose"   a={inpA.printPurpose} b={inpB.printPurpose} />
              <CompareRow label="Humidity"       a={inpA.humidity}       b={inpB.humidity} />

              {/* ── Geometry ── */}
              <SectionHead title="Geometry" />
              <CompareRow
                label="File"
                a={geoA.fileName}
                b={geoB.fileName}
              />
              <CompareRow
                label="Dimensions"
                a={`${geoA.dimensions.x}×${geoA.dimensions.y}×${geoA.dimensions.z}mm`}
                b={`${geoB.dimensions.x}×${geoB.dimensions.y}×${geoB.dimensions.z}mm`}
              />
              <CompareRow label="Complexity"     a={geoA.complexity}     b={geoB.complexity} />
              <CompareRow label="Overhangs"      a={geoA.overhangSeverity} b={geoB.overhangSeverity} />

              {/* ── Main settings ── */}
              <SectionHead title="Main Settings" />
              <CompareRow label="Layer height"   a={`${sA.layerHeight}mm`}  b={`${sB.layerHeight}mm`} />
              <CompareRow label="Print temp"     a={`${sA.printTemp}°C`}    b={`${sB.printTemp}°C`} />
              <CompareRow label="Bed temp"       a={`${sA.bedTemp}°C`}      b={`${sB.bedTemp}°C`} />
              <CompareRow label="Print speed"    a={`${sA.printSpeed}mm/s`} b={`${sB.printSpeed}mm/s`} />
              <CompareRow label="Infill"         a={`${sA.infill}%`}        b={`${sB.infill}%`} />
              <CompareRow label="Cooling fan"    a={`${sA.coolingFan}%`}    b={`${sB.coolingFan}%`} />
              <CompareRow label="Wall count"     a={`${sA.wallCount}`}      b={`${sB.wallCount}`} />
              <CompareRow label="Supports"       a={sA.supportType}         b={sB.supportType} />
              {(sA.supportType !== "None" || sB.supportType !== "None") && (
                <CompareRow label="Support density" a={sA.supportType !== "None" ? `${sA.supportDensity}%` : "—"} b={sB.supportType !== "None" ? `${sB.supportDensity}%` : "—"} />
              )}
              <CompareRow label="Adhesion"       a={sA.adhesion}            b={sB.adhesion} />
              {(sA.adhesionWidth > 0 || sB.adhesionWidth > 0) && (
                <CompareRow label="Brim width"   a={sA.adhesionWidth > 0 ? `${sA.adhesionWidth}mm` : "—"} b={sB.adhesionWidth > 0 ? `${sB.adhesionWidth}mm` : "—"} />
              )}

              {/* ── Advanced settings ── */}
              <SectionHead title="Advanced Settings" />
              <CompareRow label="Outer wall"     a={`${advA.outerWallSpeed}mm/s`}  b={`${advB.outerWallSpeed}mm/s`} />
              <CompareRow label="Inner wall"     a={`${advA.innerWallSpeed}mm/s`}  b={`${advB.innerWallSpeed}mm/s`} />
              <CompareRow label="Top/bottom"     a={`${advA.topBottomSpeed}mm/s`}  b={`${advB.topBottomSpeed}mm/s`} />
              <CompareRow label="First layer"    a={`${advA.firstLayerSpeed}mm/s`} b={`${advB.firstLayerSpeed}mm/s`} />
              <CompareRow label="Bridge speed"   a={`${advA.bridgeSpeed}mm/s`}     b={`${advB.bridgeSpeed}mm/s`} />
              <CompareRow label="Travel speed"   a={`${advA.travelSpeed}mm/s`}     b={`${advB.travelSpeed}mm/s`} />
              <CompareRow label="1st layer temp" a={`${advA.firstLayerTemp}°C`}    b={`${advB.firstLayerTemp}°C`} />
              <CompareRow label="Standby temp"   a={`${advA.standbyTemp}°C`}       b={`${advB.standbyTemp}°C`} />
              <CompareRow label="Support Z gap"  a={`${advA.supportZDistance}mm`}  b={`${advB.supportZDistance}mm`} />
              <CompareRow label="Interface layers" a={`${advA.supportInterfaceLayers}`} b={`${advB.supportInterfaceLayers}`} />
              <CompareRow label="Min layer time" a={`${advA.minLayerTime}s`}       b={`${advB.minLayerTime}s`} />
              <CompareRow label="Elephant foot"  a={`${advA.elephantFootCompensation}mm`} b={`${advB.elephantFootCompensation}mm`} />

              {/* ── Print time ── */}
              <SectionHead title="Estimated Print Time" />
              <CompareRow
                label="Time range"
                a={`${sessionA.printTimeMin}–${sessionA.printTimeMax} min`}
                b={`${sessionB.printTimeMin}–${sessionB.printTimeMax} min`}
              />

              {/* ── Outcomes ── */}
              {(outA.stars !== null || outB.stars !== null) && (
                <>
                  <SectionHead title="Outcomes" />
                  <CompareRow
                    label="Rating"
                    a={outA.stars ? `${outA.stars} / 5 stars` : "Not rated"}
                    b={outB.stars ? `${outB.stars} / 5 stars` : "Not rated"}
                  />
                  {(outA.note || outB.note) && (
                    <CompareRow
                      label="Note"
                      a={outA.note ?? "—"}
                      b={outB.note ?? "—"}
                    />
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Differences summary */}
      <DiffSummary diffs={diffs} />
    </div>
  );
}

// ── Page wrapper (Suspense required for useSearchParams) ──────────────────────

export default function ComparePage() {
  return (
    <Suspense
      fallback={
        <div className="py-24 text-center text-slate-400">
          <div className="w-8 h-8 border-2 border-slate-200 border-t-primary-500 rounded-full animate-spin mx-auto mb-4" />
          Loading comparison…
        </div>
      }
    >
      <CompareContent />
    </Suspense>
  );
}
