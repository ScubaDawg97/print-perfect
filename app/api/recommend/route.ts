import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getConfigValue, getConfig, DEFAULT_CONFIG } from "@/lib/config";
import { getClientIp, checkAndIncrementRateLimit, isIpUnlocked } from "@/lib/rateLimiter";
import { sanitizeInput, wrapUserContent, INPUT_LIMITS } from "@/lib/sanitize";
import { logApiCall, maskIp } from "@/lib/abuseMonitor";
import { hasValidOwnerToken } from "@/lib/ownerToken";

// ── Zod request schema ────────────────────────────────────────────────────────
// Validated against the actual GeometryAnalysis, UserInputs, and PrintSettings
// types from lib/types.ts. Rejects malformed or adversarial request bodies
// before they reach the rule engine or prompt construction.

const RecommendRequestSchema = z.object({
  geometry: z.object({
    dimensions: z.object({
      x: z.number().min(0).max(10_000),
      y: z.number().min(0).max(10_000),
      z: z.number().min(0).max(10_000),
    }),
    volume:              z.number().min(0).max(1_000_000),
    surfaceArea:         z.number().min(0).max(100_000_000),
    baseSurfaceArea:     z.number().min(0).max(100_000_000),
    triangleCount:       z.number().int().min(0).max(50_000_000),
    overhangPercentage:  z.number().min(0).max(100),
    hasSignificantOverhangs: z.boolean(),
    overhangSeverity:    z.enum(["none", "minor", "moderate", "severe"]),
    complexity:          z.enum(["simple", "moderate", "complex"]),
    complexityReason:    z.string().max(200),
    fileName:            z.string().max(255),
    fileType:            z.enum(["stl", "obj", "3mf"]),
    wasAutoOriented:     z.boolean(),
  }),

  inputs: z.object({
    printerModel:  z.string().min(1).max(80),
    filamentType:  z.enum([
      "PLA", "PLA+", "PLA Silk", "PLA Matte", "PLA-CF",
      "PETG", "PETG-CF", "ABS", "ASA",
      "TPU", "Nylon", "PC", "Resin",
    ]),
    filamentBrand: z.string().max(60).default(""),
    nozzleDiameter: z.union([
      z.literal(0.2), z.literal(0.4), z.literal(0.6), z.literal(0.8),
    ]),
    nozzleMaterial: z.enum([
      "brass", "hardened_steel", "stainless_steel", "ruby_tipped", "tungsten_carbide", "copper_plated"
    ]).default("brass"),
    nozzleType: z.enum([
      "standard", "cht", "volcano", "induction", "quick_swap"
    ]).default("standard"),
    flowRate: z.enum([
      "standard_flow", "high_flow"
    ]).default("standard_flow"),
    bedSurface:    z.string().min(1).max(50),
    humidity:      z.enum(["Low", "Normal", "High"]),
    printPriority: z.enum(["Draft", "Standard", "Quality", "Ultra"]),
    isFunctional:  z.boolean(),
    problemDescription: z.string().max(75).default(""),
  }),

  settings: z.object({
    layerHeight:     z.number().min(0).max(2),
    printTemp:       z.number().min(0).max(500),
    bedTemp:         z.number().min(0).max(300),
    printSpeed:      z.number().min(0).max(1000),
    coolingFan:      z.number().min(0).max(100),
    infill:          z.number().min(0).max(100),
    supportType:     z.enum(["None", "Normal", "Tree"]),
    supportDensity:  z.number().min(0).max(100),
    adhesion:        z.enum(["None", "Brim", "Raft"]),
    adhesionWidth:   z.number().min(0).max(100),
    wallCount:       z.number().int().min(0).max(20),
    topBottomLayers: z.number().int().min(0).max(20),
  }),
});

