"use client";

import { useState, useEffect } from "react";
import { Trash2, Plus, Edit2, Loader2 } from "lucide-react";
import clsx from "clsx";

interface Equipment {
  id: string;
  displayName?: string;
  vendorName?: string;
  modelName?: string;
  group?: string;
  active?: boolean;
  description?: string;
  material?: string;
  diameterMm?: number;
  type?: string;
}

interface EquipmentListManagerProps {
  type: "printers" | "surfaces" | "nozzles";
  equipment: Equipment[];
  onRefresh: () => void;
}

export default function EquipmentListManager({
  type,
  equipment,
  onRefresh,
}: EquipmentListManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newGroup, setNewGroup] = useState("");
  const [newMaxBedTemp, setNewMaxBedTemp] = useState("110");
  const [newMaxNozzleTemp, setNewMaxNozzleTemp] = useState("300");
  const [newDiameter, setNewDiameter] = useState("0.4");
  const [newMaterial, setNewMaterial] = useState("brass");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const typeLabel =
    type === "printers"
      ? "Printer"
      : type === "surfaces"
      ? "Bed Surface"
      : "Nozzle";

  const activeCount = equipment.filter((e) => e.active !== false).length;
  const inactiveCount = equipment.filter((e) => e.active === false).length;

  const handleAdd = async () => {
    if (!newName.trim()) {
      setMessage({ type: "error", text: "Name is required" });
      return;
    }

    setIsSubmitting(true);
    try {
      // Build equipment object based on type
      let equipmentData: any = {
        id: crypto.randomUUID(),
        active: true,
      };

      if (type === "printers") {
        // For printers: split name into vendor and model, or use as model
        const parts = newName.trim().split(" ");
        const vendor = newGroup.trim() || (parts.length > 1 ? parts[0] : "Custom");
        const model = newName.trim();
        equipmentData = {
          ...equipmentData,
          vendorName: vendor,
          modelName: model,
          group: vendor,
          maxBedTempC: parseInt(newMaxBedTemp) || 110,
          maxNozzleTempC: parseInt(newMaxNozzleTemp) || 300,
          isEnclosed: false,
          isDirectDrive: false,
        };
      } else if (type === "surfaces") {
        equipmentData = {
          ...equipmentData,
          displayName: newName.trim(),
          description: newGroup.trim() || "",
        };
      } else if (type === "nozzles") {
        equipmentData = {
          ...equipmentData,
          diameterMm: parseFloat(newDiameter) || 0.4,
          material: newMaterial || "brass",
          type: newGroup.trim() || "standard",
        };
      }

      const res = await fetch("/api/admin/equipment-manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          data: equipmentData,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: `Added ${typeLabel}` });
        setNewName("");
        setNewGroup("");
        setNewMaxBedTemp("110");
        setNewMaxNozzleTemp("300");
        setNewDiameter("0.4");
        setNewMaterial("brass");
        setIsAdding(false);
        onRefresh();
      } else {
        setMessage({ type: "error", text: data.message || "Failed to add equipment" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`Delete this ${typeLabel.toLowerCase()}?`)) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/admin/equipment-manage?type=${type}&id=${id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: `Deleted ${typeLabel}` });
        onRefresh();
      } else {
        setMessage({ type: "error", text: data.message || "Failed to delete" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {activeCount} active {activeCount === 1 ? "item" : "items"}
          {inactiveCount > 0 && `, ${inactiveCount} inactive`}
        </div>
        <button
          onClick={() => {
            setIsAdding(!isAdding);
            setNewName("");
            setNewGroup("");
            setNewMaxBedTemp("110");
            setNewMaxNozzleTemp("300");
            setNewDiameter("0.4");
            setNewMaterial("brass");
            setMessage(null);
          }}
          disabled={isSubmitting}
          className="flex items-center gap-1 px-3 py-1.5 text-xs rounded bg-primary-600 hover:bg-primary-700 text-white transition-colors disabled:opacity-50"
        >
          <Plus size={14} /> Add
        </button>
      </div>

      {/* Add form */}
      {isAdding && (
        <div className="bg-slate-100 dark:bg-slate-800 rounded border border-slate-300 dark:border-slate-700 p-3 space-y-2">
          <input
            type="text"
            placeholder={
              type === "printers"
                ? "e.g., Bambu Lab H2C, Creality Ender 3 V3"
                : type === "surfaces"
                ? "e.g., PEI Textured, Glass"
                : "e.g., Brass, Hardened Steel"
            }
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full px-2 py-1 text-sm rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            disabled={isSubmitting}
          />
          {type === "printers" && (
            <>
              <input
                type="text"
                placeholder="Vendor (e.g., Bambu Lab, Creality) - optional"
                value={newGroup}
                onChange={(e) => setNewGroup(e.target.value)}
                className="w-full px-2 py-1 text-sm rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                disabled={isSubmitting}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="Max Bed Temp (°C)"
                  value={newMaxBedTemp}
                  onChange={(e) => setNewMaxBedTemp(e.target.value)}
                  className="px-2 py-1 text-sm rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  disabled={isSubmitting}
                />
                <input
                  type="number"
                  placeholder="Max Nozzle Temp (°C)"
                  value={newMaxNozzleTemp}
                  onChange={(e) => setNewMaxNozzleTemp(e.target.value)}
                  className="px-2 py-1 text-sm rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  disabled={isSubmitting}
                />
              </div>
            </>
          )}
          {type === "surfaces" && (
            <input
              type="text"
              placeholder="Description (optional)"
              value={newGroup}
              onChange={(e) => setNewGroup(e.target.value)}
              className="w-full px-2 py-1 text-sm rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              disabled={isSubmitting}
            />
          )}
          {type === "nozzles" && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  step="0.1"
                  placeholder="Diameter (mm)"
                  value={newDiameter}
                  onChange={(e) => setNewDiameter(e.target.value)}
                  className="px-2 py-1 text-sm rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  disabled={isSubmitting}
                />
                <select
                  value={newMaterial}
                  onChange={(e) => setNewMaterial(e.target.value)}
                  className="px-2 py-1 text-sm rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  disabled={isSubmitting}
                >
                  <option value="brass">Brass</option>
                  <option value="hardened_steel">Hardened Steel</option>
                  <option value="stainless_steel">Stainless Steel</option>
                  <option value="ruby_tipped">Ruby Tipped</option>
                  <option value="tungsten_carbide">Tungsten Carbide</option>
                  <option value="copper_plated">Copper Plated</option>
                </select>
              </div>
              <select
                value={newGroup}
                onChange={(e) => setNewGroup(e.target.value)}
                className="w-full px-2 py-1 text-sm rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                disabled={isSubmitting}
              >
                <option value="standard">Standard</option>
                <option value="cht">CHT</option>
                <option value="volcano">Volcano</option>
                <option value="induction">Induction</option>
                <option value="quick_swap">Quick Swap</option>
              </select>
            </>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={isSubmitting}
              className="flex-1 px-2 py-1.5 text-xs rounded bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
            >
              {isSubmitting ? <Loader2 size={12} className="animate-spin" /> : "Save"}
            </button>
            <button
              onClick={() => setIsAdding(false)}
              disabled={isSubmitting}
              className="flex-1 px-2 py-1.5 text-xs rounded bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Message */}
      {message && (
        <div
          className={clsx(
            "text-xs p-2 rounded",
            message.type === "success"
              ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
              : "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300"
          )}
        >
          {message.text}
        </div>
      )}

      {/* Equipment list */}
      <div className="border border-slate-300 dark:border-slate-700 rounded divide-y divide-slate-300 dark:divide-slate-700 max-h-64 overflow-y-auto">
        {equipment.length === 0 ? (
          <div className="p-3 text-xs text-slate-500 dark:text-slate-400 text-center">
            No {type} yet
          </div>
        ) : (
          [...equipment].sort((a, b) => (a.group || "").localeCompare(b.group || "")).map((item) => {
            let titleText = "Unknown";
            let detailText = "";

            if (type === "printers") {
              // Show: "Model (Vendor)"
              const model = item.modelName || "Unknown";
              const vendor = item.vendorName ? ` (${item.vendorName})` : "";
              titleText = model + vendor;
              detailText = item.group && item.group !== item.vendorName ? item.group : "";
            } else if (type === "surfaces") {
              // Show: "Display Name" with description as detail
              titleText = item.displayName || "Unknown";
              detailText = item.description || "";
            } else if (type === "nozzles") {
              // Show: "Material - Diameter" with type as detail
              const material = item.material?.replace(/_/g, " ") || "Unknown";
              const diameter = item.diameterMm ? `${item.diameterMm}mm` : "";
              titleText = `${material}${diameter ? ` - ${diameter}` : ""}`;
              detailText = item.type ? item.type.toUpperCase() : "";
            }

            return (
              <div
                key={item.id}
                className={clsx(
                  "p-3 flex items-center justify-between text-xs",
                  item.active === false && "opacity-60 bg-slate-50 dark:bg-slate-800/50"
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                    {titleText}
                  </div>
                  {detailText && (
                    <div className="text-slate-500 dark:text-slate-400 text-xs truncate">
                      {detailText}
                    </div>
                  )}
                  {item.active === false && (
                    <div className="text-xs text-amber-600 dark:text-amber-400">Deactivated</div>
                  )}
                </div>
                <div className="flex gap-1 ml-2 flex-shrink-0">
                  <button
                    onClick={() => handleDelete(item.id)}
                    disabled={isSubmitting}
                    className="p-1.5 rounded bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 hover:bg-rose-200 dark:hover:bg-rose-900/50 transition-colors disabled:opacity-50"
                    title="Delete"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
