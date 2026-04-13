"use client";

// ─── Share card section ───────────────────────────────────────────────────────
// Renders a live canvas preview of the branded share card (600×315 display,
// 1200×630 actual) and provides Download PNG + Copy share text actions.

import { useRef, useEffect, useState, useCallback } from "react";
import { Download, Copy, Check, Share2 } from "lucide-react";
import { renderShareCard, buildShareText, downloadShareCardFromData } from "@/lib/shareCard";
import type { ShareCardData } from "@/lib/shareCard";

interface Props {
  data: ShareCardData;
}

export default function ShareCardSection({ data }: Props) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied]           = useState(false);

  // Re-render canvas, wrapped in useCallback so the effect dep array is stable
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    renderShareCard(canvas, data);
  }, [data]);

  // Debounced re-render — 300 ms after any data change
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(renderCanvas, 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [renderCanvas]);

  async function handleDownload() {
    setDownloading(true);
    try {
      await downloadShareCardFromData(data);
    } finally {
      setDownloading(false);
    }
  }

  async function handleCopy() {
    const text = buildShareText(data);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for browsers without Clipboard API
      const ta = document.createElement("textarea");
      ta.value           = text;
      ta.style.position  = "fixed";
      ta.style.opacity   = "0";
      ta.style.top       = "0";
      ta.style.left      = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try { document.execCommand("copy"); } catch { /* silent fail */ }
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="card p-5 space-y-4 no-print">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <Share2 size={16} className="text-slate-400 dark:text-slate-500 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Share your settings</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
            Download a branded PNG card or copy a text summary to share with your community.
          </p>
        </div>
      </div>

      {/* Canvas preview — drawn at 1200×630, shown at ≤600×315 */}
      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-[#0F2027]">
        <canvas
          ref={canvasRef}
          width={1200}
          height={630}
          style={{ width: "100%", maxWidth: "600px", height: "auto", display: "block" }}
          aria-label="Share card preview"
        />
      </div>

      {/* iOS note — only rendered if needed, checked at runtime in downloadShareCardFromData */}
      <p className="text-[11px] text-slate-400 dark:text-slate-500">
        On iPhone/iPad: tap Download PNG — the image will open in a new tab where you can long-press to save.
      </p>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="btn-primary text-sm gap-2"
        >
          <Download size={14} />
          {downloading ? "Generating…" : "Download PNG"}
        </button>

        <button
          onClick={handleCopy}
          className="btn-secondary text-sm gap-2"
        >
          {copied
            ? <Check size={14} className="text-emerald-500 flex-shrink-0" />
            : <Copy  size={14} className="flex-shrink-0" />
          }
          {copied ? "Copied!" : "Copy share text"}
        </button>
      </div>
    </div>
  );
}
