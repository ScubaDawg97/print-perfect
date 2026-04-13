"use client";

// ─── Guide table of contents — sticky sidebar with active-section tracking ────
//
// Uses IntersectionObserver to highlight the TOC entry for whichever section
// is currently most visible in the viewport.
// On mobile: collapses to a "Jump to section" <select> dropdown.

import { useEffect, useState } from "react";

export interface TocSection {
  id: string;
  label: string;
  number: number;
}

const SECTIONS: TocSection[] = [
  { number: 1,  id: "section-1",  label: "Getting Started" },
  { number: 2,  id: "section-2",  label: "Uploading Your Model" },
  { number: 3,  id: "section-3",  label: "Configuring Your Print" },
  { number: 4,  id: "section-4",  label: "Understanding Your Results" },
  { number: 5,  id: "section-5",  label: "Saving and Sharing" },
  { number: 6,  id: "section-6",  label: "Printer Profiles" },
  { number: 7,  id: "section-7",  label: "Tips for Beginners" },
  { number: 8,  id: "section-8",  label: "Tips for Intermediate Users" },
  { number: 9,  id: "section-9",  label: "FAQs" },
  { number: 10, id: "section-10", label: "Changelog" },
];

export default function GuideTOC() {
  const [activeId, setActiveId] = useState<string>(SECTIONS[0].id);

  // ── Intersection observer — track which section is most visible ───────────
  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    const visibilityMap = new Map<string, number>();

    function pickMostVisible() {
      let bestId = SECTIONS[0].id;
      let bestRatio = -1;
      visibilityMap.forEach((ratio, id) => {
        if (ratio > bestRatio) { bestRatio = ratio; bestId = id; }
      });
      setActiveId(bestId);
    }

    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          visibilityMap.set(id, entry.intersectionRatio);
          pickMostVisible();
        },
        { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1.0] },
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  // ── Mobile: jump-to dropdown ──────────────────────────────────────────────
  function handleMobileSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const el = document.getElementById(e.target.value);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      {/* Mobile dropdown */}
      <div className="lg:hidden mb-6">
        <label htmlFor="guide-jump" className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
          Jump to section
        </label>
        <select
          id="guide-jump"
          onChange={handleMobileSelect}
          defaultValue=""
          className="select text-sm"
        >
          <option value="" disabled>Choose a section…</option>
          {SECTIONS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.number}. {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Desktop sticky sidebar */}
      <nav
        aria-label="Guide sections"
        className="hidden lg:block sticky top-24 self-start"
      >
        <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
          Contents
        </p>
        <ol className="space-y-0.5">
          {SECTIONS.map((s) => {
            const isActive = activeId === s.id;
            return (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className={[
                    "flex items-start gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors",
                    isActive
                      ? "bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 font-semibold"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800",
                  ].join(" ")}
                >
                  <span className={[
                    "flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5",
                    isActive
                      ? "bg-primary-500 text-white"
                      : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400",
                  ].join(" ")}>
                    {s.number}
                  </span>
                  <span className="leading-snug">{s.label}</span>
                </a>
              </li>
            );
          })}
        </ol>

        {/* Back to top */}
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="mt-6 flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          ↑ Back to top
        </button>
      </nav>
    </>
  );
}
