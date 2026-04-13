"use client";

// Renders a small count bubble next to the History nav link.
// Reads from localStorage and listens for pp_history_change events so it
// updates immediately when sessions are added or deleted.

import { useEffect, useState } from "react";

const STORAGE_KEY = "printperfect_history";

function readCount(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.length : 0;
  } catch {
    return 0;
  }
}

export default function HistoryBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    function refresh() {
      setCount(readCount());
    }

    refresh(); // Initial read after mount (localStorage is client-only)

    window.addEventListener("pp_history_change", refresh);
    return () => window.removeEventListener("pp_history_change", refresh);
  }, []);

  if (count === 0) return null;

  return (
    <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary-500 text-white text-[9px] font-bold leading-none">
      {count}
    </span>
  );
}
