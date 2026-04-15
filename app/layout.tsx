import type { Metadata } from "next";
import "./globals.css";
import ThemeToggle from "@/components/ThemeToggle";
import SpoolIcon from "@/components/SpoolIcon";
import WeatherWidget from "@/components/WeatherWidget";
import HistoryNavItem from "@/components/HistoryNavItem";
import DynamicTagline from "@/components/DynamicTagline";
import MaintenanceGuard from "@/components/MaintenanceGuard";
import GuidePanel from "@/components/GuidePanel";
import { Settings } from "lucide-react";

export const metadata: Metadata = {
  title: "Print Perfect — 3D Printing Settings for Beginners",
  description:
    "Upload your 3D model and get perfect slicer settings instantly. Free tool for beginner 3D printing enthusiasts.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-50 dark:bg-slate-950" suppressHydrationWarning>
        <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
            {/*
              Hard-navigation to "/" resets all React client state cleanly.
              prefetch={false} avoids Next.js pre-loading the same page.
            */}
            <a
              href="/"
              className="flex items-center gap-2 group select-none"
              title="Start over — return to home"
            >
              <span className="text-primary-600 group-hover:text-primary-500 transition-colors">
                <SpoolIcon className="w-7 h-7" />
              </span>
              <span className="font-bold text-lg text-slate-900 dark:text-slate-100 tracking-tight">
                Print<span className="text-primary-600 group-hover:text-primary-500 transition-colors">Perfect</span>
              </span>
            </a>

            <div className="flex items-center gap-3">
              {/* Live weather — hidden by feature flag when weatherWidgetEnabled=false */}
              <WeatherWidget />
              {/* Dynamic tagline — driven by siteTagline config */}
              <DynamicTagline />
              <ThemeToggle />
              {/* Guide help panel — trigger + slide-out panel */}
              <GuidePanel />
              {/* History link — hidden by feature flag when historyEnabled=false */}
              <HistoryNavItem />
              {/* Admin gear icon */}
              <a
                href="/admin"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Admin panel"
                aria-label="Admin settings"
              >
                <Settings size={16} />
              </a>
            </div>
          </div>
        </header>

        {/* MaintenanceGuard shows maintenance page when maintenanceMode=true */}
        <MaintenanceGuard>
          <main className="max-w-4xl mx-auto px-4 py-8">{children}</main>
        </MaintenanceGuard>

        <footer className="border-t border-slate-200 dark:border-slate-800 mt-16 py-6 no-print">
          <div className="max-w-4xl mx-auto px-4 text-center text-xs text-slate-400 space-y-1">
            <p>Your files never leave your browser. Nothing is stored.</p>
            <p>PrintPerfect is free forever. Made with ❤️ for the 3D printing community.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
