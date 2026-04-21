import { z } from "zod";

/**
 * ─── Filament Type Schema ──────────────────────────────────────────────────────
 * Represents a filament type available in the system.
 */
export const FilamentTypeSchema = z.object({
  id: z.string().min(1).max(100), // Allow any non-empty string as ID (UUID or custom format)
  displayName: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  color: z.string().nullable().optional(),
  active: z.boolean().default(true),
  createdAt: z.string().datetime().optional(),
});

export type FilamentType = z.infer<typeof FilamentTypeSchema>;

/**
 * ─── Filament Suggestion Schema ────────────────────────────────────────────────
 * Represents a user-submitted filament suggestion awaiting admin review.
 */
export const FilamentSuggestionSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string().min(1).max(100),
  userDescription: z.string().min(5).max(500),
  characteristics: z.string().max(500).nullable().optional(),
  status: z.enum(["pending", "approved", "rejected"]).default("pending"),
  votes: z.number().int().nonnegative().default(0),
  submissionTime: z.string().datetime(),
});

export type FilamentSuggestion = z.infer<typeof FilamentSuggestionSchema>;

/**
 * ─── Filament List Response Schema ─────────────────────────────────────────────
 * API response containing filament data with cache metadata.
 */
export const FilamentListResponseSchema = z.object({
  filaments: z.array(FilamentTypeSchema),
  cached: z.boolean(),
  ttl: z.number().nonnegative(), // TTL remaining in milliseconds
  fetchedAt: z.string().datetime(),
});

export type FilamentListResponse = z.infer<typeof FilamentListResponseSchema>;
