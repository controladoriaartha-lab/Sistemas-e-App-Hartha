import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type SuggestionOption = { label: string; count?: number };

/**
 * Janela que sobe da base com o historico (grupos musculares, notas...) em
 * botoes: um toque marca/desmarca e o resultado ja vai para o campo. Fica
 * aberta para marcar varios de uma vez; "Pronto" fecha.
 */
export function SuggestionSheet({
  open,
  onClose,
  title,
  hint,
  options,
  isSelected,
  onToggle,
  emptyText,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  hint?: string;
  options: SuggestionOption[];
  isSelected: (label: string) => boolean;
  onToggle: (label: string) => void;
  emptyText: string;
}) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    setQuery("");
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const q = query.trim().toLowerCase();
  const shown = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;

  return (
    <div className="fixed inset-0 z-[75] flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className="glass-card flex max-h-[78dvh] w-full max-w-lg flex-col !rounded-b-none bg-[var(--color-card)] p-5"
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))", background: "var(--color-card)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-2xl">{title}</p>
            {hint && <p className="mt-0.5 text-[18px] text-faint">{hint}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="btn-3d flex size-11 shrink-0 items-center justify-center rounded-full"
          >
            <X className="size-5" />
          </button>
        </div>

        {options.length > 6 && (
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar…"
            className="mt-3 h-12 w-full rounded-xl bg-muted px-4 text-[20px] text-foreground outline-none placeholder:text-faint"
          />
        )}

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {shown.length === 0 ? (
            <p className="py-6 text-center text-[20px] text-faint">{emptyText}</p>
          ) : (
            <ul className="flex flex-wrap gap-3 pb-1">
              {shown.map((o) => {
                const on = isSelected(o.label);
                return (
                  <li key={o.label} className="max-w-full">
                    <button
                      type="button"
                      onClick={() => onToggle(o.label)}
                      data-on={on}
                      className={cn(
                        "pill-3d flex min-h-12 max-w-full items-center gap-1.5 px-5 text-left text-[24px] font-medium",
                      )}
                    >
                      {on && <Check className="size-5 shrink-0" strokeWidth={3} />}
                      <span className="min-w-0 break-words">{o.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          data-on="true"
          className="seg-item mt-4 h-14 w-full text-[24px] font-semibold"
        >
          Pronto
        </button>
      </div>
    </div>
  );
}
