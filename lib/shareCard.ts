// ─── PrintPerfect share card ──────────────────────────────────────────────────
// Renders a 1200×630 branded PNG using the Canvas 2D API.
// No external dependencies — pure browser canvas only.

import type { UserInputs, PrintSettings, GeometryAnalysis, OutcomeFlag } from "./types";

export const SITE_URL = "printperfect.app";

export interface ShareCardData {
  sessionName: string;
  inputs: UserInputs;
  settings: PrintSettings;
  geometry: GeometryAnalysis;
  outcomeFlag: OutcomeFlag;
  savedAt?: string;
}

// ── Color maps ────────────────────────────────────────────────────────────────

const TIER_COLOR: Record<string, string> = {
  Draft:    "#888780",
  Standard: "#1D9E75",
  Quality:  "#378ADD",
  Ultra:    "#7F77DD",
};

const OUTCOME_COLOR: Record<string, string> = {
  success: "#1D9E75",
  partial: "#BA7517",
  failed:  "#A32D2D",
};

const OUTCOME_LABEL: Record<string, string> = {
  success: "✓ Success",
  partial: "~ Partial",
  failed:  "✗ Failed",
};

// ── Canvas helpers ────────────────────────────────────────────────────────────

/** Draws a filled rounded rectangle without relying on the optional roundRect API. */
function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
  const R = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + R, y);
  ctx.lineTo(x + w - R, y);
  ctx.arcTo(x + w, y,     x + w, y + R,     R);
  ctx.lineTo(x + w, y + h - R);
  ctx.arcTo(x + w, y + h, x + w - R, y + h, R);
  ctx.lineTo(x + R, y + h);
  ctx.arcTo(x,     y + h, x,     y + h - R, R);
  ctx.lineTo(x,     y + R);
  ctx.arcTo(x,     y,     x + R, y,         R);
  ctx.closePath();
  ctx.fill();
}

/** Truncates text with an ellipsis to fit within maxWidth pixels. */
function truncate(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 0 && ctx.measureText(t + "…").width > maxWidth) {
    t = t.slice(0, -1);
  }
  return t + "…";
}

// ── Main render ───────────────────────────────────────────────────────────────

/**
 * Draws the full 1200×630 share card onto the supplied canvas element.
 * Call this from a client component — requires a browser context.
 */
