export interface PrinterProfile {
  id: string; // uuid v4 generated with crypto.randomUUID()
  nickname: string;
  printerModel: string;
  nozzleDiameter: 0.2 | 0.4 | 0.6 | 0.8;
  bedSurface: string;
  isDefault: boolean;
  createdAt: string; // ISO 8601
}

const STORAGE_KEY = "printperfect_printer_profiles";
const MAX_PROFILES = 10;

export function isLocalStorageAvailable(): boolean {
  try {
    const test = "__pp_test__";
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

export function loadProfiles(): PrinterProfile[] {
  if (!isLocalStorageAvailable()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as PrinterProfile[];
  } catch {
    return [];
  }
}

export function saveProfiles(profiles: PrinterProfile[]): void {
  if (!isLocalStorageAvailable()) return;
  try {
    // Enforce max 10 profiles — keep most recent
    const trimmed = profiles.slice(0, MAX_PROFILES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Storage quota exceeded or other error — fail silently
  }
}

export function addProfile(profile: Omit<PrinterProfile, "id" | "createdAt">): PrinterProfile {
  const profiles = loadProfiles();
  const newProfile: PrinterProfile = {
    ...profile,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  // If this is marked as default, clear other defaults
  const updated = profile.isDefault
    ? profiles.map((p) => ({ ...p, isDefault: false }))
    : [...profiles];
  updated.unshift(newProfile); // newest first
  saveProfiles(updated);
  return newProfile;
}

export function updateProfile(id: string, changes: Partial<PrinterProfile>): PrinterProfile[] {
  let profiles = loadProfiles();
  // If setting a new default, clear others
  if (changes.isDefault) {
    profiles = profiles.map((p) => ({ ...p, isDefault: false }));
  }
  profiles = profiles.map((p) => (p.id === id ? { ...p, ...changes } : p));
  saveProfiles(profiles);
  return profiles;
}

export function deleteProfile(id: string): PrinterProfile[] {
  const profiles = loadProfiles().filter((p) => p.id !== id);
  saveProfiles(profiles);
  return profiles;
}

export function getDefaultProfile(): PrinterProfile | null {
  const profiles = loadProfiles();
  return profiles.find((p) => p.isDefault) ?? profiles[0] ?? null;
}
