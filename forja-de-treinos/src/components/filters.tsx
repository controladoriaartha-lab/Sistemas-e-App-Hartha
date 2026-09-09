import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Small labelled wrapper for a filter control. */
export function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-faint">{label}</p>
      {children}
    </div>
  );
}

/** Horizontally scrollable row of single-select pills. Assumes a `px-5` parent. */
export function PillRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {options.map((opt) => {
        const on = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "min-h-10 shrink-0 rounded-full px-4 text-sm font-medium transition-colors duration-150",
              on ? "bg-paper text-ink" : "bg-muted text-muted-foreground",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
