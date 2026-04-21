"use client";

import { useState } from "react";
import { Plus, Trash2, Edit2, Check, X } from "lucide-react";
import clsx from "clsx";
import type { FilamentType } from "@/lib/filamentSchemas";

/**
 * ─── FilamentListManager Component ────────────────────────────────────────────
 * Admin panel for managing filament types.
 * Allows create, edit, soft-delete operations.
 */

export interface FilamentListManagerProps {
  filaments: FilamentType[];
  onUpdate: () => void;
}

export default function FilamentListManager({
  filaments,
  onUpdate,
}: FilamentListManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName] = useState("");
  const [addDesc, setAddDesc] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const activeFilaments = filaments.filter((f) => f.active);
  const deactivatedFilaments = filaments.filter((f) => !f.active);

  const handleAddFilament = async () => {
    if (!addName.trim() || !addDesc.trim()) {
      setError("Name and description are required");
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/filament-manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: addName.trim(),
          description: addDesc.trim(),
        }),
      });

      if (response.ok) {
        setAddName("");
        setAddDesc("");
        setShowAddForm(false);
        onUpdate();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to add filament");
      }
    } catch (err) {
      setError("Network error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateFilament = async (id: string) => {
    if (!editName.trim() || !editDesc.trim()) {
      setError("Name and description are required");
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/filament-manage?id=${id}&action=update`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            displayName: editName.trim(),
            description: editDesc.trim(),
          }),
        }
      );

      if (response.ok) {
        setEditingId(null);
        onUpdate();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to update filament");
      }
    } catch (err) {
      setError("Network error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteFilament = async (id: string) => {
    if (!confirm("Soft delete this filament? (it will be hidden but not removed)")) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/filament-manage?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        onUpdate();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to delete filament");
      }
    } catch (err) {
      setError("Network error");
    } finally {
      setIsLoading(false);
    }
  };

  const startEdit = (filament: FilamentType) => {
    setEditingId(filament.id);
    setEditName(filament.displayName);
    setEditDesc(filament.description);
    setError("");
  };

  return (
    <div className="space-y-4">
      {/* Add form */}
      {showAddForm ? (
        <div className="border border-primary-300 dark:border-primary-700 rounded-lg p-4 bg-primary-50 dark:bg-primary-900/20">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
            <Plus size={16} /> Add New Filament
          </h3>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Filament name (e.g., PETG HF)"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              maxLength={100}
            />
            <textarea
              placeholder="Description"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 resize-none"
              value={addDesc}
              onChange={(e) => setAddDesc(e.target.value)}
              rows={2}
              maxLength={500}
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => setShowAddForm(false)}
                className="flex-1 py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleAddFilament}
                disabled={isLoading}
                className="flex-1 py-2 px-3 rounded-lg bg-primary-600 text-white text-xs font-semibold hover:bg-primary-700 disabled:bg-slate-400"
              >
                {isLoading ? "Adding..." : "Add Filament"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-600 text-white text-xs font-semibold hover:bg-primary-700"
        >
          <Plus size={14} /> Add Filament
        </button>
      )}

      {/* Active filaments */}
      <div>
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-2">
          Active Filaments ({activeFilaments.length})
        </h3>
        <div className="space-y-2">
          {activeFilaments.map((filament) => (
            <div
              key={filament.id}
              className={clsx(
                "border rounded-lg p-3 transition-all",
                editingId === filament.id
                  ? "border-primary-400 bg-primary-50 dark:bg-primary-900/20"
                  : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              )}
            >
              {editingId === filament.id ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-2 py-1 rounded text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                    maxLength={100}
                  />
                  <textarea
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="w-full px-2 py-1 rounded text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 resize-none"
                    rows={2}
                    maxLength={500}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingId(null)}
                      className="flex-1 py-1 px-2 rounded text-xs border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleUpdateFilament(filament.id)}
                      disabled={isLoading}
                      className="flex-1 py-1 px-2 rounded text-xs bg-primary-600 text-white hover:bg-primary-700 disabled:bg-slate-400"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-slate-800 dark:text-slate-100">
                      {filament.displayName}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                      {filament.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => startEdit(filament)}
                      className="p-1.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                      title="Edit"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteFilament(filament.id)}
                      className="p-1.5 rounded text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Deactivated filaments */}
      {deactivatedFilaments.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">
            Deactivated ({deactivatedFilaments.length})
          </h3>
          <div className="space-y-2 opacity-60">
            {deactivatedFilaments.map((filament) => (
              <div
                key={filament.id}
                className="border border-slate-300 dark:border-slate-600 rounded-lg p-3 bg-slate-50 dark:bg-slate-800/50"
              >
                <p className="font-semibold text-sm text-slate-700 dark:text-slate-300 line-through">
                  {filament.displayName}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
