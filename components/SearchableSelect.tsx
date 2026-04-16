"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import clsx from "clsx";

/**
 * ─── SearchableSelect Component ────────────────────────────────────────────────
 * Custom combobox with filtering, grouping, keyboard navigation, and search highlighting.
 * Never filters out "Other" option — always visible regardless of search text.
 *
 * Supports two modes:
 * 1. Flat list: items array only
 * 2. Grouped list: groups array with items per group
 */

export interface SearchableSelectItem {
  id: string;
  displayName?: string;
  label?: string;
  group?: string;
}

interface Group<T extends SearchableSelectItem> {
  name: string;
  items: T[];
}

export interface SearchableSelectProps<T extends SearchableSelectItem> {
  items?: T[];
  groups?: Group<T>[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  alwaysShowOther?: boolean; // if true, "Other" option always visible even when searching
}

export default function SearchableSelect<T extends SearchableSelectItem>({
  items,
  groups,
  value,
  onChange,
  placeholder = "Select...",
  disabled = false,
  className,
  alwaysShowOther = true,
}: SearchableSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Determine if we're in grouped or flat mode
  const isGrouped = !!groups && groups.length > 0;

  // Get display label for selected value
  const getDisplayLabel = useCallback((): string => {
    if (isGrouped && groups) {
      for (const group of groups) {
        const item = group.items.find((i) => i.id === value);
        if (item) {
          return item.displayName || item.label || item.id;
        }
      }
    } else if (items) {
      const item = items.find((i) => i.id === value);
      if (item) {
        return item.displayName || item.label || item.id;
      }
    }
    return placeholder;
  }, [value, items, groups, placeholder, isGrouped]);

  // Filter items based on search text
  const getFilteredItems = useCallback((): (T | Group<T>)[] => {
    const searchLower = searchText.toLowerCase();
    if (!searchLower) {
      return isGrouped ? (groups || []) : (items || []);
    }

    if (isGrouped && groups) {
      return groups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => {
            const label = (item.displayName || item.label || item.id).toLowerCase();
            const isOther = label.includes("other");
            // Always show "Other" if alwaysShowOther is true
            if (alwaysShowOther && isOther) return true;
            return label.includes(searchLower);
          }),
        }))
        .filter((group) => group.items.length > 0);
    } else {
      const filtered = (items || []).filter((item) => {
        const label = (item.displayName || item.label || item.id).toLowerCase();
        const isOther = label.includes("other");
        if (alwaysShowOther && isOther) return true;
        return label.includes(searchLower);
      });
      return filtered;
    }
  }, [items, groups, searchText, isGrouped, alwaysShowOther]);

  // Flatten filtered items for navigation
  const flattenedItems = useCallback((): T[] => {
    const filtered = getFilteredItems();
    const result: T[] = [];

    if (isGrouped) {
      for (const item of filtered) {
        if ("items" in item) {
          result.push(...item.items);
        }
      }
    } else {
      for (const item of filtered) {
        if (!("items" in item)) {
          result.push(item as T);
        }
      }
    }

    return result;
  }, [getFilteredItems, isGrouped]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const flattened = flattenedItems();

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          if (!isOpen) {
            setIsOpen(true);
          } else {
            setHighlightedIndex((prev) =>
              prev < flattened.length - 1 ? prev + 1 : 0
            );
          }
          break;

        case "ArrowUp":
          e.preventDefault();
          if (isOpen) {
            setHighlightedIndex((prev) =>
              prev > 0 ? prev - 1 : flattened.length - 1
            );
          }
          break;

        case "Enter":
          e.preventDefault();
          if (isOpen && highlightedIndex >= 0 && highlightedIndex < flattened.length) {
            onChange(flattened[highlightedIndex].id);
            setIsOpen(false);
            setSearchText("");
            setHighlightedIndex(-1);
          }
          break;

        case "Escape":
          e.preventDefault();
          setIsOpen(false);
          setSearchText("");
          setHighlightedIndex(-1);
          break;

        case "Backspace":
          if (!searchText) {
            e.preventDefault();
            setSearchText("");
          }
          break;

        default:
          break;
      }
    },
    [isOpen, flattenedItems, highlightedIndex, onChange, searchText]
  );

  // Handle item click
  const handleItemClick = (id: string) => {
    onChange(id);
    setIsOpen(false);
    setSearchText("");
    setHighlightedIndex(-1);
  };

  // Highlight matching search text in item label
  const highlightSearchText = (text: string) => {
    if (!searchText.toLowerCase()) {
      return text;
    }

    const parts = text.split(
      new RegExp(`(${searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "i")
    );

    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === searchText.toLowerCase() ? (
            <span key={i} className="font-bold bg-yellow-200 dark:bg-yellow-900">
              {part}
            </span>
          ) : (
            part
          )
        )}
      </span>
    );
  };

  const filteredItems = getFilteredItems();
  const flatItems = flattenedItems();

  return (
    <div
      ref={containerRef}
      className={clsx("relative w-full", className)}
      role="combobox"
      aria-expanded={isOpen}
      aria-controls="searchable-listbox"
    >
      {/* Input field */}
      <div
        className={clsx(
          "relative border rounded-lg px-3 py-2.5 cursor-pointer transition-colors",
          disabled
            ? "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 cursor-not-allowed"
            : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 hover:border-primary-400 dark:hover:border-primary-400",
          isOpen && "ring-2 ring-primary-400"
        )}
      >
        <input
          ref={inputRef}
          type="text"
          value={searchText || (isOpen ? "" : getDisplayLabel())}
          onChange={(e) => {
            setSearchText(e.target.value);
            setHighlightedIndex(-1);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => !disabled && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={!isOpen ? placeholder : ""}
          disabled={disabled}
          className={clsx(
            "w-full bg-transparent outline-none text-sm",
            disabled
              ? "text-slate-400 dark:text-slate-500 cursor-not-allowed"
              : "text-slate-700 dark:text-slate-200"
          )}
          role="textbox"
          aria-label="Search equipment"
        />

        {/* Dropdown arrow */}
        <ChevronDown
          size={16}
          className={clsx(
            "absolute right-3 top-1/2 -translate-y-1/2 flex-shrink-0 pointer-events-none transition-transform",
            isOpen ? "rotate-180" : "rotate-0",
            disabled
              ? "text-slate-400 dark:text-slate-500"
              : "text-slate-400 dark:text-slate-500"
          )}
        />
      </div>

      {/* Dropdown list */}
      {isOpen && (
        <div
          ref={listRef}
          id="searchable-listbox"
          className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-60 overflow-y-auto"
          role="listbox"
        >
          {flatItems.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400 text-center">
              No results found
            </div>
          ) : isGrouped ? (
            // Grouped rendering
            filteredItems.map((group, groupIndex) => {
              if (!("items" in group)) return null;
              return (
                <div key={group.name}>
                  {/* Group header */}
                  <div className="sticky top-0 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                    {group.name}
                  </div>

                  {/* Group items */}
                  {group.items.map((item, itemIndex) => {
                    const globalIndex = flatItems.indexOf(item);
                    const isHighlighted = globalIndex === highlightedIndex;
                    const isSelected = item.id === value;

                    return (
                      <div
                        key={item.id}
                        onClick={() => handleItemClick(item.id)}
                        className={clsx(
                          "px-3 py-2.5 text-sm cursor-pointer transition-colors",
                          isHighlighted
                            ? "bg-primary-100 dark:bg-primary-900/30 text-primary-900 dark:text-primary-100"
                            : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700",
                          isSelected && "font-semibold bg-primary-50 dark:bg-primary-900/20"
                        )}
                        role="option"
                        aria-selected={isSelected}
                      >
                        {highlightSearchText(
                          item.displayName || item.label || item.id
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })
          ) : (
            // Flat rendering
            flatItems.map((item, index) => {
              const isHighlighted = index === highlightedIndex;
              const isSelected = item.id === value;

              return (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item.id)}
                  className={clsx(
                    "px-3 py-2.5 text-sm cursor-pointer transition-colors",
                    isHighlighted
                      ? "bg-primary-100 dark:bg-primary-900/30 text-primary-900 dark:text-primary-100"
                      : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700",
                    isSelected && "font-semibold bg-primary-50 dark:bg-primary-900/20"
                  )}
                  role="option"
                  aria-selected={isSelected}
                >
                  {highlightSearchText(item.displayName || item.label || item.id)}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
