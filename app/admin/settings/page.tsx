"use client";

// ─── Admin settings page (/admin/settings) ────────────────────────────────────
//
// Protected by middleware cookie (pp_admin) set at /admin/login.
// No extra passphrase gate — the admin login is sufficient.
// Changes write to Vercel KV via PUT /api/admin/config and take effect
// immediately for all users on their next page load.

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import SpoolIcon from "@/components/SpoolIcon";
import {
  LogOut, ArrowLeft, Bug, Eye, EyeOff, Check, AlertTriangle,
  Cpu, Sliders, Flag, MessageSquare, Link, HardDrive, Save, Shield,
  Wifi, WifiOff, Package, Lightbulb, RotateCw,
} from "lucide-react";
import clsx from "clsx";
import EquipmentListManager from "@/components/admin/EquipmentListManager";
import EquipmentSuggestionsPanel from "@/components/admin/EquipmentSuggestionsPanel";

// ── Types (inline to avoid importing server-only lib/config.ts in client) ─────

interface AppConfig {
  betaKeyEnabled: boolean;
  betaKey: string;
  betaContactEmail: string;
  dailyFreeAnalyses: number;
  claudeModel: string;
  siteTagline: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  kofiUrl: string;
  makerWorldUrl: string;
  weatherWidgetEnabled: boolean;
  filamentDbEnabled: boolean;
  historyEnabled: boolean;
  shareCardEnabled: boolean;
  maxFileSizeMb: number;
  adminPassphrase: string;
}

type StorageTier = "kv" | "local-file";
type StorageMeta = { storage?: StorageTier; kvRequired?: boolean };

const CLAUDE_MODELS = [
  { id: "claude-3-5-haiku-20241022", label: "Haiku 3.5",  note: "Fastest, cheapest" },
  { id: "claude-sonnet-4-20250514",  label: "Sonnet 4",   note: "Balanced (recommended)" },
  { id: "claude-opus-4-20250514",    label: "Opus 4",     note: "Most capable, most expensive" },
];

// ── Small UI primitives ───────────────────────────────────────────────────────

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
      {children}
    </div>
  );
}

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h2 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-1 text-base">
      <span className="text-primary-600">{icon}</span>
      {children}
    </h2>
  );
}

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
      {children}
    </label>
  );
}

