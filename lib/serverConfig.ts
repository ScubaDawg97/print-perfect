/**
 * Server-side runtime configuration.
 *
 * Model selection is stored in a module-level variable so it persists for the
 * lifetime of the server process. On Vercel, each function instance maintains
 * its own copy; for permanent changes set CLAUDE_MODEL in your environment
 * variables and redeploy (the user acknowledged this is fine).
 */

export const AVAILABLE_MODELS = [
  {
    id: "claude-3-5-haiku-20241022",
    label: "Haiku 3.5",
    description: "Fastest & most affordable — good for high-volume use",
    costPer1M: "$0.80 input / $4 output",
    tier: "economy" as const,
  },
  {
    id: "claude-sonnet-4-20250514",
    label: "Sonnet 4",
    description: "Balanced quality & cost — recommended default",
    costPer1M: "$3 input / $15 output",
    tier: "standard" as const,
  },
  {
    id: "claude-opus-4-20250514",
    label: "Opus 4",
    description: "Most capable — richest explanations, highest cost",
    costPer1M: "$15 input / $75 output",
    tier: "premium" as const,
  },
] as const;

export type ModelId = (typeof AVAILABLE_MODELS)[number]["id"];

// Initialise from env var; falls back to Sonnet 4
let _model: string = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-20250514";

export function getModel(): string {
  return _model;
}

export function setModel(model: string): void {
  const valid = AVAILABLE_MODELS.some((m) => m.id === model);
  if (!valid) throw new Error(`Unknown model: ${model}`);
  _model = model;
}
