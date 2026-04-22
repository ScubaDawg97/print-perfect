"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SpoolIcon from "@/components/SpoolIcon";
import { LogOut, Cpu, BookOpen, Bug, SlidersHorizontal, Activity } from "lucide-react";
import RELEASE_NOTES from "@/lib/releaseNotes";
import clsx from "clsx";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function AdminPage() {
  const router = useRouter();
  const [activeModel, setActiveModel] = useState<string>("");

  // Load current settings (KV-backed)
  useEffect(() => {
    fetch("/api/admin/config")
      .then((r) => {
        if (r.status === 401) { router.push("/admin/login"); return null; }
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        setActiveModel(data.claudeModel);
      })
      .catch(() => router.push("/admin/login"));
  }, [router]);

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Admin header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-primary-600"><SpoolIcon className="w-6 h-6" /></span>
            <span className="font-bold text-slate-900 dark:text-slate-100">PrintPerfect</span>
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-400 px-2 py-0.5 rounded-full ml-1">Admin</span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/admin/monitoring"
              className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              <Activity size={14} /> Monitoring
            </a>
            <a
              href="/admin/settings"
              className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              <SlidersHorizontal size={14} /> Settings
            </a>
            <a
              href="/admin/debug"
              className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              <Bug size={14} /> Debug
            </a>
            <a href="/" className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
              ← Back to app
            </a>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">

        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Admin Dashboard</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Settings and changelog for PrintPerfect</p>
        </div>

        {/* ── Model configuration (read-only) ─────────────────────────────────── */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
          <h2 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-1">
            <Cpu size={18} className="text-primary-600" /> Claude Model
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Currently configured: <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-xs font-bold">{activeModel || "loading…"}</code>
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-5">
            Model selection is managed in <a href="/admin/settings" className="text-primary-600 dark:text-primary-400 hover:underline">Admin Settings → AI Model</a>.
            Changes apply immediately to all new requests without requiring a server restart.
          </p>
          <a
            href="/admin/settings"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 hover:bg-primary-200 dark:hover:bg-primary-900/50 text-sm font-semibold transition-colors"
          >
            <SlidersHorizontal size={14} /> Go to Settings
          </a>
        </section>

        {/* ── Release notes ──────────────────────────────────────────────────── */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
          <h2 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-5">
            <BookOpen size={18} className="text-primary-600" /> Release Notes
          </h2>

          <div className="space-y-6">
            {[...RELEASE_NOTES].reverse().map((release, idx) => (
              <div key={release.version} className="relative pl-6">
                {/* Timeline dot */}
                <div className={clsx(
                  "absolute left-0 top-1 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900",
                  idx === 0 ? "bg-primary-600" : "bg-slate-300 dark:bg-slate-600"
                )} />
                {/* Timeline line */}
                {idx < RELEASE_NOTES.length - 1 && (
                  <div className="absolute left-[5px] top-4 bottom-[-24px] w-px bg-slate-200 dark:bg-slate-700" />
                )}

                <div className="flex items-baseline gap-3 mb-2">
                  <span className={clsx(
                    "text-sm font-bold",
                    idx === 0 ? "text-primary-600 dark:text-primary-400" : "text-slate-700 dark:text-slate-300"
                  )}>
                    v{release.version}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">{formatDate(release.date)}</span>
                  {idx === 0 && (
                    <span className="text-xs font-semibold bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-400 px-1.5 py-0.5 rounded-full">
                      Latest
                    </span>
                  )}
                </div>

                <ul className="space-y-1.5">
                  {release.changes.map((change, i) => (
                    <li key={i} className="text-sm text-slate-600 dark:text-slate-300 flex items-start gap-2">
                      <span className="text-slate-400 dark:text-slate-500 flex-shrink-0 mt-0.5">•</span>
                      {change}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
