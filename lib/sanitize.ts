/**
 * @file lib/sanitize.ts
 * @description Input sanitization utilities for all user-supplied text
 * that gets interpolated into the Claude AI prompt.
 *
 * SECURITY MODEL:
 * Defense-in-depth against prompt injection. Claude itself is resistant to
 * injection, but we should not rely solely on the AI's robustness. Sanitizing
 * inputs before prompt construction is standard practice for LLM-integrated apps.
 *
 * APPROACH:
 * 1. Enforce strict length limits on every field.
 * 2. Strip known injection pattern keywords.
 * 3. Remove characters with no legitimate use in 3D printing context.
 * 4. Wrap all user content in XML-style delimiters so the AI sees it clearly
 *    as DATA, not INSTRUCTIONS — even if a pattern slips through sanitization.
 * 5. Log suspicious inputs for admin review (KV in production, console in dev).
 */

// ── Known prompt injection patterns ──────────────────────────────────────────
// Case-insensitive. Deliberately broad — false positives on legitimate brand
// names are extremely unlikely in a 3D printing context.

const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/gi,
  /you\s+are\s+now\s+(a|an)\s/gi,
  /act\s+as\s+(if\s+you\s+are\s+)?(a|an)\s/gi,
  /disregard\s+(all\s+)?(previous|prior)/gi,
  /forget\s+(all\s+)?(previous|prior|everything)/gi,
  /new\s+instructions?\s*:/gi,
  /system\s*prompt\s*:/gi,
  /\[INST\]/gi,
  /\[\/INST\]/gi,
  /<\|im_start\|>/gi,
  /<\|im_end\|>/gi,
  /###\s*instruction/gi,
  /###\s*system/gi,
  /<system>/gi,
  /<\/system>/gi,
];

// ── Field length limits ───────────────────────────────────────────────────────

/**
 * Maximum character lengths for each input field type.
 * Generous enough for any legitimate value, restrictive enough to block abuse.
 */
export const INPUT_LIMITS = {
  filamentBrand:  60,
  filamentType:   30,
  printerModel:   80,
  bedSurface:     50,
  sessionName:    60,
  generalText:   200,
} as const;

// ── Core sanitizer ────────────────────────────────────────────────────────────

/**
 * Sanitizes a user-supplied string before it is interpolated into the Claude prompt.
 *
 * Steps applied in order:
 *   1. Null/type guard — returns "" for non-strings.
 *   2. Trim and enforce max length.
 *   3. Strip null bytes and ASCII control chars (except tab/newline).
 *   4. Detect and redact injection pattern attempts; log them asynchronously.
 *   5. Collapse excessive whitespace.
 *
 * Does NOT strip legitimate special chars: hyphens, plus signs, dots, slashes,
 * colons — all common in filament/printer names (e.g. "PLA+", "PETG-CF", "0.4mm").
 *
 * @param input     - Raw user input string.
 * @param maxLength - Maximum character count (defaults to INPUT_LIMITS.generalText).
 * @param fieldName - Field name used in suspicious-input logs.
 * @returns Sanitized string safe for prompt interpolation.
 */
export function sanitizeInput(
  input: unknown,
  maxLength: number = INPUT_LIMITS.generalText,
  fieldName = "unknown",
): string {
  if (!input || typeof input !== "string") return "";

  // Step 1 — trim and length-cap
  let s = input.trim().slice(0, maxLength);

  // Step 2 — strip null bytes and non-printable control characters
  // Allow: tab (0x09), newline (0x0A), carriage return (0x0D)
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // Step 3 — detect and redact injection patterns
  let flagged = false;
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(s)) {
      flagged = true;
      s = s.replace(pattern, "[removed]");
      // Reset lastIndex for global regexes
      pattern.lastIndex = 0;
    }
  }

  if (flagged) {
    // Fire-and-forget — never let logging delay the request
    void logSuspiciousInput(fieldName, input.slice(0, 200));
  }

  // Step 4 — collapse runs of 3+ whitespace chars
  s = s.replace(/\s{3,}/g, "  ").trim();

  return s;
}

// ── Prompt delimiter wrapper ──────────────────────────────────────────────────

/**
 * Wraps sanitized user content in XML-style delimiters for the Claude prompt.
 *
 * Even if a subtle injection pattern evades the regex sanitizer, the delimiters
 * signal to the AI that this content is USER DATA, not INSTRUCTIONS. Claude
 * respects this framing robustly.
 *
 * Example output:
 *   <user_data field="filament_brand">Bambu Lab</user_data>
 *
 * @param content   - Already-sanitized string (call sanitizeInput first).
 * @param fieldName - Semantic label for the data field.
 * @returns Delimited string ready for safe prompt interpolation.
 */
export function wrapUserContent(content: string, fieldName: string): string {
  return `<user_data field="${fieldName}">${content}</user_data>`;
}

// ── Suspicious input logger ───────────────────────────────────────────────────

/**
 * Records a suspicious input attempt for admin review.
 *
 * In production (KV configured): writes to Vercel KV under key
 *   "security:suspicious:{timestamp}" with a 7-day TTL.
 * In development: writes to console.warn.
 *
 * Never throws — logging failure must not disrupt the request.
 *
 * @param field - The field where the injection was detected.
 * @param input - The raw (unsanitized) input value, truncated for storage.
 */
export async function logSuspiciousInput(field: string, input: string): Promise<void> {
  try {
    if (process.env.NODE_ENV === "production") {
      // Dynamic import so this module stays Edge-compatible in middleware
      const { isKvConfigured } = await import("./config");
      if (isKvConfigured()) {
        const { kv } = await import("@vercel/kv");
        const key = `security:suspicious:${Date.now()}`;
        await kv.set(
          key,
          {
            field,
            input: input.slice(0, 200), // cap stored length
            timestamp: new Date().toISOString(),
          },
          { ex: 7 * 86_400 }, // 7 days
        );
      }
    } else {
      console.warn(
        `[SECURITY] Injection attempt detected — field: "${field}" | input: ${input}`,
      );
    }
  } catch {
    // Logging must never break the request
  }
}
