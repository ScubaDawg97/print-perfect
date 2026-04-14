import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import type { GeometryAnalysis, UserInputs, PrintSettings } from "@/lib/types";
import { getModel } from "@/lib/serverConfig";
import { getConfigValue, DEFAULT_CONFIG } from "@/lib/config";

// ── Model cache — re-reads from KV at most once per minute ───────────────────
let _cachedModel: string | null   = null;
let _modelCachedAt: number        = 0;
const MODEL_CACHE_TTL             = 60_000; // 1 minute

async function getActiveModel(): Promise<string> {
  const now = Date.now();
  if (_cachedModel && now - _modelCachedAt < MODEL_CACHE_TTL) return _cachedModel;
  try {
    _cachedModel    = await getConfigValue("claudeModel");
    _modelCachedAt  = now;
    return _cachedModel;
  } catch {
    return getModel(); // fall back to in-memory / env var
  }
}

/** Returns true if the Anthropic API error indicates the model ID is invalid. */
function isModelNotFoundError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return msg.includes("not_found_error") || msg.includes('"type":"not_found_error"');
}

const client = new Anthropic();

// ── Server-side rate limiting ─────────────────────────────────────────────────
// Backstop against abuse — the friendly 3/day UX limit lives in localStorage.
// This Map resets on server restart (by design — no database dependency).
// Deliberately generous (10/day per IP) to accommodate shared IPs.

const SERVER_DAILY_LIMIT = 10;
const ipCounts = new Map<string, { date: string; count: number }>();

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

function checkServerLimit(ip: string): boolean {
  const today = new Date().toISOString().split("T")[0];
  const record = ipCounts.get(ip);

  if (!record || record.date !== today) {
    // New IP or new day — start fresh
    ipCounts.set(ip, { date: today, count: 1 });
    return true;
  }

  if (record.count >= SERVER_DAILY_LIMIT) {
    return false; // blocked
  }

  record.count += 1;
  return true;
}

