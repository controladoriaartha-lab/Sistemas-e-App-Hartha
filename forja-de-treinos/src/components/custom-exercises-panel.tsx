import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { ENTRIES, type Weights } from "@/lib/exercise-dictionary";
import {
  removeCustomExercise,
  saveCustomExercise,
  useCustomExercises,
} from "@/lib/custom-exercises";
import { REGION_LABEL, type RegionId } from "@/lib/muscle-map";

const REGIONS = Object.keys(REGION_LABEL) as RegionId[];

/** Resumo "Quadríceps, Glúteos + apoio: Panturrilha" de um conjunto de pesos. */
function describe(weights: Weights): string {
  const main = REGIONS.filter((r) => (weights[r] ?? 0) >= 0.8).map((r) => REGION_LABEL[r]);
  const help = REGIONS.filter((r) => (weights[r] ?? 0) > 0 && (weights[r] ?? 0) < 0.8).map(
    (r) => REGION_LABEL[r],
  );
  if (main.length === 0 && help.length === 0) return "sem músculo marcado";
  return help.length > 0 ? `${main.join(", ")} · apoio: ${help.join(", ")}` : main.join(", ");
}

/**
 * "Meus aparelhos": o usuario ensina ao app um aparelho novo (nome, palavras e
 * musculos). Fica na nuvem (tabela custom_exercises) e passa a valer na figura
 * de musculos trabalhados. Abaixo, a lista do que o app ja conhece.
 */
export function CustomExercisesPanel() {
  const items = useCustomExercises();
  const [open, setOpen] = useState(false);

  return (
    <div>
      <p className="font-medium">Meus aparelhos</p>
      <p className="mt-1 text-base text-faint">
        Ensine ao app um aparelho novo e quais músculos ele trabalha. Quando você escrever esse nome
        nas notas ou nos grupos, o corpo humano do Painel já acende certo.
      </p>

      {items.length > 0 && (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={item.id} className="glass-card flex items-center gap-3 p-3.5">
              <div className="min-w-0 flex-1">
                <p className="text-[22px] leading-tight">{item.name}</p>
                <p className="text-[18px] leading-snug text-faint">{describe(item.weights)}</p>
              </div>
              <button
                type="button"
                aria-label={`Excluir ${item.name}`}
                onClick={async () => {
                  if (!window.confirm(`Excluir o aparelho "${item.name}"?`)) return;
                  const ok = await removeCustomExercise(item.id);
                  if (!ok) toast.error("Excluído só neste aparelho; sem conexão com a nuvem.");
                }}
                className="btn-3d flex size-11 shrink-0 items-center justify-center rounded-full"
              >
                <Trash2 className="size-5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-3d mt-3 flex h-14 w-full items-center justify-center gap-2 text-[22px] font-medium"
      >
        <Plus className="size-6" />
        Adicionar aparelho
      </button>

      <details className="mt-4 text-[18px]">
        <summary className="cursor-pointer text-faint">
          Ver os {ENTRIES.filter((e) => !e.generic).length} tipos de exercício que o app já conhece
        </summary>
        <ul className="mt-2 space-y-1.5">
          {ENTRIES.filter((e) => !e.generic).map((e) => (
            <li key={e.name}>
              <span className="text-foreground">{e.name}</span>
              <span className="block text-[16px] leading-snug text-faint">{describe(e.weights)}</span>
            </li>
          ))}
        </ul>
      </details>

      {open && <AddSheet onClose={() => setOpen(false)} />}
    </div>
  );
}

function AddSheet({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [words, setWords] = useState("");
  // 0 = nao trabalha, 1 = principal, 0.5 = apoio (um toque, dois toques, tres = limpa)
  const [weights, setWeights] = useState<Weights>({});
  const [saving, setSaving] = useState(false);

  function cycle(region: RegionId) {
    const cur = weights[region] ?? 0;
    const next = cur === 0 ? 1 : cur === 1 ? 0.5 : 0;
    setWeights((w) => {
      const out = { ...w };
      if (next === 0) delete out[region];
      else out[region] = next;
      return out;
    });
  }

  async function onSave() {
    const trimmed = name.trim();
    if (trimmed.length < 3) {
      toast.error("Escreva o nome do aparelho (pelo menos 3 letras).");
      return;
    }
    if (Object.keys(weights).length === 0) {
      toast.error("Marque pelo menos um músculo.");
      return;
    }
    setSaving(true);
    const keywords = words
      .split(/[,;\n]+/)
      .map((w) => w.trim())
      .filter(Boolean);
    const ok = await saveCustomExercise({
      id: `ce-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: trimmed,
      keywords,
      weights,
    });
    setSaving(false);
    if (ok) toast.success("Aparelho guardado na nuvem");
    else toast.warning("Guardado neste aparelho; vai para a nuvem quando houver conexão.");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[75] flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Adicionar aparelho"
        className="flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-3xl p-5 ring-1 ring-border"
        style={{
          background: "var(--color-card)",
          paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="font-display text-2xl">Novo aparelho</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="btn-3d flex size-11 shrink-0 items-center justify-center rounded-full"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-3 min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pb-1">
          <label className="block">
            <span className="text-[20px] text-faint">Nome</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex.: cadeira abdutora"
              className="mt-1 h-14 w-full rounded-xl bg-muted px-4 text-[22px] text-foreground outline-none placeholder:text-faint"
            />
          </label>
          <label className="block">
            <span className="text-[20px] text-faint">Outros jeitos de escrever (opcional)</span>
            <input
              value={words}
              onChange={(e) => setWords(e.target.value)}
              placeholder="ex.: abdutora, abdução quadril"
              className="mt-1 h-14 w-full rounded-xl bg-muted px-4 text-[22px] text-foreground outline-none placeholder:text-faint"
            />
          </label>

          <div>
            <p className="text-[20px] text-faint">
              Músculos: um toque = principal, dois = apoio, três = tira
            </p>
            <ul className="mt-2 flex flex-wrap gap-2.5">
              {REGIONS.map((region) => {
                const w = weights[region] ?? 0;
                return (
                  <li key={region}>
                    <button
                      type="button"
                      onClick={() => cycle(region)}
                      data-on={w === 1}
                      className="pill-3d min-h-12 px-4 text-[22px] font-medium"
                      style={w === 0.5 ? { outline: "2px dashed var(--color-accent)", outlineOffset: -2, color: "var(--color-foreground)" } : undefined}
                    >
                      {REGION_LABEL[region]}
                      {w === 1 ? " ●" : w === 0.5 ? " ○" : ""}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void onSave()}
          disabled={saving}
          data-on="true"
          className="seg-item mt-4 h-14 w-full text-[24px] font-semibold disabled:opacity-60"
        >
          {saving ? "Guardando…" : "Guardar aparelho"}
        </button>
      </div>
    </div>
  );
}
