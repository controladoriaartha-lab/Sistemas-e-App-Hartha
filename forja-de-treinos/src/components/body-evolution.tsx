import { useMemo, useState, type ReactNode } from "react";
import { Activity, HeartPulse, Moon, Save, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { norm } from "@/lib/athlete-view";
import { bodyEntryId, saveBodyEntry, useBodyEntries, type BodyEntry } from "@/lib/body";
import { todayIso } from "@/lib/format";
import { DEFAULT_ATHLETES } from "@/lib/types";
import { useWorkoutStore } from "@/store/workouts";

type Field =
  | "weightKg"
  | "waistCm"
  | "armCm"
  | "thighCm"
  | "chestCm"
  | "calfCm"
  | "energy"
  | "sleepHours";

const MEASURES: { key: Field; label: string; example: string; min: number; max: number }[] = [
  { key: "weightKg", label: "Peso (kg)", example: "72,4", min: 20, max: 400 },
  { key: "waistCm", label: "Cintura (cm)", example: "84", min: 20, max: 300 },
  { key: "armCm", label: "Braço (cm)", example: "36", min: 10, max: 120 },
  { key: "thighCm", label: "Coxa (cm)", example: "58", min: 20, max: 160 },
  { key: "chestCm", label: "Peito (cm)", example: "102", min: 30, max: 250 },
  { key: "calfCm", label: "Panturrilha (cm)", example: "38", min: 10, max: 100 },
];

const toText = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n).replace(".", ","));

/** "72,4" -> 72.4; vazio -> null; texto invalido -> NaN. */
function parse(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : Number.NaN;
}

const brDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/**
 * "Evolucao corporal": botao no Painel que abre um painel com um cartao por
 * atleta (medidas, energia, sono e como se sente). Cada salvamento vale para o
 * dia de hoje e vai para a nuvem (tabela body_measurements).
 */
export function BodyEvolutionPanel() {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <p className="font-medium">Evolução corporal</p>
      <p className="mt-1 text-base text-faint">
        Anote peso, medidas, energia, sono e como o corpo está respondendo, por atleta, para
        acompanhar a evolução ao longo do tempo.
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-3d mt-3 flex h-14 w-full items-center justify-center gap-2 text-[22px] font-medium"
      >
        <Activity className="size-6" />
        Evolução corporal
      </button>
      {open && <BodySheet onClose={() => setOpen(false)} />}
    </div>
  );
}