export function renderShareCard(canvas: HTMLCanvasElement, data: ShareCardData): void {
  const W = 1200;
  const H = 630;
  canvas.width  = W;
  canvas.height = H;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const { sessionName, inputs, settings, geometry, outcomeFlag } = data;
  const tierColor = TIER_COLOR[inputs.printPriority] ?? "#1D9E75";
  const SF = "-apple-system, 'Segoe UI', Arial, sans-serif";

  // ── Background ──────────────────────────────────────────────────────────────

  ctx.fillStyle = "#0F2027";
  ctx.fillRect(0, 0, W, H);

  // Subtle gradient tint
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "rgba(29, 158, 117, 0.07)");
  grad.addColorStop(1, "rgba(55, 138, 221, 0.04)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // ── Header ──────────────────────────────────────────────────────────────────

  // Brand name
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `bold 50px ${SF}`;
  ctx.fillText("PrintPerfect", 60, 80);

  // Site URL
  ctx.fillStyle = "#4A6B7A";
  ctx.font = `19px ${SF}`;
  ctx.fillText(SITE_URL, 60, 108);

  // Tier badge — right-aligned
  const tierLabel = inputs.printPriority.toUpperCase();
  ctx.font = `bold 15px ${SF}`;
  const tierTextW = ctx.measureText(tierLabel).width;
  const tierPadX  = 18;
  const tierW     = tierTextW + tierPadX * 2;
  const tierH     = 34;
  const tierX     = W - 60 - tierW;
  const tierY     = 52;

  ctx.fillStyle = tierColor + "28"; // 16 % opacity background
  fillRoundRect(ctx, tierX, tierY, tierW, tierH, 8);

  ctx.fillStyle = tierColor;
  ctx.textAlign = "center";
  ctx.fillText(tierLabel, tierX + tierW / 2, tierY + tierH / 2 + 5);
  ctx.textAlign = "left";

  // Header divider
  ctx.strokeStyle = "#1D3040";
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  ctx.moveTo(60, 132);
  ctx.lineTo(W - 60, 132);
  ctx.stroke();

  // ── Left column: model info ─────────────────────────────────────────────────

  const leftX    = 60;
  const colBreak = 510; // dividing line between columns

  // Session name
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `bold 30px ${SF}`;
  ctx.fillText(truncate(ctx, sessionName, colBreak - leftX - 20), leftX, 182);

  // Filament line
  const filamentLabel = inputs.filamentBrand
    ? `${inputs.filamentType} — ${inputs.filamentBrand}`
    : inputs.filamentType;
  ctx.fillStyle = "#7DB3C4";
  ctx.font = `20px ${SF}`;
  ctx.fillText(truncate(ctx, filamentLabel, colBreak - leftX - 20), leftX, 217);

  // Printer model
  ctx.fillStyle = "#7DB3C4";
  ctx.font = `18px ${SF}`;
  ctx.fillText(truncate(ctx, inputs.printerModel, colBreak - leftX - 20), leftX, 248);

  // Nozzle + dimensions
  const dims = geometry.dimensions;
  ctx.fillStyle = "#3E5F6E";
  ctx.font = `15px ${SF}`;
  ctx.fillText(
    `${inputs.nozzleDiameter}mm nozzle  ·  ${dims.x.toFixed(0)}×${dims.y.toFixed(0)}×${dims.z.toFixed(0)}mm`,
    leftX,
    274,
  );

  // Outcome flag badge (if set)
  if (outcomeFlag) {
    const flagColor  = OUTCOME_COLOR[outcomeFlag] ?? "#1D9E75";
    const flagLabel  = OUTCOME_LABEL[outcomeFlag] ?? outcomeFlag;
    ctx.font = `bold 14px ${SF}`;
    const flagTextW  = ctx.measureText(flagLabel).width;
    const flagPadX   = 16;
    const flagW      = flagTextW + flagPadX * 2;
    const flagH      = 30;
    const flagY      = 295;

    ctx.fillStyle = flagColor + "28";
    fillRoundRect(ctx, leftX, flagY, flagW, flagH, 15);
    ctx.fillStyle = flagColor;
    ctx.fillText(flagLabel, leftX + flagPadX, flagY + 20);
  }

  // ── Right column: settings grid 2×3 ────────────────────────────────────────

  const rightX  = colBreak + 50;
  const rightW  = W - 60 - rightX;
  const pillW   = (rightW - 16) / 2;
  const pillH   = 86;
  const gapX    = 16;
  const gapY    = 14;
  const startY  = 150;

  const pills: Array<{ label: string; value: string }> = [
    { label: "Layer Height",  value: `${settings.layerHeight}mm` },
    { label: "Infill",        value: `${settings.infill}%` },
    { label: "Print Temp",    value: `${settings.printTemp}°C` },
    { label: "Bed Temp",      value: settings.bedTemp > 0 ? `${settings.bedTemp}°C` : "N/A" },
    { label: "Print Speed",   value: `${settings.printSpeed}mm/s` },
    { label: "Supports",      value: settings.supportType === "None" ? "None" : settings.supportType },
  ];

  pills.forEach(({ label, value }, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const px  = rightX + col * (pillW + gapX);
    const py  = startY + row * (pillH + gapY);

    // Pill background
    ctx.fillStyle = "#152230";
    fillRoundRect(ctx, px, py, pillW, pillH, 10);

    // Label
    ctx.fillStyle = "#3E6070";
    ctx.font = `13px ${SF}`;
    ctx.fillText(label, px + 14, py + 24);

    // Value
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `bold 28px ${SF}`;
    ctx.fillText(value, px + 14, py + 62);
  });

  // ── Footer ──────────────────────────────────────────────────────────────────

  // Separator
  ctx.strokeStyle = "#1D3040";
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  ctx.moveTo(60, 505);
  ctx.lineTo(W - 60, 505);
  ctx.stroke();

  // Footer left
  ctx.fillStyle = "#2E4A59";
  ctx.font = `16px ${SF}`;
  ctx.fillText("Your slice settings, AI-optimized", 60, 546);

  ctx.fillStyle = "#1E3A49";
  ctx.font = `14px ${SF}`;
  const footerLine = inputs.problemDescription
    ? `${geometry.fileName}  ·  ${inputs.filamentType}  ·  ${inputs.printPriority}  ·  Concern: ${inputs.problemDescription}`
    : `${geometry.fileName}  ·  ${inputs.filamentType}  ·  ${inputs.printPriority}`;
  ctx.fillText(
    truncate(ctx, footerLine, W - 180),
    60,
    572,
  );

  // Footer right — branded URL
  ctx.fillStyle = tierColor;
  ctx.font = `bold 20px ${SF}`;
  ctx.textAlign = "right";
  ctx.fillText(SITE_URL, W - 60, 546);
  ctx.textAlign = "left";
}