// ── Model selection — reads from KV config (single source of truth) ──────────
// The KV config system in lib/config.ts is the authoritative model source.
// This fallback cache means we check KV at most once per minute for new model changes.
// If KV is unavailable, we fall back to DEFAULT_CONFIG.claudeModel (Haiku).
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
    // If KV read fails, fall back to the DEFAULT_CONFIG value (Haiku),
    // which is merged into getConfig() in lib/config.ts
    const { claudeModel } = await getConfig();
    return claudeModel;
  }
}

/** Returns true if the Anthropic API error indicates the model ID is invalid. */
function isModelNotFoundError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return msg.includes("not_found_error") || msg.includes('"type":"not_found_error"');
}

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const requestStartTime = Date.now();

  // ── Check for owner bypass FIRST — before any rate limiting ────────────────
  // Owner token verified server-side via signed HMAC — cannot be forged
  const isOwner = hasValidOwnerToken(req);

  // ── Server-side rate limiting ─────────────────────────────────────────────
  // Enforced before any expensive work. Backed by Vercel KV in production and
  // an in-memory Map in local dev. Clearing localStorage does NOT bypass this.
  // If owner bypass is active, this check is skipped entirely.
  const ip = getClientIp(req);

  let rateLimit: Awaited<ReturnType<typeof checkAndIncrementRateLimit>>;

  if (isOwner) {
    // Owner bypass active — skip all rate limiting
    // Create a mock rateLimit object that indicates no limit
    rateLimit = {
      allowed: true,
      count: 0,
      limit: Infinity,
      remainingToday: Infinity,
      resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      hardCeiling: false,
    };

    // Log the call with owner flag (fire-and-forget)
    void logApiCall({
      timestamp: new Date().toISOString(),
      partialIp: maskIp(ip),
      allowed: true,
      isOwner: true,
    });
  } else {
    // Normal rate limiting flow
    const [freeLimit, unlocked] = await Promise.all([
      getConfigValue("dailyFreeAnalyses"),
      isIpUnlocked(ip),
    ]);

    rateLimit = await checkAndIncrementRateLimit(ip, freeLimit, unlocked);

    if (!rateLimit.allowed) {
      // Log the blocked request for abuse monitoring (fire-and-forget)
      void logApiCall({
        timestamp: new Date().toISOString(),
        partialIp: maskIp(ip),
        allowed: false,
        blockedReason: rateLimit.hardCeiling ? "hard_ceiling" : "rate_limit",
      });

      return NextResponse.json(
        {
          error: "rate_limit_exceeded",
          hardCeiling: rateLimit.hardCeiling,
          remainingToday: 0,
          resetAt: rateLimit.resetAt,
          message: rateLimit.hardCeiling
            ? "Daily limit reached. Please try again tomorrow."
            : "Daily free limit reached. Tip to unlock more analyses today.",
        },
        { status: 429 },
      );
    }
  }

  // ── Validate request body (Zod) ──────────────────────────────────────────
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parseResult = RecommendRequestSchema.safeParse(rawBody);
  if (!parseResult.success) {
    // Log validation failure for abuse monitoring (fire-and-forget)
    void logApiCall({
      timestamp: new Date().toISOString(),
      partialIp: maskIp(ip),
      allowed: false,
      blockedReason: "validation_failed",
    });

    return NextResponse.json(
      {
        error: "validation_failed",
        message: "Invalid request format.",
        // Omit detailed errors in production to avoid schema fingerprinting
        ...(process.env.NODE_ENV === "development"
          ? { details: parseResult.error.flatten() }
          : {}),
      },
      { status: 400 },
    );
  }

  const { geometry, inputs, settings } = parseResult.data;

  // ── Sanitize all free-text fields before prompt construction ──────────────
  // Numeric/enum fields are validated by type coercion in the rule engine.
  // Only string fields that get interpolated into the prompt need sanitization.
  const safeFileName         = sanitizeInput(geometry.fileName, 255, "fileName");
  const safeFilamentBrand    = sanitizeInput(inputs.filamentBrand, INPUT_LIMITS.filamentBrand, "filamentBrand");
  const safePrinterModel     = sanitizeInput(inputs.printerModel,  INPUT_LIMITS.printerModel,  "printerModel");
  const safeBedSurface       = sanitizeInput(inputs.bedSurface,    INPUT_LIMITS.bedSurface,    "bedSurface");
  const safeProblemDescription = sanitizeInput(inputs.problemDescription, 75, "problemDescription");

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

  // Calculate nozzle material offset for temperature guidance
  const nozzleTempInfo =
    inputs.nozzleMaterial !== "brass"
      ? ` Also mention: The print temperature has been adjusted ${
          inputs.nozzleMaterial === "hardened_steel" || inputs.nozzleMaterial === "tungsten_carbide"
            ? "+5°C"
            : "+10°C"
        } higher than baseline because ${inputs.nozzleMaterial.replace(/_/g, " ")} nozzles require slightly higher temps for optimal material flow.`
      : "";

  const prompt = `You are a friendly, encouraging 3D printing expert helping a complete beginner nail their first print. Write like a knowledgeable friend — warm, clear, jargon-free (explain any technical term in plain English the first time you use it).

## Model Analysis
- File: ${wrapUserContent(safeFileName, "file_name")}
- Dimensions: ${geometry.dimensions.x}mm wide × ${geometry.dimensions.y}mm deep × ${geometry.dimensions.z}mm tall
- Estimated volume: ${geometry.volume} cm³
- Triangle count: ${geometry.triangleCount.toLocaleString()}
- Overhangs: ${overhangDesc}
- Geometric complexity: ${geometry.complexity} (${geometry.complexityReason})

## Printer Setup
- Printer: ${wrapUserContent(safePrinterModel, "printer_model")}
- Filament: ${inputs.filamentType}${safeFilamentBrand ? ` (${wrapUserContent(safeFilamentBrand, "filament_brand")})` : ""}
- Nozzle: ${inputs.nozzleDiameter}mm ${inputs.nozzleMaterial === "brass" ? "(standard brass)" : `(${inputs.nozzleMaterial.replace(/_/g, " ")})`}${inputs.nozzleType === "standard" ? "" : `, ${inputs.nozzleType.toUpperCase()}`}
- Flow rate capability: ${inputs.flowRate === "high_flow" ? "High Flow (max 28 mm³/s)" : "Standard Flow (max 12 mm³/s)"}
- Bed surface: ${wrapUserContent(safeBedSurface, "bed_surface")}
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
${inputs.filamentType === "PLA Matte" ? `
## PLA Matte — Required guidance
This user is printing with PLA Matte. You MUST naturally incorporate all three of these beginner-friendly warnings into your response (in watchOutFor, tipsForSuccess, or settingExplanations — wherever they fit best):
1. PLA Matte uses special additives (usually silica or wax) to create the matte look — don't print it at standard PLA temperatures. The recommended temperature (${settings.printTemp}°C) is lower than regular PLA to prevent the additives from burning off, which would ruin the matte finish.
2. Print speed is capped at a lower value with PLA Matte — printing faster than recommended can cause the matte additives to melt unevenly, resulting in a glossy or streaky appearance instead of a consistent matte finish.
3. PLA Matte benefits greatly from full cooling fan (100%) to solidify layers evenly and preserve the matte texture. If you see uneven texture or rough patches, make sure your cooling fan is reaching full speed by layer 3.
` : ""}
${inputs.nozzleMaterial !== "brass" && ["PLA-CF", "PETG-CF", "Nylon"].includes(inputs.filamentType) ? `
## Nozzle Material — Abrasive Filament Alert
This user has selected a hardened nozzle material (${inputs.nozzleMaterial.replace(/_/g, " ")}) for ${inputs.filamentType}. This is the RIGHT choice. Naturally mention in commonMistakes or watchOutFor:
- Brass nozzles wear out very quickly with abrasive filaments like ${inputs.filamentType}. The ${inputs.nozzleMaterial.replace(/_/g, " ")} nozzle they've selected will last many prints while maintaining dimensional accuracy.
` : ""}
${inputs.nozzleMaterial === "brass" && ["PLA-CF", "PETG-CF", "Nylon"].includes(inputs.filamentType) ? `
## Nozzle Material — Abrasive Filament Warning
This is a CRITICAL mismatch: the user is attempting to print ${inputs.filamentType} (abrasive) with a brass nozzle. You MUST include this warning in commonMistakes:
- Using a brass nozzle with ${inputs.filamentType} filament is a recipe for disaster. Brass is soft and will wear out in 2-3 prints, causing dimensional drift and quality loss. The user MUST switch to hardened steel, stainless steel, tungsten carbide, or ruby-tipped nozzles before printing this filament.
` : ""}
${safeProblemDescription.trim() ? `
## User-Described Concern
The user has described a specific problem: "${safeProblemDescription}"