function BodySheet({ onClose }: { onClose: () => void }) {
  const workouts = useWorkoutStore((s) => s.workouts);
  const customAthletes = useWorkoutStore((s) => s.customAthletes);
  const entries = useBodyEntries();

  const athletes = useMemo(() => {
    const seen = new Map<string, string>();
    for (const name of [
      ...DEFAULT_ATHLETES,
      ...customAthletes,
      ...workouts.flatMap((w) => w.athletes),
    ]) {
      const label = name.trim();
      if (label && !seen.has(norm(label))) seen.set(norm(label), label);
    }
    return [...seen.values()];
  }, [workouts, customAthletes]);

  return (
    <div className="fixed inset-0 z-[75] flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Evolução corporal"
        className="flex max-h-[94dvh] w-full max-w-lg flex-col rounded-t-3xl p-4 ring-1 ring-border"
        style={{
          background: "var(--color-background)",
          paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-1">
          <div>
            <p className="font-display text-2xl">Evolução corporal</p>
            <p className="text-[18px] text-faint">
              Um cartão por atleta. Salvar de novo no mesmo dia atualiza o registro de hoje.
            </p>
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

        <div className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pb-2">
          {athletes.map((name) => (
            <AthleteCard
              key={name}
              name={name}
              entries={entries
                .filter((e) => norm(e.athlete) === norm(name))
                .sort((a, b) => b.date.localeCompare(a.date))}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function AthleteCard({ name, entries }: { name: string; entries: BodyEntry[] }) {
  const today = todayIso();
  const todays = entries.find((e) => e.date === today);
  const last = entries[0];

  const [values, setValues] = useState<Record<Field, string>>(() => ({
    weightKg: toText(todays?.weightKg),
    waistCm: toText(todays?.waistCm),
    armCm: toText(todays?.armCm),
    thighCm: toText(todays?.thighCm),
    chestCm: toText(todays?.chestCm),
    calfCm: toText(todays?.calfCm),
    energy: toText(todays?.energy),
    sleepHours: toText(todays?.sleepHours),
  }));
  const [feeling, setFeeling] = useState(todays?.feeling ?? "");
  const [saving, setSaving] = useState(false);

  const set = (key: Field) => (text: string) => setValues((v) => ({ ...v, [key]: text }));
  const hint = (key: Field, example: string) =>
    last && last[key] !== null && last[key] !== undefined ? `Última: ${toText(last[key])}` : `Ex.: ${example}`;

  async function onSave() {
    const parsed = {} as Record<Field, number | null>;
    for (const m of MEASURES) {
      const n = parse(values[m.key]);
      if (n !== null && (Number.isNaN(n) || n < m.min || n > m.max)) {
        toast.error(`${m.label}: informe um valor entre ${m.min} e ${m.max}.`);
        return;
      }
      parsed[m.key] = n;
    }
    const energy = parse(values.energy);
    if (energy !== null && (Number.isNaN(energy) || energy < 0 || energy > 10)) {
      toast.error("Energia: informe um valor de 0 a 10.");
      return;
    }
    const sleep = parse(values.sleepHours);
    if (sleep !== null && (Number.isNaN(sleep) || sleep < 0 || sleep > 24)) {
      toast.error("Sono: informe as horas dormidas (0 a 24).");
      return;
    }
    const filled = [...Object.values(parsed), energy, sleep].some((v) => v !== null);
    if (!filled && !feeling.trim()) {
      toast.error(`Preencha pelo menos um campo de ${name}.`);
      return;
    }
    setSaving(true);
    const ok = await saveBodyEntry({
      id: bodyEntryId(name, today),
      athlete: name,
      date: today,
      weightKg: parsed.weightKg,
      waistCm: parsed.waistCm,
      armCm: parsed.armCm,
      thighCm: parsed.thighCm,
      chestCm: parsed.chestCm,
      calfCm: parsed.calfCm,
      energy,
      sleepHours: sleep,
      feeling: feeling.trim(),
    });
    setSaving(false);
    if (ok) toast.success(`Medidas de ${name} guardadas na nuvem`);
    else toast.warning("Guardado neste aparelho; vai para a nuvem quando houver conexão.");
  }

  return (
    <section className="glass-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-[26px] font-medium leading-tight">{name}</h3>
        <span className="badge-3d shrink-0 !px-3 !text-[14px]" data-tone={last ? "leve" : "medio"}>
          {last ? `Última ${brDate(last.date)}` : "Sem medidas salvas"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4">
        {MEASURES.map((m) => (
          <Labeled key={m.key} label={m.label}>
            <Input
              inputMode="decimal"
              value={values[m.key]}
              onChange={(e) => set(m.key)(e.target.value)}
              placeholder={hint(m.key, m.example)}
            />
          </Labeled>
        ))}
        <Labeled label="Energia (0–10)" icon={<Zap className="size-4" />}>
          <Input
            inputMode="decimal"
            value={values.energy}
            onChange={(e) => set("energy")(e.target.value)}
            placeholder={hint("energy", "8")}
          />
        </Labeled>
        <Labeled label="Sono (horas)" icon={<Moon className="size-4" />}>
          <Input
            inputMode="decimal"
            value={values.sleepHours}
            onChange={(e) => set("sleepHours")(e.target.value)}
            placeholder={hint("sleepHours", "7,5")}
          />
        </Labeled>
        <div className="col-span-2">
          <Labeled label="Como me sinto" icon={<HeartPulse className="size-4" />}>
            <Textarea
              rows={3}
              value={feeling}
              onChange={(e) => setFeeling(e.target.value)}
              placeholder="Escreva em poucas palavras como o corpo está respondendo…"
            />
          </Labeled>
        </div>
      </div>

      <button
        type="button"
        onClick={() => void onSave()}
        disabled={saving}
        data-on="true"
        className="seg-item mt-5 flex min-h-14 w-full items-center justify-center gap-2 px-3 py-2 text-[20px] font-semibold leading-tight disabled:opacity-60"
      >
        <Save className="size-6" />
        {saving ? "Guardando…" : `Salvar medidas de ${name}`}
      </button>

      {entries.length > 0 && (
        <details className="mt-4 text-[20px]">
          <summary className="cursor-pointer text-faint">Histórico de {name}</summary>
          <ul className="mt-2 space-y-2">
            {entries.slice(0, 8).map((e, i) => (
              <li key={e.id} className="leading-snug">
                <span className="tabular-nums text-foreground">{brDate(e.date)}</span>
                <span className="text-muted-foreground">
                  {[
                    e.weightKg !== null && `${toText(e.weightKg)} kg${deltaText(e, entries[i + 1], "weightKg", "kg")}`,
                    e.waistCm !== null && `cintura ${toText(e.waistCm)} cm${deltaText(e, entries[i + 1], "waistCm", "cm")}`,
                    e.energy !== null && `energia ${toText(e.energy)}`,
                    e.sleepHours !== null && `sono ${toText(e.sleepHours)} h`,
                  ]
                    .filter(Boolean)
                    .map((t) => ` · ${t}`)
                    .join("")}
                </span>
                {e.feeling && <p className="text-[18px] text-faint">{e.feeling}</p>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

/** " (+0,6)" em relacao ao registro anterior que tem o mesmo campo. */
function deltaText(cur: BodyEntry, previous: BodyEntry | undefined, key: Field, unit: string) {
  const a = cur[key];
  const b = previous?.[key];
  if (a === null || a === undefined || b === null || b === undefined) return "";
  const d = Math.round((a - b) * 10) / 10;
  if (d === 0) return "";
  return ` (${d > 0 ? "+" : ""}${toText(d)} ${unit})`;
}

function Labeled({ label, icon, children }: { label: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <label className="flex h-full flex-col justify-end">
      <span className="mb-1.5 flex items-center gap-1.5 text-[20px] font-medium text-muted-foreground">
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}
