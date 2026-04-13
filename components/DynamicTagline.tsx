"use client";

// ─── Dynamic tagline ──────────────────────────────────────────────────────────
// Reads siteTagline from public config. Falls back to the default string
// while loading so there is no layout shift.

import { usePublicConfig } from "@/lib/publicConfig";

export default function DynamicTagline() {
  const config = usePublicConfig();
  return (
    <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
      {config.siteTagline}
    </span>
  );
}
