"use client";

import { useState, useEffect } from "react";
import { AlertCircle } from "lucide-react";
import clsx from "clsx";

/**
 * ─── OtherEquipmentForm Component ─────────────────────────────────────────────
 * Inline expandable form for capturing custom equipment details.
 * Shows when user selects "Other / Not Listed" option in SearchableSelect.
 *
 * Features:
 * - Smooth expand/collapse animation
 * - Real-time validation
 * - Error messages
 * - Clear error on field change
 */

export interface OtherEquipmentFormData {
  equipmentType: "printer" | "surface" | "nozzle";
  name: string;
  description: string;
  characteristics?: string;
}

export interface OtherEquipmentFormProps {
  equipmentType: "printer" | "surface" | "nozzle";
  isExpanded: boolean;
  onSubmit: (data: OtherEquipmentFormData) => void;
  onCancel?: () => void;
  disabled?: boolean;
}

export default function OtherEquipmentForm({
  equipmentType,
  isExpanded,
  onSubmit,
  onCancel,
  disabled = false,
}: OtherEquipmentFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [characteristics, setCharacteristics] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Clear errors when field changes
  const clearError = (field: string) => {
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleNameChange = (value: string) => {
    setName(value.slice(0, 100)); // Max 100 chars
    clearError("name");
  };

  const handleDescriptionChange = (value: string) => {
    setDescription(value.slice(0, 500)); // Max 500 chars
    clearError("description");
  };

  const handleCharacteristicsChange = (value: string) => {
    setCharacteristics(value.slice(0, 500)); // Max 500 chars
    clearError("characteristics");
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = "Name is required";
    } else if (name.length < 1) {
      newErrors.name = "Name must be at least 1 character";
    }

    if (!description.trim()) {
      newErrors.description = "Description is required";
    } else if (description.length < 5) {
      newErrors.description = "Description must be at least 5 characters";
    } else if (description.length > 500) {
      newErrors.description = "Description must be 500 characters or less";
    }

    if (characteristics && characteristics.length > 500) {
      newErrors.characteristics = "Characteristics must be 500 characters or less";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) {
      return;
    }

    onSubmit({
      equipmentType,
      name: name.trim(),
      description: description.trim(),
      characteristics: characteristics.trim() || undefined,
    });
  };

  const handleCancel = () => {
    setName("");
    setDescription("");
    setCharacteristics("");
    setErrors({});
    onCancel?.();
  };

  const isFormValid = name.trim() && description.trim() && description.length >= 5;
  const typeLabel =
    equipmentType === "printer"
      ? "Printer"
      : equipmentType === "surface"
      ? "Surface"
      : "Nozzle";

  return (
    <div
      className={clsx(
        "overflow-y-auto transition-all duration-300 ease-in-out",
        isExpanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
      )}
    >
      <div className="card p-4 border-t-2 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 space-y-3">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-amber-600 dark:text-amber-400">💡</span>
          <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            Help us improve (optional)
          </h3>
        </div>

        {/* Explanation text */}
        <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
          You can proceed with "{typeLabel}" selected and get recommendations. If you'd like to help us add your specific {typeLabel.toLowerCase()} to the database, fill in the details below and hit "Share Suggestion".
        </p>

        {/* Name field */}
        <div>
          <label className="block text-xs font-semibold text-amber-900 dark:text-amber-100 mb-1">
            Name <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            maxLength={100}
            placeholder={`e.g., "Custom ${typeLabel}"`}
            disabled={disabled}
            className={clsx(
              "w-full px-2.5 py-1.5 rounded border text-sm transition-colors",
              errors.name
                ? "border-red-500 dark:border-red-600 bg-red-50 dark:bg-red-900/20"
                : "border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          />
          {errors.name && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
              <AlertCircle size={12} />
              {errors.name}
            </p>
          )}
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
            {name.length}/100 characters
          </p>
        </div>

        {/* Description field */}
        <div>
          <label className="block text-xs font-semibold text-amber-900 dark:text-amber-100 mb-1">
            Description <span className="text-red-600">*</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => handleDescriptionChange(e.target.value)}
            maxLength={500}
            placeholder={
              equipmentType === "surface"
                ? "e.g., Glass, PEI, BuildTak, magnetic sheet, textured aluminum, etc."
                : `Describe your ${typeLabel.toLowerCase()} (brand, model, features, etc.)`
            }
            disabled={disabled}
            rows={3}
            className={clsx(
              "w-full px-2.5 py-1.5 rounded border text-sm resize-none transition-colors",
              errors.description
                ? "border-red-500 dark:border-red-600 bg-red-50 dark:bg-red-900/20"
                : "border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          />
          {errors.description && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
              <AlertCircle size={12} />
              {errors.description}
            </p>
          )}
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
            {description.length}/500 characters (min 5)
          </p>
        </div>

        {/* Characteristics field (optional) */}
        <div>
          <label className="block text-xs font-semibold text-amber-900 dark:text-amber-100 mb-1">
            Characteristics (optional)
          </label>
          <textarea
            value={characteristics}
            onChange={(e) => handleCharacteristicsChange(e.target.value)}
            maxLength={500}
            placeholder={
              equipmentType === "surface"
                ? ""
                : `Any special characteristics? (enclosed, direct drive, temperature ratings, etc.)`
            }
            disabled={disabled}
            rows={2}
            className={clsx(
              "w-full px-2.5 py-1.5 rounded border text-sm resize-none transition-colors",
              errors.characteristics
                ? "border-red-500 dark:border-red-600 bg-red-50 dark:bg-red-900/20"
                : "border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          />
          {errors.characteristics && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
              <AlertCircle size={12} />
              {errors.characteristics}
            </p>
          )}
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
            {characteristics.length}/500 characters
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isFormValid || disabled}
            className={clsx(
              "flex-1 py-2 rounded font-medium text-sm transition-colors",
              isFormValid && !disabled
                ? "bg-amber-600 hover:bg-amber-700 text-white"
                : "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed"
            )}
          >
            Share Suggestion
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={disabled}
              className={clsx(
                "flex-1 py-2 rounded font-medium text-sm transition-colors",
                !disabled
                  ? "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
                  : "opacity-50 cursor-not-allowed"
              )}
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
