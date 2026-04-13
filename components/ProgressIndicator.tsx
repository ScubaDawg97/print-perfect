"use client";

import { Check } from "lucide-react";
import clsx from "clsx";

const STEPS = [
  { id: 1, label: "Upload Model" },
  { id: 2, label: "Your Setup" },
  { id: 3, label: "Results" },
];

interface Props {
  currentStep: 1 | 2 | 3;
}

export default function ProgressIndicator({ currentStep }: Props) {
  return (
    <div className="flex items-center justify-center gap-0 mb-10">
      {STEPS.map((step, idx) => {
        const done = step.id < currentStep;
        const active = step.id === currentStep;

        return (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={clsx(
                  "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300",
                  done && "bg-primary-600 text-white",
                  active && "bg-primary-600 text-white ring-4 ring-primary-100 dark:ring-primary-900",
                  !done && !active && "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                )}
              >
                {done ? <Check size={16} strokeWidth={3} /> : step.id}
              </div>
              <span
                className={clsx(
                  "text-xs font-medium whitespace-nowrap",
                  active ? "text-primary-600 dark:text-primary-400" : done ? "text-slate-500 dark:text-slate-400" : "text-slate-400 dark:text-slate-500"
                )}
              >
                {step.label}
              </span>
            </div>

            {idx < STEPS.length - 1 && (
              <div
                className={clsx(
                  "h-0.5 w-16 sm:w-24 mx-1 mb-5 transition-all duration-300",
                  step.id < currentStep ? "bg-primary-600" : "bg-slate-200 dark:bg-slate-700"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
