"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import { Upload, FileCheck, AlertCircle, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import clsx from "clsx";
import { parseFile, inspect3mf } from "@/lib/fileParser";
import type { ParseResult, ThreeMfInspection } from "@/lib/fileParser";

// ─── Tips panel data ──────────────────────────────────────────────────────────

const TIPS_KEY = "printperfect_tips_collapsed";

const TIPS = [
  {
    icon: "✅",
    title: "Prefer a single STL file when possible",
    body: "STL files contain exactly one object, making analysis straightforward and reliable. If you have a single part to print, STL is your best friend.",
  },
  {
    icon: "📦",
    title: ".3mf files are powerful but have gotchas",
    body: ".3mf files can contain multiple objects arranged on a build plate, or even multiple build plates. If your .3mf has more than one object or plate, our analyzer may misread the geometry — treating multiple objects as one suspended mass, which causes false overhang warnings and inaccurate support estimates. For best results, export individual parts as separate files.",
  },
  {
    icon: "🔧",
    title: "Make sure your model is print-ready",
    body: "If you designed the model yourself or downloaded it from a repository, double-check it's a solid, watertight mesh with no holes. Tools like Meshmixer (free) or PrusaSlicer's built-in repair can fix most issues automatically.",
  },
  {
    icon: "🧩",
    title: "One part at a time",
    body: "Even if you plan to print multiple parts together, analyze them one at a time here. Each part may need different settings — especially if they vary in size, overhang complexity, or required strength.",
  },
  {
    icon: "📊",
    title: "File size and complexity",
    body: "Very large or highly detailed files (over 50 MB or 1M+ triangles) may take a moment to analyze in your browser. This is normal — we're doing real geometry math on your device.",
  },
];

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  onComplete: (result: ParseResult) => void;
}