function FieldNote({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{children}</p>;
}

// Toggle switch
function Toggle({
  id, checked, onChange, label, description,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={clsx(
          "relative flex-shrink-0 w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 dark:focus:ring-offset-slate-900",
          checked ? "bg-primary-500" : "bg-slate-300 dark:bg-slate-600",
        )}
      >
        <span
          className={clsx(
            "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform",
            checked ? "translate-x-5" : "translate-x-0",
          )}
        />
      </button>
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{label}</p>
        {description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>}
      </div>
    </div>
  );
}

// Save-section button
function SaveButton({
  onClick, saving, label = "Save",
}: {
  onClick: () => void;
  saving: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={saving}
      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-colors disabled:opacity-60"
    >
      {saving
        ? <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
        : <Save size={14} />}
      {label}
    </button>
  );
}

// Toast notification
function Toast({ message, type }: { message: string; type: "success" | "error" }) {
  return (
    <div
      className={clsx(
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-xl text-sm font-semibold flex items-center gap-2 animate-slide-up",
        type === "success" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white",
      )}
    >
      {type === "success" ? <Check size={15} /> : <AlertTriangle size={15} />}
      {message}
    </div>
  );
}

// URL validation — warning only, never blocks saving
function isValidUrl(value: string): boolean {
  return value === "" || value.startsWith("http://") || value.startsWith("https://");
}

// ── Main settings page ────────────────────────────────────────────────────────

export default function AdminSettingsPage() {
  const router = useRouter();

  const [config,      setConfig]      = useState<AppConfig | null>(null);
  const [formState,   setFormState]   = useState<AppConfig | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [lastSaved,   setLastSaved]   = useState<string>("");
  const [storageTier,  setStorageTier]  = useState<StorageTier | null>(null);
  const [kvRequired,   setKvRequired]   = useState(false);
  const [toast,       setToast]       = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [saving,      setSaving]      = useState<string>("");
  const [showKey,     setShowKey]     = useState(false);

  // Equipment management state
  const [equipmentTab, setEquipmentTab] = useState<"printers" | "surfaces" | "nozzles">("printers");
  const [printers, setPrinters] = useState<any[]>([]);
  const [surfaces, setSurfaces] = useState<any[]>([]);
  const [nozzles, setNozzles] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  // ── Load config from API ──────────────────────────────────────────────────

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/config");
      if (res.status === 401) { router.push("/admin/login"); return; }
      if (!res.ok) { showToast("Failed to load config", "error"); return; }
      const data = await res.json() as AppConfig & StorageMeta;
      const { storage, kvRequired: kvReq, ...rest } = data;
      setStorageTier(storage ?? null);
      setKvRequired(kvReq ?? false);
      setConfig(rest as AppConfig);
      setFormState(rest as AppConfig);
    } catch {
      showToast("Failed to load config — check your connection", "error");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadConfig();
    loadEquipment();
  }, [loadConfig]);

  // ── Load equipment and suggestions ─────────────────────────────────────────

  const loadEquipment = useCallback(async () => {
    try {
      const [equipRes, suggestRes] = await Promise.all([
        fetch(`/api/equipment?ts=${Date.now()}`),
        fetch(`/api/admin/equipment-manage?type=suggestions&ts=${Date.now()}`),
      ]);

      if (equipRes.ok) {
        const equipData = await equipRes.json();
        setPrinters(equipData.printers || []);
        setSurfaces(equipData.surfaces || []);
        setNozzles(equipData.nozzles || []);
      }

      if (suggestRes.ok) {
        const suggestData = await suggestRes.json();
        setSuggestions(suggestData.suggestions || []);
      }
    } catch (error) {
      console.error("Failed to load equipment:", error);
    }
  }, []);

  // ── API save ──────────────────────────────────────────────────────────────

  async function apiSave(partial: Partial<AppConfig>, section: string): Promise<boolean> {
    setSaving(section);
    try {
      const res = await fetch("/api/admin/config", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(partial),
      });
      if (res.status === 401) { router.push("/admin/login"); return false; }
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" })) as { error: string };
        showToast(`Save failed: ${err.error}`, "error");
        return false;
      }
      const updated = await res.json() as AppConfig & StorageMeta;
      const { storage, kvRequired: kvReq, ...rest } = updated;
      setStorageTier(storage ?? null);
      setKvRequired(kvReq ?? false);
      setConfig(rest as AppConfig);
      setFormState(rest as AppConfig);
      setLastSaved(new Date().toLocaleTimeString());
      if (storage === "local-file") {
        showToast("Saved locally. Connect Vercel KV for global settings.", "success");
      } else {
        showToast("Settings saved — changes are live for all users.", "success");
      }
      return true;
    } catch {
      showToast("Save failed. Check your connection and try again.", "error");
      return false;
    } finally {
      setSaving("");
    }
  }

  // ── Field updater ─────────────────────────────────────────────────────────

  function set<K extends keyof AppConfig>(key: K, value: AppConfig[K]) {
    setFormState((prev) => prev ? { ...prev, [key]: value } : prev);
  }

  // ── Reset to defaults ─────────────────────────────────────────────────────

  async function handleReset() {
    if (!window.confirm("Reset ALL settings to defaults? This cannot be undone.")) return;
    await apiSave({
      betaKeyEnabled: true,
      betaKey: "PRINTPERFECTROCKS",
      betaContactEmail: "info@printperfect.app",
      dailyFreeAnalyses: 3,
      claudeModel: "claude-sonnet-4-20250514",
      siteTagline: "Get perfect 3D print settings in minutes",
      maintenanceMode: false,
      maintenanceMessage: "Print Perfect is undergoing maintenance. Check back soon!",
      kofiUrl: "https://ko-fi.com/printygoodstuff",
      makerWorldUrl: "https://makerworld.com/printperfect-placeholder",
      weatherWidgetEnabled: true,
      filamentDbEnabled: true,
      historyEnabled: true,
      shareCardEnabled: true,
      maxFileSizeMb: 50,
    }, "reset");
  }

  // ── Logout ────────────────────────────────────────────────────────────────

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  // ── Loading / error states ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-primary-200 border-t-primary-600 animate-spin" />
      </div>
    );
  }

  if (!formState || !config) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-4 text-center">
        <div>
          <p className="text-slate-500 dark:text-slate-400 mb-4">Failed to load settings.</p>
          <button onClick={() => loadConfig()} className="btn-primary">Try again</button>
        </div>
      </div>
    );
  }

  const f = formState;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">

      {/* Page header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-primary-600"><SpoolIcon className="w-6 h-6" /></span>
            <span className="font-bold text-slate-900 dark:text-slate-100">PrintPerfect</span>
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-400 px-2 py-0.5 rounded-full ml-1">Settings</span>
          </div>
          <div className="flex items-center gap-3">
            <a href="/admin" className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
              <ArrowLeft size={14} /> Admin
            </a>
            <a href="/admin/debug" className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
              <Bug size={14} /> Debug
            </a>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* Page title */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Admin Settings</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
              Changes take effect immediately for all users. No deployment required.
            </p>
            {lastSaved && (
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1">
                <Check size={11} className="text-emerald-500" /> Last saved: {lastSaved}
              </p>
            )}
            {/* Storage tier badge */}
            {storageTier === "kv" && (
              <span className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
                <Wifi size={11} /> Vercel KV connected — changes are global
              </span>
            )}
            {storageTier === "local-file" && kvRequired && (
              <div className="mt-2 space-y-1.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 text-xs font-semibold">
                  <WifiOff size={11} /> Vercel KV not connected — settings cannot be saved in production
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Go to your{" "}
                  <a href="https://vercel.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-primary-600 dark:text-primary-400 hover:underline font-medium">
                    Vercel project
                  </a>
                  {" "}→ Storage → Create Database → KV, then redeploy. See SETUP.md for details.
                </p>
              </div>
            )}
            {storageTier === "local-file" && !kvRequired && (
              <div className="mt-2 space-y-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-semibold">
                  <WifiOff size={11} /> Local file mode — changes apply to this environment only
                </span>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  To enable global settings in production, connect Vercel KV. See SETUP.md.
                </p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleReset}
            disabled={!!saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            Reset to defaults
          </button>
        </div>

        {/* ── SECTION 1: Beta Access Control ──────────────────────────────── */}
        <SectionCard>
          <SectionTitle icon={<Shield size={18} />}>Beta Access Control</SectionTitle>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
            Control who can access the site during private beta.
          </p>

          <div className="space-y-5">
            {/* Status badge */}
            <div>
              {f.betaKeyEnabled ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-semibold">
                  <Shield size={11} /> Site is in BETA — key required
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
                  <Check size={11} /> Site is OPEN — no key required
                </span>
              )}
            </div>

            <Toggle
              id="betaKeyEnabled"
              checked={f.betaKeyEnabled}
              onChange={(v) => set("betaKeyEnabled", v)}
              label="Require access key"
              description="When on, visitors must enter the beta key to use the app."
            />

            <div>
              <FieldLabel htmlFor="betaKey">Access key</FieldLabel>
              <div className="relative">
                <input
                  id="betaKey"
                  type={showKey ? "text" : "password"}
                  className="input pr-10 font-mono tracking-widest uppercase"
                  value={f.betaKey}
                  onChange={(e) => set("betaKey", e.target.value.toUpperCase())}
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  aria-label={showKey ? "Hide key" : "Show key"}
                >
                  {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <FieldNote>Case-insensitive. Share this with your beta testers.</FieldNote>
            </div>

            <div>
              <FieldLabel htmlFor="betaContactEmail">Contact email</FieldLabel>
              <input
                id="betaContactEmail"
                type="email"
                className="input"
                value={f.betaContactEmail}
                onChange={(e) => set("betaContactEmail", e.target.value)}
                placeholder="info@printperfect.app"
              />
              <FieldNote>Shown on the key prompt for users who don&apos;t have access.</FieldNote>
            </div>
          </div>

          <div className="mt-5 flex justify-end">
            <SaveButton
              onClick={() => apiSave({
                betaKeyEnabled:    f.betaKeyEnabled,
                betaKey:           f.betaKey,
                betaContactEmail:  f.betaContactEmail,
              }, "beta")}
              saving={saving === "beta"}
              label="Save Beta Settings"
            />
          </div>
        </SectionCard>

        {/* ── SECTION 2: AI Model ────────────────────────────────────────── */}
        <SectionCard>
          <SectionTitle icon={<Cpu size={18} />}>AI Model</SectionTitle>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
            The Claude model used for all analysis requests.
          </p>

          <div className="space-y-3">
            {CLAUDE_MODELS.map((m) => {
              const isActive = f.claudeModel === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => set("claudeModel", m.id)}
                  className={clsx(
                    "w-full text-left rounded-xl border p-4 transition-all",
                    isActive
                      ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20 ring-2 ring-primary-200 dark:ring-primary-800"
                      : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-primary-300 dark:hover:border-primary-700",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{m.label}</span>
                      <span className="text-slate-400 text-xs ml-2">— {m.note}</span>
                    </div>
                    {isActive && <Check size={16} className="text-primary-600 flex-shrink-0" />}
                  </div>
                  <p className="text-xs text-slate-400 font-mono mt-1">{m.id}</p>
                </button>
              );
            })}
          </div>

          {f.claudeModel.includes("opus") && (
            <div className="mt-4 flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <AlertTriangle size={15} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Opus is significantly more expensive per analysis. Use for testing only.
              </p>
            </div>
          )}

          <div className="mt-5 flex justify-end">
            <SaveButton
              onClick={() => apiSave({ claudeModel: f.claudeModel }, "model")}
              saving={saving === "model"}
              label="Save Model"
            />
          </div>
        </SectionCard>

        {/* ── SECTION 3: Rate Limiting ───────────────────────────────────── */}
        <SectionCard>
          <SectionTitle icon={<Sliders size={18} />}>Rate Limiting</SectionTitle>

          <div className="mt-4">
            <FieldLabel htmlFor="dailyFreeAnalyses">Free analyses per day per user</FieldLabel>
            <input
              id="dailyFreeAnalyses"
              type="number"
              min={1}
              max={20}
              step={1}
              className="input w-32"
              value={f.dailyFreeAnalyses}
              onChange={(e) => set("dailyFreeAnalyses", Number(e.target.value))}
            />
            <FieldNote>
              Currently {f.dailyFreeAnalyses}/day. Users see a tip prompt when they hit this limit.
            </FieldNote>
          </div>

          <div className="mt-5 flex justify-end">
            <SaveButton
              onClick={() => apiSave({ dailyFreeAnalyses: f.dailyFreeAnalyses }, "ratelimit")}
              saving={saving === "ratelimit"}
              label="Save Limit"
            />
          </div>
        </SectionCard>

        {/* ── SECTION 4: Feature Flags ───────────────────────────────────── */}
        <SectionCard>
          <SectionTitle icon={<Flag size={18} />}>Feature Flags</SectionTitle>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
            Toggle individual features on or off for all users instantly.
          </p>

          <div className="space-y-5">
            <Toggle
              id="weatherWidgetEnabled"
              checked={f.weatherWidgetEnabled}
              onChange={(v) => set("weatherWidgetEnabled", v)}
              label="Live weather widget"
              description="Auto-detects user humidity from their location via Open-Meteo API."
            />
            <Toggle
              id="filamentDbEnabled"
              checked={f.filamentDbEnabled}
              onChange={(v) => set("filamentDbEnabled", v)}
              label="Open Filament Database integration"
              description="Shows real manufacturer filament specs when users enter a brand name."
            />
            <Toggle
              id="historyEnabled"
              checked={f.historyEnabled}
              onChange={(v) => set("historyEnabled", v)}
              label="Print history (/history page)"
              description="Lets users save and review their last 5 analyses."
            />
            <Toggle
              id="shareCardEnabled"
              checked={f.shareCardEnabled}
              onChange={(v) => set("shareCardEnabled", v)}
              label="Share card feature"
              description="Lets users download a branded PNG summary of their results."
            />
          </div>

          <div className="mt-5 flex justify-end">
            <SaveButton
              onClick={() => apiSave({
                weatherWidgetEnabled: f.weatherWidgetEnabled,
                filamentDbEnabled:    f.filamentDbEnabled,
                historyEnabled:       f.historyEnabled,
                shareCardEnabled:     f.shareCardEnabled,
              }, "flags")}
              saving={saving === "flags"}
              label="Save Feature Flags"
            />
          </div>
        </SectionCard>

        {/* ── SECTION 5: Site Messaging ──────────────────────────────────── */}
        <SectionCard>
          <SectionTitle icon={<MessageSquare size={18} />}>Site Messaging</SectionTitle>

          <div className="space-y-5 mt-4">
            <div>
              <FieldLabel htmlFor="siteTagline">Site tagline</FieldLabel>
              <input
                id="siteTagline"
                type="text"
                className="input"
                value={f.siteTagline}
                maxLength={80}
                onChange={(e) => set("siteTagline", e.target.value.slice(0, 80))}
                placeholder="Get perfect 3D print settings in minutes"
              />
              <FieldNote>{f.siteTagline.length}/80 characters — shown in the header.</FieldNote>
            </div>

            <div>
              <FieldLabel htmlFor="maintenanceMessage">Maintenance message</FieldLabel>
              <textarea
                id="maintenanceMessage"
                className="input min-h-[80px] resize-y"
                value={f.maintenanceMessage}
                onChange={(e) => set("maintenanceMessage", e.target.value)}
                placeholder="Print Perfect is undergoing maintenance. Check back soon!"
              />
              <FieldNote>Shown to all users when maintenance mode is active.</FieldNote>
            </div>

            {/* Maintenance mode — large and prominent */}
            <div className={clsx(
              "rounded-xl border-2 p-4 transition-colors",
              f.maintenanceMode
                ? "border-rose-400 dark:border-rose-600 bg-rose-50 dark:bg-rose-900/20"
                : "border-slate-200 dark:border-slate-700",
            )}>
              {f.maintenanceMode && (
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle size={16} className="text-rose-600 dark:text-rose-400" />
                  <span className="text-sm font-bold text-rose-700 dark:text-rose-400">
                    MAINTENANCE MODE ACTIVE — site is down for all users
                  </span>
                </div>
              )}
              <Toggle
                id="maintenanceMode"
                checked={f.maintenanceMode}
                onChange={(v) => {
                  if (v && !window.confirm(
                    "This will show a maintenance page to ALL users immediately. Are you sure?"
                  )) return;
                  set("maintenanceMode", v);
                }}
                label={f.maintenanceMode ? "⚠️ Maintenance mode is ON" : "Maintenance mode"}
                description={f.maintenanceMode
                  ? "Turn this off to restore the site."
                  : "When on, all visitors see the maintenance message instead of the app."}
              />
            </div>
          </div>

          <div className="mt-5 flex justify-end">
            <SaveButton
              onClick={() => apiSave({
                siteTagline:        f.siteTagline,
                maintenanceMessage: f.maintenanceMessage,
                maintenanceMode:    f.maintenanceMode,
              }, "messaging")}
              saving={saving === "messaging"}
              label="Save Messaging"
            />
          </div>
        </SectionCard>

        {/* ── SECTION 6: Links & URLs ────────────────────────────────────── */}
        <SectionCard>
          <SectionTitle icon={<Link size={18} />}>Links &amp; URLs</SectionTitle>

          <div className="space-y-5 mt-4">
            <div>
              <FieldLabel htmlFor="kofiUrl">Ko-fi URL</FieldLabel>
              <input
                id="kofiUrl"
                type="url"
                className="input"
                value={f.kofiUrl}
                onChange={(e) => set("kofiUrl", e.target.value)}
                placeholder="https://ko-fi.com/your-page"
              />
              {!isValidUrl(f.kofiUrl) && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                  <AlertTriangle size={11} /> Please enter a full URL starting with https://
                </p>
              )}
              <FieldNote>Paste your full Ko-fi page URL including https:// — drives the tip jar button on the results page.</FieldNote>
            </div>

            <div>
              <FieldLabel htmlFor="makerWorldUrl">MakerWorld URL</FieldLabel>
              <input
                id="makerWorldUrl"
                type="url"
                className="input"
                value={f.makerWorldUrl}
                onChange={(e) => set("makerWorldUrl", e.target.value)}
                placeholder="https://makerworld.com/en/u/your-profile"
              />
              {!isValidUrl(f.makerWorldUrl) && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                  <AlertTriangle size={11} /> Please enter a full URL starting with https://
                </p>
              )}
              <FieldNote>Paste your full MakerWorld profile URL including https:// — drives the tip jar button on the results page.</FieldNote>
            </div>
          </div>

          <div className="mt-5 flex justify-end">
            <SaveButton
              onClick={() => apiSave({ kofiUrl: f.kofiUrl, makerWorldUrl: f.makerWorldUrl }, "links")}
              saving={saving === "links"}
              label="Save URLs"
            />
          </div>
        </SectionCard>

        {/* ── SECTION 7: Limits ─────────────────────────────────────────── */}
        <SectionCard>
          <SectionTitle icon={<HardDrive size={18} />}>Limits</SectionTitle>

          <div className="mt-4">
            <FieldLabel htmlFor="maxFileSizeMb">Max file size (MB)</FieldLabel>
            <input
              id="maxFileSizeMb"
              type="number"
              min={1}
              max={200}
              step={1}
              className="input w-32"
              value={f.maxFileSizeMb}
              onChange={(e) => set("maxFileSizeMb", Number(e.target.value))}
            />
            <FieldNote>Files larger than this are rejected at upload. Default: 50 MB.</FieldNote>
          </div>

          <div className="mt-5 flex justify-end">
            <SaveButton
              onClick={() => apiSave({ maxFileSizeMb: f.maxFileSizeMb }, "limits")}
              saving={saving === "limits"}
              label="Save Limits"
            />
          </div>
        </SectionCard>

        <SectionCard>
          <div className="flex items-center justify-between mb-4">
            <SectionTitle icon={<Package size={18} />}>Equipment Lists</SectionTitle>
            <button
              onClick={() => loadEquipment()}
              className="p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              title="Refresh equipment lists"
            >
              <RotateCw size={16} className="text-slate-600 dark:text-slate-400" />
            </button>
          </div>

          {/* Equipment type tabs */}
          <div className="flex gap-2 mb-4 border-b border-slate-300 dark:border-slate-700">
            {(["printers", "surfaces", "nozzles"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setEquipmentTab(tab)}
                className={clsx(
                  "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-1",
                  equipmentTab === tab
                    ? "text-primary-600 dark:text-primary-400 border-primary-600 dark:border-primary-400"
                    : "text-slate-600 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-slate-200"
                )}
              >
                {tab === "printers" ? "Printers" : tab === "surfaces" ? "Surfaces" : "Nozzles"}
              </button>
            ))}
          </div>

          {/* Equipment list manager */}
          {equipmentTab === "printers" && (
            <EquipmentListManager
              type="printers"
              equipment={printers}
              onRefresh={loadEquipment}
            />
          )}
          {equipmentTab === "surfaces" && (
            <EquipmentListManager
              type="surfaces"
              equipment={surfaces}
              onRefresh={loadEquipment}
            />
          )}
          {equipmentTab === "nozzles" && (
            <EquipmentListManager
              type="nozzles"
              equipment={nozzles}
              onRefresh={loadEquipment}
            />
          )}
        </SectionCard>

        <SectionCard>
          <SectionTitle icon={<Lightbulb size={18} />}>Equipment Suggestions</SectionTitle>
          <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
            Review user suggestions and manually add approved items to the equipment lists above.
          </p>
          <EquipmentSuggestionsPanel
            suggestions={suggestions}
            onRefresh={loadEquipment}
          />
        </SectionCard>

        {/* ── Save all button ────────────────────────────────────────────── */}
        <div className="flex justify-end pb-4">
          <button
            type="button"
            onClick={() => {
              const { adminPassphrase: _, ...rest } = f;
              void apiSave(rest, "all");
            }}
            disabled={!!saving}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold text-sm transition-colors disabled:opacity-60 shadow-lg"
          >
            {saving === "all"
              ? <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              : <Save size={16} />}
            Save all settings
          </button>
        </div>

      </div>

      {/* Toast notifications */}
      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
