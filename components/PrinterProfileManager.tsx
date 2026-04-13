"use client";

import { useState, useEffect, useRef } from "react";
import { X, Printer, Plus, Trash2, Pencil, Check, Shield, Star, ChevronDown } from "lucide-react";
import clsx from "clsx";
import type { PrinterProfile } from "@/lib/printerProfiles";
import {
  loadProfiles,
  saveProfiles,
  addProfile,
  updateProfile,
  deleteProfile,
  isLocalStorageAvailable,
} from "@/lib/printerProfiles";

// ─── Printer & bed surface options (mirror InputForm data) ────────────────────

const PRINTER_GROUPS: { group: string; models: string[] }[] = [
  {
    group: "Bambu Lab",
    models: [
      "Bambu Lab A1 Mini","Bambu Lab A1 Mini Combo","Bambu Lab A1","Bambu Lab A1 Combo",
      "Bambu Lab P1P","Bambu Lab P1S","Bambu Lab P2S","Bambu Lab X1 Carbon","Bambu Lab X1E","Bambu Lab H2D",
    ],
  },
  {
    group: "Creality",
    models: [
      "Creality Ender 3","Creality Ender 3 V2","Creality Ender 3 S1","Creality Ender 3 S1 Pro",
      "Creality Ender 3 V3","Creality Ender 3 V3 SE","Creality Ender 3 V3 KE","Creality Ender 5 S1",
      "Creality Ender 5 Plus","Creality K1","Creality K1 Max","Creality K1C","Creality K2 Plus",
      "Creality CR-10 Smart Pro","Creality Sermoon V2",
    ],
  },
  {
    group: "Prusa",
    models: ["Prusa i3 MK3S+","Prusa MK4","Prusa MK4S","Prusa MINI+","Prusa XL","Prusa Core One"],
  },
  {
    group: "Elegoo",
    models: [
      "Elegoo Neptune 3 Pro","Elegoo Neptune 4","Elegoo Neptune 4 Pro","Elegoo Neptune 4 Plus",
      "Elegoo Neptune 4 Max","Elegoo Neptune 4 X","Elegoo Mars 4 Ultra (Resin)","Elegoo Mars 5 Ultra (Resin)","Elegoo Saturn 4 Ultra (Resin)",
    ],
  },
  {
    group: "Flashforge",
    models: ["Flashforge Adventurer 5M","Flashforge Adventurer 5M Pro","Flashforge Creator 4","Flashforge Guider 3 Ultra"],
  },
  {
    group: "AnkerMake",
    models: ["AnkerMake M5","AnkerMake M5C"],
  },
  {
    group: "Artillery",
    models: ["Artillery Sidewinder X4 Plus","Artillery Sidewinder X4 Pro","Artillery Genius Pro","Artillery Hornet"],
  },
  {
    group: "Sovol",
    models: ["Sovol SV06","Sovol SV06 Plus","Sovol SV07 Plus","Sovol SV08","Sovol SV09"],
  },
  {
    group: "QIDI Tech",
    models: ["QIDI Tech X-Plus 4","QIDI Tech X-Max 4","QIDI Tech X-CF Pro","QIDI Tech Q1 Pro"],
  },
  {
    group: "Voron",
    models: ["Voron 0.2","Voron Trident","Voron 2.4","Voron Switchwire"],
  },
  {
    group: "Other / DIY",
    models: ["Other / Custom Printer"],
  },
];

const BED_SURFACES = [
  "PEI Textured","PEI Smooth","PEI Satin",
  "Bambu Cool Plate","Bambu Engineering Plate","Bambu High-Temp Plate","Bambu Dual-Sided Plate",
  "Wham Bam","Garolite","BuildTak","SuperTack","Magnetic Flex (generic)",
  "Borosilicate Glass","Carborundum Glass","Other / Unknown",
];

// ─── Empty form state ─────────────────────────────────────────────────────────

interface FormState {
  nickname: string;
  printerModel: string;
  nozzleDiameter: 0.2 | 0.4 | 0.6 | 0.8;
  bedSurface: string;
  isDefault: boolean;
}

