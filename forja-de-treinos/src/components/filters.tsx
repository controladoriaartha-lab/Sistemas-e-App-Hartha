import { useState, type ReactNode } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { todayIso } from "@/lib/format";
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
    <div className="-mx-5 flex gap-2.5 overflow-x-auto px-5 pb-2 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {options.map((opt) => {
        const on = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            data-on={on}
            className="pill-3d min-h-11 shrink-0 px-5 text-[24px] font-medium"
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Small "menuzinho" below the Período row, for Quinzenal / Mês / Trimestral /
 * Semestral / Anual: lets you pick which occurrence to look at (2ª quinzena
 * de setembro, 1º trimestre, 2025…) instead of always the current one.
 */
export function PeriodPicker({
  options,
  offset,
  onChange,
}: {
  options: { offset: number; label: string }[];
  offset: number;
  onChange: (offset: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const months = options;
  const current = months.find((m) => m.offset === offset) ?? months[0];

  return (
    <div className="relative mt-2 inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn-3d flex min-h-11 items-center gap-1.5 px-3.5 text-[24px] font-medium"
      >
        <CalendarDays className="size-4 text-faint" />
        {current.label}
        <ChevronDown className="size-4 text-faint" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute left-0 top-full z-30 mt-1 max-h-64 w-max min-w-48 max-w-[calc(100vw-2.5rem)] overflow-y-auto rounded-2xl bg-card p-1.5 shadow-[0_18px_34px_rgba(0,0,0,0.55),0_4px_0_rgba(0,0,0,0.35)] ring-1 ring-border">
            {months.map((m) => (
              <button
                key={m.offset}
                type="button"
                onClick={() => {
                  onChange(m.offset);
                  setOpen(false);
                }}
                data-on={m.offset === offset}
                className={cn(
                  "block w-full rounded-lg px-3 py-2 text-left text-[24px]",
                  m.offset === offset ? "seg-item" : "text-foreground",
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

/**
 * Small "menuzinho" next to the Período row, only relevant while "Dia" is the
 * active period: lets you pick which exact day to look at instead of always
 * today. A native date input, so it opens the phone's own calendar picker.
 */
export function DayPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="btn-3d mt-3 inline-flex min-h-11 items-center gap-1.5 px-3.5">
      <CalendarDays className="size-4 shrink-0 text-faint" />
      <input
        type="date"
        value={value}
        max={todayIso()}
        onChange={(e) => onChange(e.target.value || todayIso())}
        className="min-w-0 bg-transparent text-[24px] font-medium text-foreground outline-none [color-scheme:inherit]"
      />
    </div>
  );
}