export async function POST(req: NextRequest) {
  // Server-side abuse guard — checked before any expensive work
  const ip = getClientIp(req);
  if (!checkServerLimit(ip)) {
    return NextResponse.json(
      { error: "rate_limit", message: "Daily limit exceeded. Please try again tomorrow." },
      { status: 429 },
    );
  }

  const { geometry, inputs, settings } = (await req.json()) as {
    geometry: GeometryAnalysis;
    inputs: UserInputs;
    settings: PrintSettings;
  };

  const overhangDesc =
    geometry.overhangSeverity === "none"   ? "no significant overhangs" :
    geometry.overhangSeverity === "minor"  ? "minor overhangs (under 30°)" :
    geometry.overhangSeverity === "moderate" ? "moderate overhangs past 45°" :
    "severe overhangs — significant portions need support";

  const qualityDesc: Record<string, string> = {
    Draft:    "Draft — fast, coarser layers (0.28mm), great for fit tests",
    Standard: "Standard — balanced quality and speed (0.20mm layers)",
    Quality:  "Quality — smooth finish, slower (0.12mm layers)",
    Ultra:    "Ultra — maximum detail, very slow (0.08mm layers)",
  };

  const prompt = `You are a friendly, encouraging 3D printing expert helping a complete beginner nail their first print. Write like a knowledgeable friend — warm, clear, jargon-free (explain any technical term in plain English the first time you use it).

## Model Analysis
- File: ${geometry.fileName}
- Dimensions: ${geometry.dimensions.x}mm wide × ${geometry.dimensions.y}mm deep × ${geometry.dimensions.z}mm tall
- Estimated volume: ${geometry.volume} cm³
- Triangle count: ${geometry.triangleCount.toLocaleString()}
- Overhangs: ${overhangDesc}
- Geometric complexity: ${geometry.complexity} (${geometry.complexityReason})

## Printer Setup
- Printer: ${inputs.printerModel}
- Filament: ${inputs.filamentType}${inputs.filamentBrand ? ` (${inputs.filamentBrand})` : ""}
- Nozzle diameter: ${inputs.nozzleDiameter}mm
- Bed surface: ${inputs.bedSurface}
- Room humidity: ${inputs.humidity}
- Quality tier: ${qualityDesc[inputs.printPriority] ?? inputs.printPriority}
- Purpose: ${inputs.isFunctional ? "functional part (infill boosted for strength)" : "decorative piece"}
${inputs.filamentType === "PLA Silk" ? `
## PLA Silk — Required guidance
This user is printing with PLA Silk. You MUST naturally incorporate all three of these beginner-friendly warnings into your response (in watchOutFor, tipsForSuccess, or settingExplanations — wherever they fit best):
1. PLA Silk prints noticeably slower than regular PLA — this is intentional. Rushing it causes poor layer bonding and a dull, streaky finish instead of the glossy look they're after.
2. The beautiful glossy finish is achieved through slower print speeds and slightly higher temperatures. Resist the temptation to speed it up in your slicer.
3. PLA Silk is more prone to stringing than standard PLA. If you see thin hairs or "whiskers" between separate parts of your print, try dropping the nozzle temperature by 5°C or increasing retraction distance slightly.
` : ""}

## Recommended Settings
- Layer height: ${settings.layerHeight}mm
- Print temperature: ${settings.printTemp}°C
- Bed temperature: ${settings.bedTemp}°C
- Print speed: ${settings.printSpeed}mm/s
- Cooling fan: ${settings.coolingFan}%
- Infill: ${settings.infill}%
- Supports: ${settings.supportType}${settings.supportType !== "None" ? ` at ${settings.supportDensity}% density` : ""}
- Bed adhesion: ${settings.adhesion}${settings.adhesion !== "None" ? ` (${settings.adhesionWidth}mm wide)` : ""}
- Wall count: ${settings.wallCount}
- Top/bottom layers: ${settings.topBottomLayers}

Respond with a JSON object (no markdown fences, no commentary — just valid JSON) in EXACTLY this shape:

{
  "geometrySummary": "2-3 sentences: plain-English summary of the model geometry and what it means for printing",
  "settingExplanations": {
    "layerHeight": "1-2 sentences: why this layer height",
    "printTemp": "1-2 sentences: why this temperature",
    "bedTemp": "1-2 sentences: why this bed temperature",
    "printSpeed": "1-2 sentences: why this speed",
    "coolingFan": "1-2 sentences: why this fan level",
    "infill": "1-2 sentences: why this infill %",
    "supports": "1-2 sentences: why supports are or aren't needed",
    "adhesion": "1-2 sentences: why this adhesion choice",
    "walls": "1-2 sentences: why this wall count"
  },
  "settingConfidence": {
    "layerHeight": "high|medium|low",
    "printTemp": "high|medium|low",
    "bedTemp": "high|medium|low",
    "printSpeed": "high|medium|low",
    "coolingFan": "high|medium|low",
    "infill": "high|medium|low",
    "supports": "high|medium|low",
    "adhesion": "high|medium|low",
    "walls": "high|medium|low"
  },
  "watchOutFor": [
    "specific warning 1 for this exact print",
    "specific warning 2",
    "specific warning 3"
  ],
  "tipsForSuccess": [
    "actionable beginner tip 1 specific to this setup",
    "actionable beginner tip 2",
    "actionable beginner tip 3"
  ],
  "commonMistakes": [
    "common beginner mistake 1 specific to ${inputs.filamentType} on ${inputs.printerModel}",
    "common beginner mistake 2",
    "common beginner mistake 3",
    "common beginner mistake 4"
  ],
  "materialBlurb": "2-3 sentences in plain English about ${inputs.filamentType} as a material: what it is best used for, its main limitations, and one practical thing a first-time user of this material should know. Assume the reader has never used this filament type before.",
  "specialNotes": [
    "practical filament-specific note for this exact setup that doesn't fit in watchOutFor or tipsForSuccess",
    "note 2",
    "note 3"
  ],
  "pressureAdvanceRange": {"min": 0.03, "max": 0.08}
}

Special field guidance:
- specialNotes: 2-4 practical notes specific to this filament type and printer combination. These should be things a beginner wouldn't know — storage tips, common interaction effects, printer-specific gotchas, or post-processing advice. Keep each note to 1-2 sentences.
- pressureAdvanceRange: the typical starting PA/LA tuning range for ${inputs.filamentType} on this class of printer. Use null for flexible filaments like TPU where PA/LA is not applicable. Use null for resin printers.

Confidence guidelines:
- "high" = well-established rule with little variation (e.g. PLA bed temp on PEI)
- "medium" = good starting point but may need fine-tuning for this specific printer/brand
- "low" = heavily dependent on factors we can't know (e.g. exact room temp, filament batch)`;

  try {
    let activeModel = await getActiveModel();

    let message;
    try {
      message = await client.messages.create({
        model: activeModel,
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      });
    } catch (modelErr) {
      // If the stored model ID is invalid (e.g. a bad admin setting), clear the
      // cache and retry once with the hardcoded default model so the user still
      // gets a result rather than a hard failure.
      if (isModelNotFoundError(modelErr)) {
        console.warn(`Model "${activeModel}" not found — falling back to default. Clear this in Admin → Settings.`);
        _cachedModel   = null;
        _modelCachedAt = 0;
        activeModel    = DEFAULT_CONFIG.claudeModel;
        message = await client.messages.create({
          model: activeModel,
          max_tokens: 2000,
          messages: [{ role: "user", content: prompt }],
        });
      } else {
        throw modelErr;
      }
    }

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: "Failed to parse AI response", raw: text }, { status: 500 });
    }

    parsed._debugPrompt = prompt;
    return NextResponse.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Couldn't reach Claude: ${message}. Check your ANTHROPIC_API_KEY and try again.` }, { status: 500 });
  }
}
