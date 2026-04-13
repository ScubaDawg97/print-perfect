"use client";

// ─── Maintenance mode guard ───────────────────────────────────────────────────
//
// Wraps the main content in layout.tsx. When maintenanceMode is true in config,
// replaces the entire page with a maintenance message instead of rendering children.
// Uses DEFAULT_PUBLIC_CONFIG (maintenanceMode=false) while loading, so there is
// no flash of the maintenance page on normal page loads.
//
// Admin routes (/admin/*) are ALWAYS allowed through so the admin can turn
// maintenance mode off again via /admin/settings.

import { usePublicConfig } from "@/lib/publicConfig";
import { usePathname } from "next/navigation";
import SpoolIcon from "./SpoolIcon";

interface Props {
  children: React.ReactNode;
}

export default function MaintenanceGuard({ children }: Props) {
  const config   = usePublicConfig();
  const pathname = usePathname();

  // Always let admin routes through so the admin can turn maintenance off
  const isAdminRoute = pathname?.startsWith("/admin");

  if (!config.maintenanceMode || isAdminRoute) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 text-center">
      <div className="max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <span className="text-primary-500">
            <SpoolIcon className="w-16 h-16" />
          </span>
        </div>

        <h1 className="text-3xl font-bold text-white mb-2">
          Print<span className="text-primary-500">Perfect</span>
        </h1>

        {/* Maintenance message */}
        <p className="text-slate-300 text-lg mt-6 leading-relaxed">
          {config.maintenanceMessage}
        </p>
        <p className="text-slate-500 text-sm mt-4">Check back soon!</p>

        {/* Animated spinner */}
        <div className="mt-10 flex justify-center">
          <div className="w-10 h-10 rounded-full border-4 border-slate-700 border-t-primary-500 animate-spin" />
        </div>
      </div>
    </div>
  );
}