const EMPTY_FORM: FormState = {
  nickname: "",
  printerModel: "",
  nozzleDiameter: 0.4,
  bedSurface: "PEI Textured",
  isDefault: false,
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onLoadProfile: (profile: PrinterProfile) => void;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PrinterProfileManager({ onLoadProfile }: Props) {
  const [open, setOpen] = useState(false);
  const [profiles, setProfiles] = useState<PrinterProfile[]>([]);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setStorageAvailable(isLocalStorageAvailable());
    setProfiles(loadProfiles());
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        closeModal();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function closeModal() {
    setOpen(false);
    setShowAddForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFormErrors((prev) => { const e = { ...prev }; delete e[key]; return e; });
  }

  function validateForm(): boolean {
    const e: Record<string, string> = {};
    if (!form.nickname.trim()) e.nickname = "Nickname is required";
    if (!form.printerModel) e.printerModel = "Please select a printer";
    setFormErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleAddSubmit() {
    if (!validateForm()) return;
    const newProfile = addProfile({
      nickname: form.nickname.trim(),
      printerModel: form.printerModel,
      nozzleDiameter: form.nozzleDiameter,
      bedSurface: form.bedSurface,
      isDefault: form.isDefault,
    });
    setProfiles(loadProfiles());
    setShowAddForm(false);
    setForm(EMPTY_FORM);
    // Auto-load the newly added profile
    onLoadProfile(newProfile);
  }

  function handleEditSubmit() {
    if (!editingId || !validateForm()) return;
    updateProfile(editingId, {
      nickname: form.nickname.trim(),
      printerModel: form.printerModel,
      nozzleDiameter: form.nozzleDiameter,
      bedSurface: form.bedSurface,
      isDefault: form.isDefault,
    });
    setProfiles(loadProfiles());
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function startEdit(profile: PrinterProfile) {
    setEditingId(profile.id);
    setShowAddForm(false);
    setForm({
      nickname: profile.nickname,
      printerModel: profile.printerModel,
      nozzleDiameter: profile.nozzleDiameter,
      bedSurface: profile.bedSurface,
      isDefault: profile.isDefault,
    });
    setFormErrors({});
  }

  function handleDelete(id: string) {
    const updated = deleteProfile(id);
    setProfiles(updated);
    if (editingId === id) {
      setEditingId(null);
      setForm(EMPTY_FORM);
    }
  }

  function handleSetDefault(id: string) {
    updateProfile(id, { isDefault: true });
    setProfiles(loadProfiles());
  }

  function handleLoad(profile: PrinterProfile) {
    onLoadProfile(profile);
    closeModal();
  }

  const canAddMore = profiles.length < 10;

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
        title="Manage saved printer profiles"
      >
        <Printer size={13} />
        My Printers
      </button>

      {/* Modal overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div
            ref={dialogRef}
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col max-h-[85vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Printer size={18} className="text-primary-600 dark:text-primary-400" />
                <h2 className="font-bold text-slate-900 dark:text-slate-100">My Printers</h2>
                {/* Privacy badge */}
                <div className="relative ml-1">
                  <button
                    type="button"
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    onMouseEnter={() => setTooltipVisible(true)}
                    onMouseLeave={() => setTooltipVisible(false)}
                    onFocus={() => setTooltipVisible(true)}
                    onBlur={() => setTooltipVisible(false)}
                    aria-label="Privacy information"
                  >
                    <Shield size={14} />
                  </button>
                  {tooltipVisible && (
                    <div
                      ref={tooltipRef}
                      role="tooltip"
                      className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 px-3 py-2 rounded-xl bg-slate-800 dark:bg-slate-700 text-white text-xs leading-relaxed shadow-xl z-10 pointer-events-none"
                    >
                      Saved locally on your device only. Never uploaded anywhere.
                      <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-800 dark:border-t-slate-700" />
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {!storageAvailable && (
                <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
                  Printer profiles can&apos;t be saved because your browser has local storage disabled or in private mode. Profiles will be lost when you close the tab.
                </div>
              )}

              {/* Profile list */}
              {profiles.length === 0 && !showAddForm && (
                <div className="text-center py-8 text-slate-400 dark:text-slate-500">
                  <Printer size={36} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">No saved printers yet</p>
                  <p className="text-xs mt-1">Add your printer to quickly fill in the form next time.</p>
                </div>
              )}

              {profiles.map((profile) => (
                <div
                  key={profile.id}
                  className={clsx(
                    "rounded-xl border p-4 transition-all",
                    editingId === profile.id
                      ? "border-primary-400 ring-2 ring-primary-200 dark:ring-primary-800 bg-primary-50 dark:bg-primary-900/20"
                      : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50"
                  )}
                >
                  {editingId === profile.id ? (
                    // Inline edit form
                    <ProfileForm
                      form={form}
                      setField={setField}
                      errors={formErrors}
                      onCancel={() => { setEditingId(null); setForm(EMPTY_FORM); setFormErrors({}); }}
                      onSubmit={handleEditSubmit}
                      submitLabel="Save Changes"
                    />
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">
                            {profile.nickname}
                          </span>
                          {profile.isDefault && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-400">
                              <Star size={9} /> Default
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{profile.printerModel}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                          Nozzle: {profile.nozzleDiameter}mm · {profile.bedSurface}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleLoad(profile)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-primary-600 text-white hover:bg-primary-700 transition-colors"
                        >
                          Load
                        </button>
                        {!profile.isDefault && (
                          <button
                            type="button"
                            onClick={() => handleSetDefault(profile.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                            title="Set as default"
                          >
                            <Star size={14} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => startEdit(profile)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                          title="Edit profile"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(profile.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                          title="Delete profile"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Add new form */}
              {showAddForm && (
                <div className="rounded-xl border border-primary-300 dark:border-primary-700 ring-2 ring-primary-200 dark:ring-primary-900 bg-primary-50 dark:bg-primary-900/20 p-4">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                    <Plus size={14} /> Add New Printer
                  </p>
                  <ProfileForm
                    form={form}
                    setField={setField}
                    errors={formErrors}
                    onCancel={() => { setShowAddForm(false); setForm(EMPTY_FORM); setFormErrors({}); }}
                    onSubmit={handleAddSubmit}
                    submitLabel="Save Printer"
                  />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between flex-shrink-0">
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {profiles.length}/10 printers saved
              </span>
              {canAddMore && !showAddForm && editingId === null && (
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(true);
                    setEditingId(null);
                    setForm(EMPTY_FORM);
                    setFormErrors({});
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary-600 text-white text-xs font-semibold hover:bg-primary-700 transition-colors"
                >
                  <Plus size={13} /> Add New
                </button>
              )}
              {!canAddMore && (
                <span className="text-xs text-slate-400 dark:text-slate-500">Max 10 profiles reached</span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Reusable profile form ────────────────────────────────────────────────────

interface ProfileFormProps {
  form: FormState;
  setField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  errors: Record<string, string>;
  onCancel: () => void;
  onSubmit: () => void;
  submitLabel: string;
}

function ProfileForm({ form, setField, errors, onCancel, onSubmit, submitLabel }: ProfileFormProps) {
  return (
    <div className="space-y-3">
      {/* Nickname */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
          Nickname *
        </label>
        <input
          type="text"
          className={clsx(
            "w-full px-3 py-2 rounded-xl border text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition",
            errors.nickname
              ? "border-orange-400 ring-2 ring-orange-200"
              : "border-slate-300 dark:border-slate-600"
          )}
          placeholder="e.g. My Ender 3, Work Bambu…"
          value={form.nickname}
          onChange={(e) => setField("nickname", e.target.value)}
          maxLength={40}
        />
        {errors.nickname && <p className="text-xs text-orange-600 mt-1">{errors.nickname}</p>}
      </div>

      {/* Printer model */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
          Printer model *
        </label>
        <div className="relative">
          <select
            className={clsx(
              "w-full px-3 py-2 rounded-xl border text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition appearance-none cursor-pointer pr-8",
              errors.printerModel
                ? "border-orange-400 ring-2 ring-orange-200"
                : "border-slate-300 dark:border-slate-600"
            )}
            value={form.printerModel}
            onChange={(e) => setField("printerModel", e.target.value)}
          >
            <option value="">— Select printer —</option>
            {PRINTER_GROUPS.map((g) => (
              <optgroup key={g.group} label={g.group}>
                {g.models.map((m) => <option key={m} value={m}>{m}</option>)}
              </optgroup>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
        {errors.printerModel && <p className="text-xs text-orange-600 mt-1">{errors.printerModel}</p>}
      </div>

      {/* Nozzle diameter */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
          Nozzle diameter
        </label>
        <div className="flex gap-2">
          {([0.2, 0.4, 0.6, 0.8] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setField("nozzleDiameter", d)}
              className={clsx(
                "flex-1 py-2 rounded-xl border text-xs font-semibold transition-all",
                form.nozzleDiameter === d
                  ? "bg-primary-600 text-white border-primary-600"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-primary-400"
              )}
            >
              {d}mm
            </button>
          ))}
        </div>
      </div>

      {/* Bed surface */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
          Bed surface
        </label>
        <div className="relative">
          <select
            className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500 transition appearance-none cursor-pointer pr-8"
            value={form.bedSurface}
            onChange={(e) => setField("bedSurface", e.target.value)}
          >
            {BED_SURFACES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Set as default */}
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <div
          className={clsx(
            "w-4 h-4 rounded border flex items-center justify-center transition-all flex-shrink-0",
            form.isDefault
              ? "bg-primary-600 border-primary-600"
              : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
          )}
          onClick={() => setField("isDefault", !form.isDefault)}
        >
          {form.isDefault && <Check size={10} className="text-white" />}
        </div>
        <span className="text-xs text-slate-600 dark:text-slate-300">Set as default printer</span>
      </label>

      {/* Buttons */}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSubmit}
          className="flex-1 py-2 rounded-xl bg-primary-600 text-white text-xs font-semibold hover:bg-primary-700 transition-colors"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

// ─── Save Profile Dialog (used in InputForm after getting results) ─────────────

interface SaveProfileDialogProps {
  printerModel: string;
  nozzleDiameter: 0.2 | 0.4 | 0.6 | 0.8;
  bedSurface: string;
  onClose: () => void;
  onSaved: () => void;
}

export function SaveProfileDialog({
  printerModel,
  nozzleDiameter,
  bedSurface,
  onClose,
  onSaved,
}: SaveProfileDialogProps) {
  const [nickname, setNickname] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  function handleSave() {
    if (!nickname.trim()) {
      setError("Please enter a nickname for this profile");
      return;
    }
    addProfile({ nickname: nickname.trim(), printerModel, nozzleDiameter, bedSurface, isDefault });
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        ref={dialogRef}
        className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl p-5"
      >
        <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-1">Save This Setup</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Save <strong>{printerModel}</strong> with {nozzleDiameter}mm nozzle for quick re-use.
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nickname *
            </label>
            <input
              type="text"
              className={clsx(
                "w-full px-3 py-2 rounded-xl border text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 transition",
                error ? "border-orange-400 ring-2 ring-orange-200" : "border-slate-300 dark:border-slate-600"
              )}
              placeholder="e.g. My Ender 3"
              value={nickname}
              onChange={(e) => { setNickname(e.target.value); setError(""); }}
              maxLength={40}
              autoFocus
            />
            {error && <p className="text-xs text-orange-600 mt-1">{error}</p>}
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div
              className={clsx(
                "w-4 h-4 rounded border flex items-center justify-center transition-all flex-shrink-0",
                isDefault ? "bg-primary-600 border-primary-600" : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
              )}
              onClick={() => setIsDefault((v) => !v)}
            >
              {isDefault && <Check size={10} className="text-white" />}
            </div>
            <span className="text-xs text-slate-600 dark:text-slate-300">Set as default printer</span>
          </label>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex-1 py-2 rounded-xl bg-primary-600 text-white text-xs font-semibold hover:bg-primary-700 transition-colors"
            >
              Save Profile
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
