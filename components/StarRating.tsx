"use client";

import { useState } from "react";

interface Props {
  value: 1 | 2 | 3 | 4 | 5 | null;
  onChange: (stars: 1 | 2 | 3 | 4 | 5 | null) => void;
  readonly?: boolean;
  size?: "sm" | "md";
}

export default function StarRating({ value, onChange, readonly = false, size = "md" }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);

  const active = hovered ?? value ?? 0;
  const iconSize = size === "sm" ? "text-base" : "text-xl";
  const gapClass = size === "sm" ? "gap-0.5" : "gap-1";

  return (
    <div
      className={`flex ${gapClass}`}
      onMouseLeave={() => !readonly && setHovered(null)}
      aria-label={value ? `Rated ${value} out of 5 stars` : "Unrated"}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= active;
        return (
          <button
            key={star}
            type="button"
            disabled={readonly}
            aria-label={`${star} star${star !== 1 ? "s" : ""}`}
            onMouseEnter={() => !readonly && setHovered(star)}
            onClick={() => {
              if (readonly) return;
              // Clicking the same star again clears the rating
              onChange(star === value ? null : (star as 1 | 2 | 3 | 4 | 5));
            }}
            className={`leading-none transition-colors ${iconSize} ${
              readonly
                ? "cursor-default"
                : "cursor-pointer hover:scale-110 transition-transform"
            } disabled:pointer-events-none`}
          >
            {filled ? (
              <span className="text-amber-400">★</span>
            ) : (
              <span className="text-slate-300 dark:text-slate-600">☆</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