// ── Share text ────────────────────────────────────────────────────────────────

/** Builds a plain-text summary suitable for clipboard sharing. */
export function buildShareText(data: ShareCardData): string {
  const { sessionName, inputs, settings, geometry, outcomeFlag, savedAt } = data;

  const outcomeStr = outcomeFlag ? ` · ${OUTCOME_LABEL[outcomeFlag] ?? outcomeFlag}` : "";
  const dateStr    = savedAt
    ? new Date(savedAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
    : "";

  const lines = [
    `🖨️ ${sessionName}${outcomeStr}`,
    ``,
    `Filament: ${inputs.filamentType}${inputs.filamentBrand ? ` (${inputs.filamentBrand})` : ""}`,
    `Printer:  ${inputs.printerModel}  ·  ${inputs.nozzleDiameter}mm nozzle`,
    ...(inputs.problemDescription ? [`Concern:  ${inputs.problemDescription}`] : []),
    ``,
    `Settings (${inputs.printPriority}):`,
    `  Layer height : ${settings.layerHeight}mm`,
    `  Print temp   : ${settings.printTemp}°C  ·  Bed: ${settings.bedTemp > 0 ? settings.bedTemp + "°C" : "N/A"}`,
    `  Speed        : ${settings.printSpeed}mm/s  ·  Infill: ${settings.infill}%`,
    `  Walls        : ${settings.wallCount}  ·  Supports: ${settings.supportType}`,
    ``,
    `Model: ${geometry.fileName}`,
    `  ${geometry.dimensions.x.toFixed(0)}×${geometry.dimensions.y.toFixed(0)}×${geometry.dimensions.z.toFixed(0)}mm  ·  ${geometry.complexity} geometry`,
    ...(dateStr ? [`  Analyzed: ${dateStr}`] : []),
    ``,
    `Generated by ${SITE_URL}`,
  ];

  return lines.join("\n");
}

// ── Slug helper ───────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// ── Download helper ───────────────────────────────────────────────────────────

/**
 * Creates an offscreen canvas, renders the share card, then triggers a PNG
 * download. On iOS Safari (which blocks programmatic anchor clicks) it opens
 * the blob URL in a new tab instead — the user can long-press to save.
 */
export async function downloadShareCardFromData(data: ShareCardData): Promise<void> {
  const canvas = document.createElement("canvas");
  renderShareCard(canvas, data);

  return new Promise<void>((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) { resolve(); return; }

      const url      = URL.createObjectURL(blob);
      const fileName = `printperfect-${slugify(data.sessionName) || "settings"}.png`;

      // iOS Safari cannot trigger downloads via <a> click — open in new tab
      const isIos = /iPad|iPhone|iPod/i.test(navigator.userAgent);
      if (isIos) {
        window.open(url, "_blank");
        resolve();
        return;
      }

      const a = document.createElement("a");
      a.href     = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 3000);
      resolve();
    }, "image/png");
  });
}