export default function UploadScreen({ onComplete }: Props) {
  const [dragging, setDragging]   = useState(false);
  const [status,   setStatus]     = useState<"idle" | "inspecting" | "parsing" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg]   = useState("");
  const [fileName, setFileName]   = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Tips panel — default open; collapse state persisted to localStorage
  const [tipsOpen, setTipsOpen] = useState(true);
  useEffect(() => {
    if (localStorage.getItem(TIPS_KEY) === "1") setTipsOpen(false);
  }, []);
  function toggleTips() {
    setTipsOpen((o) => {
      const next = !o;
      localStorage.setItem(TIPS_KEY, next ? "0" : "1");
      return next;
    });
  }

  // Multi-object warning state
  const [multiObjWarning, setMultiObjWarning] = useState<ThreeMfInspection | null>(null);
  const [pendingFile,     setPendingFile]     = useState<File | null>(null);

  // ── Core file handler ─────────────────────────────────────────────────────

  const handleFile = useCallback(
    async (file: File) => {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!ext || !["stl", "obj", "3mf"].includes(ext)) {
        setErrorMsg("Please upload a .stl, .obj, or .3mf file.");
        setStatus("error");
        return;
      }
      if (file.size > 100 * 1024 * 1024) {
        setErrorMsg("File is too large (max 100 MB).");
        setStatus("error");
        return;
      }

      setFileName(file.name);
      setErrorMsg("");

      // For .3mf files — do a lightweight inspection first to detect multiple objects
      if (ext === "3mf") {
        setStatus("inspecting");
        try {
          const buf        = await file.arrayBuffer();
          const inspection = await inspect3mf(buf);
          if (inspection && (inspection.objectCount > 1 || inspection.buildItemCount > 1)) {
            // Multi-object detected — pause and ask the user what to do
            setMultiObjWarning(inspection);
            setPendingFile(file);
            setStatus("idle");
            return;
          }
        } catch {
          // If inspection fails, just proceed with the normal parse
        }
      }

      await runParse(file, false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onComplete]
  );

  async function runParse(file: File, isMultiObject: boolean) {
    setStatus("parsing");
    setMultiObjWarning(null);
    setPendingFile(null);
    try {
      const result = await parseFile(file);
      if (isMultiObject) result.multiObjectWarning = true;
      setStatus("done");
      setTimeout(() => onComplete(result), 600);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to parse file.");
      setStatus("error");
    }
  }

  // ── Drop / input handlers ─────────────────────────────────────────────────

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const isClickable = status === "idle" || status === "error";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="animate-slide-up">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">
          Get perfect settings for your print
        </h1>
        <p className="text-slate-600 dark:text-slate-300 text-lg max-w-xl mx-auto">
          Upload your 3D model and we&apos;ll analyze it and recommend slicer settings
          tailored to your exact setup — with plain-English explanations.
        </p>
      </div>

      {/* ── Tips panel ────────────────────────────────────────────────────── */}
      <div className="mb-5 rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 overflow-hidden">
        <button
          type="button"
          onClick={toggleTips}
          className="w-full flex items-center justify-between px-5 py-3.5 text-left select-none"
          aria-expanded={tipsOpen}
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
            <span>💡</span> Tips for best results
          </span>
          {tipsOpen
            ? <ChevronUp  size={16} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            : <ChevronDown size={16} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          }
        </button>

        {tipsOpen && (
          <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-emerald-200 dark:border-emerald-800 pt-4">
            {TIPS.map((tip) => (
              <div
                key={tip.title}
                className="flex gap-3 bg-white dark:bg-slate-900/60 rounded-xl p-3.5 border border-emerald-100 dark:border-emerald-900"
              >
                <span className="text-lg flex-shrink-0 mt-0.5">{tip.icon}</span>
                <div>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 mb-1">{tip.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{tip.body}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Multi-object warning ──────────────────────────────────────────── */}
      {multiObjWarning && pendingFile && (
        <div className="mb-5 rounded-2xl border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-6">
          <div className="flex items-start gap-4">
            <span className="text-3xl flex-shrink-0">⚠️</span>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-amber-900 dark:text-amber-200 text-base mb-2">
                Heads up — this .3mf file contains multiple objects
              </p>
              <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed mb-1">
                {multiObjWarning.objectCount > 1 && (
                  <span><strong>{multiObjWarning.objectCount} separate mesh objects</strong> were found in this file. </span>
                )}
                {multiObjWarning.buildItemCount > 1 && (
                  <span><strong>{multiObjWarning.buildItemCount} objects</strong> are placed on the build plate. </span>
                )}
              </p>
              <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed mb-4">
                Analyzing multiple objects together can cause inaccurate results — our analyzer may misread the combined geometry as a single floating mass, leading to false overhang warnings and incorrect support estimates. For best results, export each part as a separate file.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => runParse(pendingFile, true)}
                  className="flex-1 rounded-xl border border-amber-400 dark:border-amber-600 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-medium text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors text-center"
                >
                  Analyse anyway — I understand the limitations
                </button>
                <button
                  onClick={() => { setMultiObjWarning(null); setPendingFile(null); setFileName(""); }}
                  className="flex-1 rounded-xl bg-amber-600 hover:bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors text-center"
                >
                  Upload a different file
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Drop zone ────────────────────────────────────────────────────── */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => isClickable ? inputRef.current?.click() : undefined}
        className={clsx(
          "relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-200",
          isClickable ? "cursor-pointer" : "cursor-default",
          dragging
            ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20 scale-[1.01]"
            : status === "done"
            ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20"
            : status === "error"
            ? "border-orange-400 bg-orange-50 dark:bg-orange-900/20"
            : (status === "parsing" || status === "inspecting")
            ? "border-primary-400 bg-primary-50 dark:bg-primary-900/20 cursor-wait"
            : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 hover:border-primary-400 hover:bg-primary-50/50 dark:hover:bg-primary-900/10"
        )}
      >
        <input ref={inputRef} type="file" accept=".stl,.obj,.3mf" onChange={onInputChange} className="sr-only" />

        {(status === "parsing" || status === "inspecting") ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-12 h-12 text-primary-500 animate-spin" />
            <p className="text-primary-700 dark:text-primary-300 font-semibold text-lg">
              {status === "inspecting" ? "Checking file structure…" : "Analyzing your model…"}
            </p>
            <p className="text-primary-600 dark:text-primary-400 text-sm">{fileName}</p>
          </div>
        ) : status === "done" ? (
          <div className="flex flex-col items-center gap-3">
            <FileCheck className="w-12 h-12 text-emerald-500" />
            <p className="text-emerald-700 dark:text-emerald-400 font-semibold text-lg">Analysis complete!</p>
            <p className="text-emerald-600 dark:text-emerald-500 text-sm">{fileName}</p>
          </div>
        ) : status === "error" ? (
          <div className="flex flex-col items-center gap-3">
            <AlertCircle className="w-12 h-12 text-orange-500" />
            <p className="text-orange-700 dark:text-orange-400 font-semibold text-lg">Couldn&apos;t read that file</p>
            <p className="text-orange-600 dark:text-orange-300 text-sm max-w-sm">{errorMsg}</p>
            <button
              onClick={(e) => { e.stopPropagation(); setStatus("idle"); }}
              className="mt-2 text-sm text-orange-700 dark:text-orange-400 underline hover:no-underline"
            >
              Try another file
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center">
              <Upload className="w-8 h-8 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p className="text-slate-900 dark:text-slate-100 font-semibold text-lg">
                Drop your file here, or{" "}
                <span className="text-primary-600 dark:text-primary-400 hover:text-primary-700">browse</span>
              </p>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                Supports .STL, .OBJ, and .3MF — up to 100 MB
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Feature tiles ─────────────────────────────────────────────────── */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: "🔍", title: "Geometry Analysis",  desc: "Detects dimensions, overhangs, and complexity automatically" },
          { icon: "⚙️", title: "Smart Settings",     desc: "Rule-based engine computes the right layer height, temps, and speeds" },
          { icon: "🤖", title: "AI Explanations",    desc: "Claude explains every setting in plain English for beginners" },
        ].map((f) => (
          <div key={f.title} className="card p-4">
            <span className="text-2xl">{f.icon}</span>
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mt-2 mb-1">{f.title}</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
