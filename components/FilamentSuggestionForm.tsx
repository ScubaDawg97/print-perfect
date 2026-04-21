"use client";

import { useState } from "react";
import clsx from "clsx";

/**
 * ─── FilamentSuggestionForm Component ──────────────────────────────────────────
 * Inline form for capturing custom filament details.
 * Expands when user selects "Other / Custom Filament" in dropdown.
 */

export interface FilamentSuggestionFormData {
  displayName: string;
  userDescription: string;
  characteristics?: string;
}

export interface FilamentSuggestionFormProps {
  isExpanded: boolean;
  onSubmit: (data: FilamentSuggestionFormData) => void;
  onCancel: () => void;
}

export default function FilamentSuggestionForm({
  isExpanded,
  onSubmit,
  onCancel,
}: FilamentSuggestionFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [characteristics, setCharacteristics] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Filament name is required";
    if (!description.trim()) e.description = "Description is required";
    if (description.trim().length < 5) e.description = "Description must be at least 5 characters";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    onSubmit({
      displayName: name.trim(),
      userDescription: description.trim(),
      characteristics: characteristics.trim() || undefined,
    });
    // Reset form
    setName("");
    setDescription("");
    setCharacteristics("");
    setErrors({});
  };

  const handleCancel = () => {
    setName("");
    setDescription("");
    setCharacteristics("");
    setErrors({});
    onCancel();
  };

  if (!isExpanded) return null;

  return (
    <div
      className={clsx(
        "overflow-hidden transition-all duration-300 ease-in-out",
        isExpanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
      )}
    >
      <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-xl p-4 space-y-3">
        {/* Filament name */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Filament name *
          </label>
          <input
            type="text"
            className={clsx(
              "w-full px-3 py-2 rounded-lg border text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 transition",
              errors.name
                ? "border-orange-400 ring-2 ring-orange-200"
                : "border-slate-300 dark:border-slate-600"
            )}
            placeholder="e.g., PETG HF, ASA Pro, PLA Ultra"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errors.name) setErrors((prev) => { const e = { ...prev }; delete e.name; return e; });
            }}
            maxLength={100}
          />
          {errors.name && <p className="text-xs text-orange-600 mt-1">{errors.name}</p>}
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Description *
          </label>
          <textarea
            className={clsx(
              "w-full px-3 py-2 rounded-lg border text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 transition resize-none",
              errors.description
                ? "border-orange-400 ring-2 ring-orange-200"
                : "border-slate-300 dark:border-slate-600"
            )}
            placeholder="What is this filament? What makes it different? (min 5 characters)"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              if (errors.description) setErrors((prev) => { const e = { ...prev }; delete e.description; return e; });
            }}
            maxLength={500}
            rows={3}
          />
          {errors.description && <p className="text-xs text-orange-600 mt-1">{errors.description}</p>}
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{description.length}/500</p>
        </div>

        {/* Characteristics (optional) */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Additional characteristics <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <textarea
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 transition resize-none"
            placeholder="E.g., Temperature range, print speed, special properties…"
            value={characteristics}
            onChange={(e) => setCharacteristics(e.target.value)}
            maxLength={500}
            rows={2}
          />
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{characteristics.length}/500</p>
        </div>

        {/* Buttons */}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={handleCancel}
            className="flex-1 py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!name.trim() || !description.trim() || description.trim().length < 5}
            className={clsx(
              "flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-colors",
              !name.trim() || !description.trim() || description.trim().length < 5
                ? "bg-slate-400 text-white cursor-not-allowed"
                : "bg-primary-600 text-white hover:bg-primary-700"
            )}
          >
            Submit Suggestion
          </button>
        </div>
      </div>
    </div>
  );
}
