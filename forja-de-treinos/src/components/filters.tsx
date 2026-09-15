import { useState, type ReactNode } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { recentMonths } from "@/lib/period";
import { cn } from "@/lib/utils";

/** Small labelled wrapper for a filter control. */
export function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[24px] font-medium text-faint">{label}</p>
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
              "min-h-10 shrink-0 rounded-full px-4 text-[28px] font-medium transition-colors duration-150",
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

/**
 * Small "menuzinho" next to the Período row, only relevant while "Mês" is the
 * active period: lets you pick which of the last 12 months to look at instead
 * of always the current one.
 */
export function MonthPicker({
  offset,
  onChange,
}: {
  offset: number;
  onChange: (offset: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const months = recentMonths(12);
  const current = months.find((m) => m.offset === offset) ?? months[0];

  return (
    <div className="relative mt-2 inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-10 items-center gap-1.5 rounded-lg bg-muted px-3 text-[28px] font-medium text-foreground"
      >
        <CalendarDays className="size-4 text-faint" />
        {current.label}
        <ChevronDown className="size-4 text-faint" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute left-0 top-full z-30 mt-1 max-h-64 w-48 overflow-y-auto rounded-xl bg-card p-1 shadow-[0_12px_32px_rgba(0,0,0,0.5)] ring-1 ring-border">
            {months.map((m) => (
              <button
                key={m.offset}
                type="button"
                onClick={() => {
                  onChange(m.offset);
                  setOpen(false);
                }}
                className={cn(
                  "block w-full rounded-lg px-3 py-2 text-left text-[28px]",
                  m.offset === offset ? "bg-paper text-ink" : "text-foreground",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
