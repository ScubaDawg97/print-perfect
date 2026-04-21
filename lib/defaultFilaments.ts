import { v4 as uuidv4 } from "uuid";
import type { FilamentType } from "./filamentSchemas";

/**
 * ─── Default Filament Types ────────────────────────────────────────────────────
 * Extracted from hardcoded FILAMENT_TYPES in InputForm.tsx.
 * Serves as fallback when KV is unavailable and seed data for initial KV population.
 */

// Helper to generate deterministic UUIDs for default filaments
// (ensures consistent IDs across rebuilds)
function deterministicUuid(seed: string): string {
  // In a real system, you'd use a deterministic UUID v5 library
  // For now, we'll just hardcode UUIDs to ensure consistency
  const filamentUuids: Record<string, string> = {
    PLA: "00000000-0000-0000-0000-000000000001",
    "PLA+": "00000000-0000-0000-0000-000000000002",
    "PLA Silk": "00000000-0000-0000-0000-000000000003",
    "PLA Matte": "00000000-0000-0000-0000-000000000004",
    PETG: "00000000-0000-0000-0000-000000000005",
    ABS: "00000000-0000-0000-0000-000000000006",
    ASA: "00000000-0000-0000-0000-000000000007",
    TPU: "00000000-0000-0000-0000-000000000008",
    Nylon: "00000000-0000-0000-0000-000000000009",
    PC: "00000000-0000-0000-0000-000000000010",
    "PLA-CF": "00000000-0000-0000-0000-000000000011",
    "PETG-CF": "00000000-0000-0000-0000-000000000012",
    Resin: "00000000-0000-0000-0000-000000000013",
  };
  return filamentUuids[seed] || uuidv4();
}

export const DEFAULT_FILAMENTS: FilamentType[] = [
  {
    id: deterministicUuid("PLA"),
    displayName: "PLA",
    description: "Easy, great for most prints",
    color: "#FFD700",
    active: true,
  },
  {
    id: deterministicUuid("PLA+"),
    displayName: "PLA+",
    description: "Tougher than standard PLA",
    color: "#FFA500",
    active: true,
  },
  {
    id: deterministicUuid("PLA Silk"),
    displayName: "PLA Silk",
    description: "Glossy finish — slower speed, higher temp",
    color: "#FFB6C1",
    active: true,
  },
  {
    id: deterministicUuid("PLA Matte"),
    displayName: "PLA Matte",
    description: "Matte finish — detailed look, slower print",
    color: "#D2B48C",
    active: true,
  },
  {
    id: deterministicUuid("PETG"),
    displayName: "PETG",
    description: "Tough, moisture resistant",
    color: "#4169E1",
    active: true,
  },
  {
    id: deterministicUuid("ABS"),
    displayName: "ABS",
    description: "Tough, needs enclosure",
    color: "#2F4F4F",
    active: true,
  },
  {
    id: deterministicUuid("ASA"),
    displayName: "ASA",
    description: "UV resistant, outdoor use",
    color: "#8B0000",
    active: true,
  },
  {
    id: deterministicUuid("TPU"),
    displayName: "TPU",
    description: "Flexible, rubbery",
    color: "#FF69B4",
    active: true,
  },
  {
    id: deterministicUuid("Nylon"),
    displayName: "Nylon",
    description: "Strong, hygroscopic",
    color: "#696969",
    active: true,
  },
  {
    id: deterministicUuid("PC"),
    displayName: "Polycarbonate",
    description: "Very strong, high temp",
    color: "#ADD8E6",
    active: true,
  },
  {
    id: deterministicUuid("PLA-CF"),
    displayName: "PLA-CF",
    description: "Carbon-filled PLA — stiffer",
    color: "#1C1C1C",
    active: true,
  },
  {
    id: deterministicUuid("PETG-CF"),
    displayName: "PETG-CF",
    description: "Carbon-filled PETG",
    color: "#2F4F4F",
    active: true,
  },
  {
    id: deterministicUuid("Resin"),
    displayName: "Resin (MSLA/DLP)",
    description: "High detail, for resin printers",
    color: "#DC143C",
    active: true,
  },
];
