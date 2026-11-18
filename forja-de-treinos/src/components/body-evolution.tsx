import { useMemo, useState, type ReactNode } from "react";
import { HeartPulse, Moon, Plus, Save, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { norm } from "@/lib/athlete-view";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  ATHLETE_LINE,
  CHART_COLORS,
  chartTooltipProps,
  useStickyTooltip,
} from "@/components/chart-kit";
import {
  BODY_METRICS,
  bodyEntryId,
  bodySeries,
  latestFields,
  metricsWithLine,
  saveBodyEntry,
  useBodyEntries,
  type BodyEntry,
  type BodyMetric,
} from "@/lib/body";
import { useTheme } from "@/lib/theme";
import { todayIso } from "@/lib/format";
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
 * "Evolucao corporal" no Painel (logo abaixo do mapa de calor semanal): mostra o
 * que ja foi registrado de cada atleta (ultimas medidas e "como me sinto"), um
 * grafico da evolucao e o "+" que abre o painel para registrar mais um atleta
 * ou mais um dia. Tudo vai para a nuvem (tabela body_measurements).
 */
export function BodyEvolutionSection() {
  const entries = useBodyEntries();
  const theme = useTheme();
  const c = CHART_COLORS[theme];
  const tip = useStickyTooltip();
  const [open, setOpen] = useState(false);
  const [metric, setMetric] = useState<BodyMetric>("weightKg");

  const athletes = useMemo(() => {
    const seen = new Map<string, string>();
    for (const e of [...entries].sort((a, b) => b.date.localeCompare(a.date))) {
      const label = e.athlete.trim();
      if (label && !seen.has(norm(label))) seen.set(norm(label), label);
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [entries]);

  const available = useMemo(() => metricsWithLine(entries), [entries]);
  const activeMetric = available.includes(metric) ? metric : (available[0] ?? "weightKg");
  const series = useMemo(() => bodySeries(entries, activeMetric), [entries, activeMetric]);
  const meta = BODY_METRICS.find((m) => m.key === activeMetric)!;
  const lineColors = ATHLETE_LINE[theme];

  return (
    <section className="glass-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[24px] font-medium text-foreground">Evolução corporal</p>
          <p className="text-[24px] font-normal text-faint">peso, medidas e sono</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Registrar evolução corporal (mais um atleta ou mais um dia)"
          title="Registrar"
          className="btn-3d flex size-12 shrink-0 items-center justify-center rounded-full"
        >
          <Plus className="size-7" />
        </button>
      </div>

      {athletes.length === 0 ? (
        <p className="mt-3 text-[21px] leading-snug text-muted-foreground">
          Nada registrado ainda. Toque no <span className="text-foreground">+</span> para anotar peso,
          medidas, energia, sono e como o corpo está respondendo.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {athletes.map((name) => (
            <AthleteSummary
              key={name}
              name={name}
              entries={entries.filter((e) => norm(e.athlete) === norm(name))}
            />
          ))}
        </div>
      )}

      {athletes.length > 0 &&
        (available.length === 0 ? (
          <p className="mt-4 text-[19px] leading-snug text-faint">
            Com dois registros da mesma medida, a linha de evolução aparece aqui.
          </p>
        ) : (
          <div className="mt-5">
            <div className="flex flex-wrap gap-2">
              {BODY_METRICS.filter((m) => available.includes(m.key)).map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMetric(m.key)}
                  data-on={activeMetric === m.key}
                  className="pill-3d min-h-11 px-4 text-[21px] font-medium"
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="mb-2 mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[21px]">
              {series.athletes.map((name, i) => (
                <span key={name} className="flex items-center gap-2">
                  <span
                    className="size-3 rounded-full"
                    style={{ background: lineColors[i % lineColors.length] }}
                  />
                  {name}
                </span>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={210}>
              <LineChart
                data={series.rows}
                margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
                onClick={(state) => {
                  if (state?.activePayload) {
                    tip.show({
                      label: state.activeLabel,
                      payload: state.activePayload,
                      coordinate: state.activeCoordinate,
                    });
                  }
                }}
              >
                <CartesianGrid vertical={false} stroke={c.grid} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: c.muted, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis
                  tick={{ fill: c.muted, fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                  domain={[(min: number) => Math.floor(min - 1), (max: number) => Math.ceil(max + 1)]}
                  allowDecimals={false}
                  tickFormatter={(v: number) => toText(v)}
                />
                <Tooltip
                  {...chartTooltipProps(c)}
                  active={tip.sticky ? true : false}
                  payload={tip.sticky ? (tip.sticky.payload as never) : undefined}
                  label={tip.sticky ? tip.sticky.label : undefined}
                  coordinate={tip.sticky ? tip.sticky.coordinate : undefined}
                  formatter={(value) => [`${toText(Number(value))} ${meta.unit}`, ""]}
                />
                {series.athletes.map((name, i) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={lineColors[i % lineColors.length]}
                    strokeWidth={3.5}
                    dot={{ r: 5, fill: lineColors[i % lineColors.length], stroke: c.ink, strokeWidth: 1.5 }}
                    activeDot={false}
                    connectNulls
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ))}

      {open && <BodySheet onClose={() => setOpen(false)} />}
    </section>
  );
}

const SUMMARY_FIELDS: { key: BodyMetric | "energy" | "sleepHours"; label: string; unit: string }[] = [
  ...BODY_METRICS.map((m) => ({ key: m.key, label: m.label, unit: m.unit })),
  { key: "energy", label: "Energia", unit: "/10" },
  { key: "sleepHours", label: "Sono", unit: "h" },
];

/** Ultimas medidas de um atleta (com a variacao desde o registro anterior) e o "como me sinto". */
function AthleteSummary({ name, entries }: { name: string; entries: BodyEntry[] }) {
  const { fields, feeling } = useMemo(() => latestFields(entries), [entries]);
  const lastDate = [...entries].sort((a, b) => b.date.localeCompare(a.date))[0]?.date;

  return (
    <div className="stat-tile p-3.5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-[26px] font-medium leading-tight">{name}</h3>
        {lastDate && (
          <span className="badge-3d shrink-0 !px-3 !text-[14px]" data-tone="leve">
            Última {brDate(lastDate)}
          </span>
        )}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {SUMMARY_FIELDS.map((f) => {
          const v = fields[f.key];
          if (!v) return null;
          const d = v.previous === null ? 0 : Math.round((v.value - v.previous) * 10) / 10;
          return (
            <div key={f.key} className="rounded-xl bg-muted/60 px-2 py-2 text-center">
              <p className="text-[16px] leading-tight text-faint">{f.label}</p>
              <p className="font-display text-[24px] leading-tight tabular-nums text-foreground">
                {toText(v.value)}
                <span className="ml-0.5 text-[15px] text-muted-foreground">{f.unit}</span>
              </p>
              {d !== 0 && (
                <p className="text-[15px] leading-tight tabular-nums text-muted-foreground">
                  {d > 0 ? "▲" : "▼"} {toText(Math.abs(d))}
                </p>
              )}
            </div>
          );
        })}
      </div>
      {feeling && (
        <p className="mt-3 text-[20px] leading-snug text-muted-foreground">
          <span className="text-foreground">“{feeling.text}”</span>{" "}
          <span className="text-[17px] text-faint">· {brDate(feeling.date)}</span>
        </p>
      )}
    </div>
  );
}

function BodySheet({ onClose }: { onClose: () => void }) {
  const workouts = useWorkoutStore((s) => s.workouts);
  const customAthletes = useWorkoutStore((s) => s.customAthletes);
  const entries = useBodyEntries();
  // Cartoes em branco ("Atleta"): o "+" abre mais um; ao salvar, o atleta ganha o proprio cartao.
  const [blanks, setBlanks] = useState<number[]>([0]);
  const [nextBlank, setNextBlank] = useState(1);
  const addBlank = () => {
    setBlanks((list) => [...list, nextBlank]);
    setNextBlank((n) => n + 1);
  };
  const savedBlank = (id: number) => {
    setBlanks((list) => {
      const rest = list.filter((x) => x !== id);
      return rest.length > 0 ? rest : [nextBlank];
    });
    setNextBlank((n) => n + 1);
  };

  // Atletas que ja tem medidas salvas (um cartao cada); o nome vem do que foi digitado.
  const saved = useMemo(() => {
    const seen = new Map<string, string>();
    for (const e of [...entries].sort((a, b) => b.date.localeCompare(a.date))) {
      const label = e.athlete.trim();
      if (label && !seen.has(norm(label))) seen.set(norm(label), label);
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [entries]);

  // Sugestoes de nome (so ajuda a digitar): atletas dos treinos e cadastrados.
  const suggestions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const name of [...customAthletes, ...workouts.flatMap((w) => w.athletes)]) {
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
              Escreva o nome do atleta e as medidas. O + abre mais um atleta; cada salvamento vira um
              registro do dia e o histórico vai acumulando.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={addBlank}
              aria-label="Mais um atleta"
              title="Mais um atleta"
              className="btn-3d flex size-11 items-center justify-center rounded-full"
            >
              <Plus className="size-6" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="btn-3d flex size-11 items-center justify-center rounded-full"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        <datalist id="body-athlete-names">
          {suggestions.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>

        <div className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pb-2">
          {saved.map((name) => (
            <AthleteCard
              key={name}
              name={name}
              entries={entries
                .filter((e) => norm(e.athlete) === norm(name))
                .sort((a, b) => b.date.localeCompare(a.date))}
            />
          ))}
          {blanks.map((id) => (
            <AthleteCard key={`novo-${id}`} entries={[]} onSaved={() => savedBlank(id)} />
          ))}

          <button
            type="button"
            onClick={addBlank}
            className="btn-3d flex h-14 w-full items-center justify-center gap-2 text-[22px] font-medium"
          >
            <Plus className="size-6" />
            Mais um atleta
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Cartao de um atleta. Sem `name` e o cartao em branco "Atleta": o nome e digitado
 * ali e, depois de salvar, o atleta ganha o proprio cartao e este volta vazio.
 */
function AthleteCard({
  name,
  entries,
  onSaved,
}: {
  name?: string;
  entries: BodyEntry[];
  onSaved?: () => void;
}) {
  const isNew = name === undefined;
  const [typedName, setTypedName] = useState("");
  const athleteName = isNew ? typedName.trim() : name;
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
  const emptyValues: Record<Field, string> = {
    weightKg: "",
    waistCm: "",
    armCm: "",
    thighCm: "",
    chestCm: "",
    calfCm: "",
    energy: "",
    sleepHours: "",
  };

  const set = (key: Field) => (text: string) => setValues((v) => ({ ...v, [key]: text }));
  const hint = (key: Field, example: string) =>
    last && last[key] !== null && last[key] !== undefined ? `Última: ${toText(last[key])}` : `Ex.: ${example}`;

  async function onSave() {
    if (athleteName.length < 2) {
      toast.error("Escreva o nome do atleta.");
      return;
    }
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
      toast.error(`Preencha pelo menos um campo de ${athleteName}.`);
      return;
    }
    setSaving(true);
    const ok = await saveBodyEntry({
      id: bodyEntryId(athleteName, today),
      athlete: athleteName,
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
    if (ok) toast.success(`Medidas de ${athleteName} guardadas na nuvem`);
    else toast.warning("Guardado neste aparelho; vai para a nuvem quando houver conexão.");
    if (isNew) {
      // O atleta agora tem o proprio cartao; este volta em branco para o proximo.
      setValues(emptyValues);
      setFeeling("");
      setTypedName("");
      onSaved?.();
    }
  }

  return (
    <section className="glass-card p-4">
      <div className="flex items-center justify-between gap-3">
        {isNew ? (
          <h3 className="font-display text-[26px] font-medium leading-tight">Atleta</h3>
        ) : (
          <h3 className="font-display text-[26px] font-medium leading-tight">{name}</h3>
        )}
        <span className="badge-3d shrink-0 !px-3 !text-[14px]" data-tone={last ? "leve" : "medio"}>
          {last ? `Última ${brDate(last.date)}` : "Sem medidas salvas"}
        </span>
      </div>

      {isNew && (
        <div className="mt-3">
          <Labeled label="Nome do atleta">
            <Input
              list="body-athlete-names"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder="Ex.: Maria"
              autoComplete="off"
            />
          </Labeled>
        </div>
      )}

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
        {saving ? "Guardando…" : `Salvar medidas de ${athleteName || "atleta"}`}
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