This concern must shape your response. Internally classify it as:
- "settings_fixable": directly addressable by slicer settings (stringing, layer adhesion, warping, surface quality, etc.)
- "partially_settings": settings can help but may have a hardware/filament quality component
- "hardware_maintenance": primarily mechanical or maintenance (clogged nozzle, worn PTFE, loose belts, etc.)
- "unclear": not enough information

Generate a "concernResponse" object in your JSON with: classification, directAnswer (2-3 sentences directly addressing their concern, naming specific settings), hardwareNote (if applicable), settingsImpact (list of settings you adjusted for them), and confidenceNote (if unclear).

Where a setting directly relates to their concern, end that panel's explanation with "(This specifically addresses your [concern in 5 words].)" — but only for 1-3 panels where genuinely relevant.

Bias your settings recommendations toward addressing their stated concern within safe ranges.
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
    "printTemp": "1-2 sentences: why this temperature${nozzleTempInfo}",
    "bedTemp": "1-2 sentences: why this bed temperature",
    "printSpeed": "1-2 sentences: why this speed${inputs.flowRate === "high_flow" ? " (this printer's high-flow nozzle capability allows this speed)" : ""}",
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
    "common beginner mistake 1 specific to ${inputs.filamentType} on ${wrapUserContent(safePrinterModel, "printer_model")}",
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
  "pressureAdvanceRange": {"min": 0.03, "max": 0.08},
  "concernResponse": null or {
    "classification": "settings_fixable" | "partially_settings" | "hardware_maintenance" | "unclear",
    "directAnswer": "2-3 sentences directly addressing their problem. Name specific settings.",
    "hardwareNote": null or "1-2 sentences on what to check before adjusting settings",
    "settingsImpact": ["list", "of", "specific settings you adjusted for their concern"],
    "confidenceNote": null or "brief note if insufficient information to classify"
  }
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

    // Security: _debugPrompt is intentionally NOT included in the API response.
    // The full prompt text is saved to localStorage (pp_debug_last_run) by the
    // client for admin debugging only — it is never sent over the network.
    delete parsed._debugPrompt;

    // Include server-side rate limit state so the client UI can stay accurate
    parsed._rateLimit = {
      used: rateLimit.count,
      limit: rateLimit.limit,
      remainingToday: rateLimit.remainingToday,
      resetAt: rateLimit.resetAt,
    };

    // Log successful request for abuse monitoring (fire-and-forget)
    void logApiCall({
      timestamp: new Date().toISOString(),
      partialIp: maskIp(ip),
      allowed: true,
      filamentType: inputs.filamentType,
      qualityTier: inputs.printPriority,
      durationMs: Date.now() - requestStartTime,
    });

    return NextResponse.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Couldn't reach Claude: ${message}. Check your ANTHROPIC_API_KEY and try again.` }, { status: 500 });
  }
}
