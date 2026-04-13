"use client";

// ─── Slide-out help panel ─────────────────────────────────────────────────────
//
// Renders a "?" icon button in the nav bar.
// Clicking it opens a slide-in panel from the right with a condensed guide.
// Panel closes on: × button, Escape key, clicking the overlay.
// Collapsible sections remember their state within a session (reset on close/reopen).
// Focus is trapped inside the panel while open.

import { useState, useEffect, useRef, useCallback, useId } from "react";
import { HelpCircle, X, ChevronDown } from "lucide-react";
import clsx from "clsx";
import { usePublicConfig } from "@/lib/publicConfig";

// ── Collapsible section ───────────────────────────────────────────────────────

function PanelSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();

  return (
    <div className="border-b border-slate-100 dark:border-slate-800 last:border-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{title}</span>
        <ChevronDown
          size={15}
          className={clsx(
            "flex-shrink-0 text-slate-400 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>
      <div
        id={id}
        className="grid transition-[grid-template-rows] duration-250 ease-in-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="px-5 pb-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed space-y-2">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Small helper components ───────────────────────────────────────────────────

function BulletItem({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 items-start">
      <span className="flex-shrink-0 text-primary-500 mt-0.5 text-xs">•</span>
      <span>{children}</span>
    </div>
  );
}

function Badge({ children, color }: { children: React.ReactNode; color: "teal" | "amber" | "slate" }) {
  const styles = {
    teal:  "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    slate: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  };
  return (
    <span className={clsx("inline-block px-1.5 py-0.5 rounded text-[11px] font-semibold mr-1", styles[color])}>
      {children}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function GuidePanel() {
  const [open, setOpen]     = useState(false);
  const panelRef            = useRef<HTMLDivElement>(null);
  const triggerRef          = useRef<HTMLButtonElement>(null);
  const publicConfig        = usePublicConfig();

  // ── Open / close helpers ──────────────────────────────────────────────────

  const openPanel  = useCallback(() => setOpen(true),  []);
  const closePanel = useCallback(() => {
    setOpen(false);
    // Return focus to trigger
    setTimeout(() => triggerRef.current?.focus(), 50);
  }, []);

  // ── ESC key + scroll lock ─────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closePanel();
    }

    document.addEventListener("keydown", onKeyDown);
    // Prevent body scroll while panel is open
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [open, closePanel]);

  // ── Focus trap ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!open || !panelRef.current) return;

    const focusable = panelRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];

    first?.focus();

    function onTab(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first?.focus(); }
      }
    }

    document.addEventListener("keydown", onTab);
    return () => document.removeEventListener("keydown", onTab);
  }, [open]);

  return (
    <>
      {/* ── Trigger button (rendered inline in nav) ─────────────────────── */}
      <button
        ref={triggerRef}
        type="button"
        onClick={openPanel}
        aria-label="Open user guide"
        title="User guide"
        className="flex items-center gap-1 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-xs font-medium"
      >
        <HelpCircle size={15} />
        <span className="hidden sm:inline">Guide</span>
      </button>

      {/* ── Overlay + panel (fixed, always in DOM) ──────────────────────── */}
      <div
        aria-hidden={!open}
        className={clsx(
          "fixed inset-0 z-50 flex justify-end transition-all duration-300",
          open ? "pointer-events-auto" : "pointer-events-none",
        )}
      >
        {/* Dark overlay */}
        <div
          onClick={closePanel}
          className={clsx(
            "absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-300",
            open ? "opacity-100" : "opacity-0",
          )}
        />

        {/* Slide-in panel */}
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="User guide"
          className={clsx(
            "relative flex flex-col w-full sm:w-[400px] h-full bg-white dark:bg-slate-900 shadow-2xl transition-transform duration-300 ease-out",
            open ? "translate-x-0" : "translate-x-full",
          )}
        >
          {/* Panel header */}
          <div className="flex items-start justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
            <div>
              <p className="font-bold text-slate-900 dark:text-slate-100 text-base">
                How to use Print Perfect
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Quick reference guide</p>
            </div>
            <button
              type="button"
              onClick={closePanel}
              aria-label="Close guide panel"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex-shrink-0 mt-0.5"
            >
              <X size={16} />
            </button>
          </div>

          {/* Panel scrollable content */}
          <div className="flex-1 overflow-y-auto">

            {/* ── Getting Started ── */}
            <PanelSection title="Getting Started" defaultOpen>
              <BulletItem>
                <strong>What you need:</strong> a 3D model file (.STL, .OBJ, or .3MF),
                your printer model, your filament brand and type.
              </BulletItem>
              <BulletItem>
                <strong>Supported formats:</strong>
                <span className="block mt-1 ml-2 space-y-1">
                  <span className="block"><Badge color="teal">STL</Badge> Best choice — single object, most reliable</span>
                  <span className="block"><Badge color="teal">OBJ</Badge> Works well for single objects</span>
                  <span className="block"><Badge color="amber">3MF</Badge> Single object only — multi-object files give a warning</span>
                </span>
              </BulletItem>
              {publicConfig.betaKeyEnabled && (
                <BulletItem>
                  <strong>Access key:</strong> required during private beta. Contact{" "}
                  <a
                    href={`mailto:${publicConfig.betaContactEmail}`}
                    className="text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    {publicConfig.betaContactEmail}
                  </a>{" "}
                  for a key.
                </BulletItem>
              )}
            </PanelSection>

            {/* ── The 3 Steps ── */}
            <PanelSection title="The 3 Steps">
              <div className="space-y-3">
                {[
                  { n: 1, title: "Upload your model", desc: "Drag and drop or click to choose your .STL, .OBJ, or .3MF file." },
                  { n: 2, title: "Configure your print", desc: "Select your printer, filament type, nozzle size, and quality tier." },
                  { n: 3, title: "Get your settings", desc: "Review your tailored settings with plain-English explanations for each one." },
                ].map((s) => (
                  <div key={s.n} className="flex gap-3 items-start">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-500 text-white text-xs font-bold flex items-center justify-center mt-0.5">
                      {s.n}
                    </span>
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-100 text-[13px]">{s.title}</p>
                      <p className="text-slate-500 dark:text-slate-400 text-[13px]">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </PanelSection>

            {/* ── Quality Tiers ── */}
            <PanelSection title="Quality Tiers">
              <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800">
                      <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">Tier</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">Height</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">Best for</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { tier: "Draft",    h: "0.28mm", desc: "Prototypes, fit tests" },
                      { tier: "Standard", h: "0.20mm", desc: "Everyday prints ★" },
                      { tier: "Quality",  h: "0.12mm", desc: "Visible surfaces" },
                      { tier: "Ultra",    h: "0.08mm", desc: "Fine detail only" },
                    ].map((r, i) => (
                      <tr key={r.tier} className={i % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/60 dark:bg-slate-800/30"}>
                        <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-100">{r.tier}</td>
                        <td className="px-3 py-2 font-mono text-slate-500 dark:text-slate-400">{r.h}</td>
                        <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{r.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-slate-400 dark:text-slate-500 text-[12px] mt-1">
                ⚠️ Ultra is not recommended for large models — print times become extreme.
              </p>
            </PanelSection>

            {/* ── Filament Quick Reference ── */}
            <PanelSection title="Filament Quick Reference">
              {[
                { f: "PLA",       desc: "Easiest to print — start here." },
                { f: "PLA+",      desc: "Slightly stronger, same ease as PLA." },
                { f: "PLA Silk",  desc: "Glossy finish, slower and more fussy." },
                { f: "PETG",      desc: "Stronger, heat resistant, slightly flexible." },
                { f: "ABS",       desc: "Strong but warps — needs an enclosure." },
                { f: "ASA",       desc: "Like ABS, UV-resistant for outdoor parts." },
                { f: "TPU",       desc: "Flexible and rubber-like. Great for cases." },
              ].map((r) => (
                <div key={r.f} className="flex gap-2 items-start text-[13px]">
                  <span className="flex-shrink-0 font-semibold text-slate-800 dark:text-slate-100 w-20">{r.f}</span>
                  <span className="text-slate-500 dark:text-slate-400">{r.desc}</span>
                </div>
              ))}
            </PanelSection>

            {/* ── Understanding Your Results ── */}
            <PanelSection title="Understanding Your Results">
              <BulletItem>
                <strong>Filament Profile card</strong> — appears when your brand is found
                in the Open Filament Database, showing real manufacturer specs.
              </BulletItem>
              <BulletItem>
                <strong>5 settings panels</strong> — Temperature, Speed, Cooling, Supports,
                Adhesion. Each has an expandable Advanced section.
              </BulletItem>
              <BulletItem>
                <strong>Confidence badges</strong> — <Badge color="teal">✓ High</Badge>
                safe to use as-is. <Badge color="amber">~ Medium</Badge> may need tuning.
                <Badge color="slate">? Low</Badge> dial in with test prints.
              </BulletItem>
              <BulletItem>
                <strong>Watch Out For / Tips / Common Mistakes</strong> — AI-generated
                specifically for your filament type and printer.
              </BulletItem>
            </PanelSection>

            {/* ── Tips for Success ── */}
            <PanelSection title="Tips for Success">
              {[
                "Clean your bed with IPA before every print — adhesion is everything.",
                "Calibrate your Live Z offset before chasing slicer settings.",
                "Dry wet filament — popping sounds or stringing = moisture in the spool.",
                "Print a temperature tower for any new filament brand.",
                "Test with a small section first — don't commit hours to untested settings.",
              ].map((tip, i) => (
                <BulletItem key={i}>{tip}</BulletItem>
              ))}
            </PanelSection>

          </div>

          {/* Panel footer */}
          <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex-shrink-0 space-y-2">
            <p className="text-[12px] text-slate-500 dark:text-slate-400">
              For the full guide, visit{" "}
              <a
                href="/guide"
                onClick={closePanel}
                className="text-primary-600 dark:text-primary-400 hover:underline font-medium"
              >
                printperfect.app/guide →
              </a>
            </p>
            <p className="text-[12px] text-slate-400 dark:text-slate-500">
              Something not right?{" "}
              <a
                href={`mailto:${publicConfig.betaContactEmail}`}
                className="text-primary-600 dark:text-primary-400 hover:underline"
              >
                Contact {publicConfig.betaContactEmail}
              </a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
