import { z } from "zod";

/**
 * ─── Equipment Data Schemas ───────────────────────────────────────────────────
 * All equipment types are validated with Zod before storage in KV.
 * Each has an id (UUID v4), group classification, and optional notes.
 */

// ─── Printer Equipment ─────────────────────────────────────────────────────────

export const EquipmentPrinterSchema = z.object({
  id: z.string().uuid(),
  vendorName: z.string().min(1).max(100),
  modelName: z.string().min(1).max(100),
  group: z.string().min(1).max(100), // e.g., "Creality", "Bambu Lab"
  maxBedTempC: z.number().int().nonnegative(),
  maxNozzleTempC: z.number().int().nonnegative(),
  isEnclosed: z.boolean().default(false),
  isDirectDrive: z.boolean().default(false),
  buildPlateX: z.number().positive().optional(),
  buildPlateY: z.number().positive().optional(),
  notes: z.string().max(500).optional(),
  active: z.boolean().default(true),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export type EquipmentPrinter = z.infer<typeof EquipmentPrinterSchema>;

// ─── Bed Surface Equipment ─────────────────────────────────────────────────────

export const EquipmentSurfaceSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string().min(1).max(100),
  internalKey: z.string().min(1).max(50), // Maps to rule engine keys: CoolPlate, EngineeringPlate, etc.
  group: z.string().min(1).max(100), // e.g., "Bambu Lab plates", "Glass"
  maxTempC: z.number().int().nonnegative(),
  notes: z.string().max(500).optional(),
  description: z.string().max(500).optional(),
  active: z.boolean().default(true),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export type EquipmentSurface = z.infer<typeof EquipmentSurfaceSchema>;

// ─── Nozzle Equipment ─────────────────────────────────────────────────────────

export const EquipmentNozzleSchema = z.object({
  id: z.string().uuid(),
  diameterMm: z.number().positive(),
  material: z.enum([
    "brass",
    "hardened_steel",
    "stainless_steel",
    "ruby_tipped",
    "tungsten_carbide",
    "copper_plated",
  ]),
  type: z.enum(["standard", "cht", "volcano", "induction", "quick_swap"]),
  notes: z.string().max(500).optional(),
  active: z.boolean().default(true),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export type EquipmentNozzle = z.infer<typeof EquipmentNozzleSchema>;

// ─── Equipment Suggestion ──────────────────────────────────────────────────────

export const EquipmentSuggestionSchema = z.object({
  id: z.string().uuid(),
  equipmentType: z.enum(["printer", "surface", "nozzle"]),
  proposedName: z.string().min(1).max(100),
  userDescription: z.string().min(5).max(500),
  userCharacteristics: z.string().max(500).optional(),
  submissionTime: z.string().datetime(),
  submitterIp: z.string().optional(), // Masked IP for rate limiting reference
  votes: z.number().int().nonnegative().default(0),
  status: z.enum(["pending", "approved", "rejected"]).default("pending"),
  approvedAt: z.string().datetime().optional(),
  approvedBy: z.string().optional(), // Admin identifier
  notes: z.string().max(500).optional(),
});

export type EquipmentSuggestion = z.infer<typeof EquipmentSuggestionSchema>;

// ─── Combined Union Types ──────────────────────────────────────────────────────

export type AnyEquipment = EquipmentPrinter | EquipmentSurface | EquipmentNozzle;

export const AnyEquipmentSchema = z.union([
  EquipmentPrinterSchema,
  EquipmentSurfaceSchema,
  EquipmentNozzleSchema,
]);

// ─── API Response Types ────────────────────────────────────────────────────────

export const EquipmentListResponseSchema = z.object({
  printers: z.array(EquipmentPrinterSchema).optional(),
  surfaces: z.array(EquipmentSurfaceSchema).optional(),
  nozzles: z.array(EquipmentNozzleSchema).optional(),
  cached: z.boolean(),
  ttl: z.number().int().nonnegative(), // milliseconds until cache expires
  fetchedAt: z.string().datetime(),
});

export type EquipmentListResponse = z.infer<typeof EquipmentListResponseSchema>;

// ─── Suggestion Request Schema ─────────────────────────────────────────────────

export const SubmitEquipmentSuggestionSchema = z.object({
  equipmentType: z.enum(["printer", "surface", "nozzle"]),
  name: z.string().min(1).max(100),
  description: z.string().min(5).max(500),
  characteristics: z.string().max(500).optional(),
});

export type SubmitEquipmentSuggestion = z.infer<typeof SubmitEquipmentSuggestionSchema>;

// ─── Suggestion Response Schema ────────────────────────────────────────────────

export const EquipmentSuggestionResponseSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["submitted", "rate_limited", "error"]),
  message: z.string(),
});

export type EquipmentSuggestionResponse = z.infer<typeof EquipmentSuggestionResponseSchema>;

// ─── Other Equipment Form Schema ───────────────────────────────────────────────

export const OtherEquipmentFormSchema = z.object({
  equipmentType: z.enum(["printer", "surface", "nozzle"]),
  name: z.string().min(1).max(100),
  description: z.string().min(5).max(500),
  characteristics: z.string().max(500).optional(),
});

export type OtherEquipmentFormData = z.infer<typeof OtherEquipmentFormSchema>;
