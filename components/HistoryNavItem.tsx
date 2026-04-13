"use client";

// ─── History nav item ─────────────────────────────────────────────────────────
//
// Renders the History link + badge in the header.
// Hides itself when historyEnabled is false in public config.

import { Clock } from "lucide-react";
import { usePublicConfig } from "@/lib/publicConfig";
import HistoryBadge from "./HistoryBadge";

export default function HistoryNavItem() {
  const config = usePublicConfig();

  if (!config.historyEnabled) return null;

  return (
    <a
      href="/history"
      className="flex items-center gap-1 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-xs font-medium"
      title="Your print history"
      aria-label="Print history"
    >
      <Clock size={15} />
      <span className="hidden sm:inline">History</span>
      <HistoryBadge />
    </a>
  );
}
