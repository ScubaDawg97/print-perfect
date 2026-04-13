"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import clsx from "clsx";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = stored === "dark" || (!stored && prefersDark);
    setDark(isDark);
    setMounted(true);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  // Avoid hydration mismatch — render nothing until mounted
  if (!mounted) return <div className="w-[72px] h-8" />;

  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className={clsx(
        "flex items-center gap-1.5 rounded-full px-2 py-1.5 border transition-colors duration-200",
        dark
          ? "bg-slate-800 border-slate-700 hover:bg-slate-700"
          : "bg-slate-100 border-slate-200 hover:bg-slate-200"
      )}
    >
      {/* Sun icon */}
      <Sun
        size={13}
        className={clsx(
          "transition-colors",
          dark ? "text-slate-500" : "text-amber-500"
        )}
      />

      {/* Sliding pill */}
      <div
        className={clsx(
          "relative w-8 h-4 rounded-full transition-colors duration-200",
          dark ? "bg-primary-600" : "bg-slate-300"
        )}
      >
        <div
          className={clsx(
            "absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-200",
            dark ? "translate-x-[18px]" : "translate-x-0.5"
          )}
        />
      </div>

      {/* Moon icon */}
      <Moon
        size={13}
        className={clsx(
          "transition-colors",
          dark ? "text-primary-400" : "text-slate-400"
        )}
      />
    </button>
  );
}
