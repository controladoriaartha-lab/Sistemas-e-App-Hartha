import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import { computeStats, deltaPct } from "@/lib/stats";
import { formatDuration, formatHours } from "@/lib/format";
import type { Workout } from "@/lib/types";
import { INTENSITY_LABEL } from "@/lib/types";

const INK = "#0c0b0a";
const PAPER = "#f4efe8";
const MUTED = "#9a9086";
const GRID = "rgba(244,239,232,0.08)";
const ACCENT = "#c45c26";
const WARN = "#c4a574";
const OK = "#7d9478";

// Shared Recharts tooltip styling. `contentStyle` alone does not color the
// label / item text (Recharts sets those per-entry), so on the dark theme the
// numbers rendered near-black and unreadable — force them here.
const tooltipProps = {
  contentStyle: {
    background: "#211c18",
    border: "1px solid rgba(244,239,232,0.16)",
    borderRadius: 12,
    boxShadow: "0 10px 30px rgba(0,0,0,0.55)",
    padding: "8px 12px",
  },
  itemStyle: { color: PAPER, fontSize: 12, padding: 0 },
  labelStyle: { color: MUTED, fontSize: 11, marginBottom: 4 },
  wrapperStyle: { outline: "none", zIndex: 20 },
} as const;

type StickyTooltip = {
  label?: string;
  payload: unknown[];
  coordinate?: { x: number; y: number };
};

/**
 * Recharts tooltips are hover-driven: on a phone there is no hover, so a tap
 * shows the value only while the finger is down and it vanishes the instant
 * you lift it — often before it's been read. This freezes whatever was
 * tapped for `ms`, then lets the chart fall back to its normal behavior.
 */
function useStickyTooltip(ms = 4000) {
  const [sticky, setSticky] = useState<StickyTooltip | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function show(entry: StickyTooltip) {
    setSticky(entry);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setSticky(null), ms);
  }

  return { sticky, show };
}

export function DashboardPanel({
  workouts,
  extraAthletes = [],
  periodActive = false,
  singleAthlete = false,
  periodLabel = "",
}: {
  workouts: Workout[];
  extraAthletes?: string[];
  /** A period filter is applied — hide the fixed "atual vs anterior" blocks. */
  periodActive?: boolean;
  /** A single athlete is selected — hide the per-athlete grid (redundant). */
  singleAthlete?: boolean;
  /** "nesta semana" / "neste mês" / … — captions Core and Cardio to the filter. */
  periodLabel?: string;
}) {
  const stats = computeStats(workouts, new Date(), extraAthletes);
  const weekDelta = deltaPct(stats.week.minutes, stats.lastWeek.minutes);
  const monthDelta = deltaPct(stats.month.count, stats.lastMonth.count);

  const intensityData = (["forte", "medio", "leve"] as const).map((key) => ({
    name: INTENSITY_LABEL[key],
    value: stats.byIntensity[key],
    color: key === "forte" ? ACCENT : key === "medio" ? WARN : OK,
  }));

  const focusData = [
    { name: "Pernas", minutes: stats.byFocus.pernas.minutes, count: stats.byFocus.pernas.count },
    { name: "Braços", minutes: stats.byFocus.bracos.minutes, count: stats.byFocus.bracos.count },
  ];

  // One independent 4s "stay visible after tap" timer per chart.
  const volumeTip = useStickyTooltip();
  const monthsTip = useStickyTooltip();
  const durationTip = useStickyTooltip();
  const coreEvolutionTip = useStickyTooltip();
  const intensityTip = useStickyTooltip();
  const focusTip = useStickyTooltip();
  const muscleGroupTip = useStickyTooltip();

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 gap-2">
        <Kpi label="Treinos" value={String(stats.all.count)} hint="total no diário" />
        <Kpi
          label="Horas"
          value={formatHours(stats.all.minutes)}
          hint={formatDuration(stats.all.minutes)}
        />
        <Kpi label="Média" value={formatDuration(stats.avgDuration)} hint="por sessão" />
        <Kpi
          label="Frequência"
          value={stats.sessionsPerWeek.toFixed(1).replace(".", ",")}
          hint="treinos / semana"
        />
      </section>

      {!periodActive && (
        <Card className="p-4">
          <p className="text-2xs font-medium uppercase tracking-widest text-muted-foreground">
            Esta semana
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <p className="font-display text-3xl tabular-nums leading-none">{stats.week.count}</p>
              <p className="mt-1 text-sm text-muted-foreground">sessões</p>
            </div>
            <div>
              <p className="font-display text-3xl tabular-nums leading-none">
                {formatDuration(stats.week.minutes)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">em treino</p>
            </div>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Volume semanal <Delta value={weekDelta} /> em relação à semana passada
            {stats.lastWeek.count
              ? ` (${stats.lastWeek.count} treinos, ${formatDuration(stats.lastWeek.minutes)})`
              : " (sem treinos na semana anterior)"}
            .
          </p>
        </Card>
      )}

      <ChartBlock title="Volume semanal" subtitle="minutos nas últimas 8 semanas">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={stats.weeks}
            barSize={18}
            onClick={(state) => {
              if (state?.activePayload) {
                volumeTip.show({
                  label: state.activeLabel,
                  payload: state.activePayload,
                  coordinate: state.activeCoordinate,
                });
              }
            }}
          >
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="label" tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip
              {...tooltipProps}
              active={volumeTip.sticky ? true : false}
              payload={volumeTip.sticky ? (volumeTip.sticky.payload as never) : undefined}
              label={volumeTip.sticky ? volumeTip.sticky.label : undefined}
              coordinate={volumeTip.sticky ? volumeTip.sticky.coordinate : undefined}
              formatter={(value) => [`${Number(value)} min`, "Volume"]}
            />
            <Bar dataKey="minutes" fill={PAPER} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartBlock>

      <ChartBlock title="Evolução mensal" subtitle="minutos por mês, últimos 6 meses">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={stats.months}
            barSize={22}
            onClick={(state) => {
              if (state?.activePayload) {
                monthsTip.show({
                  label: state.activeLabel,
                  payload: state.activePayload,
                  coordinate: state.activeCoordinate,
                });
              }
            }}
          >
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="label" tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip
              {...tooltipProps}
              active={monthsTip.sticky ? true : false}
              payload={monthsTip.sticky ? (monthsTip.sticky.payload as never) : undefined}
              label={monthsTip.sticky ? monthsTip.sticky.label : undefined}
              coordinate={monthsTip.sticky ? monthsTip.sticky.coordinate : undefined}
              formatter={(value) => [`${Number(value)} min`, "Volume"]}
            />
            <Bar dataKey="minutes" fill={ACCENT} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartBlock>

      <ChartBlock title="Duração por sessão" subtitle="últimos treinos">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart
            data={stats.recent}
            onClick={(state) => {
              if (state?.activePayload) {
                durationTip.show({
                  label: state.activeLabel,
                  payload: state.activePayload,
                  coordinate: state.activeCoordinate,
                });
              }
            }}
          >
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="date" tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip
              {...tooltipProps}
              active={durationTip.sticky ? true : false}
              payload={durationTip.sticky ? (durationTip.sticky.payload as never) : undefined}
              label={durationTip.sticky ? durationTip.sticky.label : undefined}
              coordinate={durationTip.sticky ? durationTip.sticky.coordinate : undefined}
              formatter={(value) => [`${Number(value)} min`, "Duração"]}
            />
            <Line
              type="monotone"
              dataKey="minutes"
              stroke={ACCENT}
              strokeWidth={2}
              dot={{ r: 3, fill: ACCENT, stroke: INK, strokeWidth: 1 }}
              activeDot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartBlock>

      <ChartBlock title="Core — evolução" subtitle="repetições por semana, últimas 8 semanas">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={stats.weeks}
            barSize={18}
            onClick={(state) => {
              if (state?.activePayload) {
                coreEvolutionTip.show({
                  label: state.activeLabel,
                  payload: state.activePayload,
                  coordinate: state.activeCoordinate,
                });
              }
            }}
          >
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="label" tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip
              {...tooltipProps}
              active={coreEvolutionTip.sticky ? true : false}
              payload={coreEvolutionTip.sticky ? (coreEvolutionTip.sticky.payload as never) : undefined}
              label={coreEvolutionTip.sticky ? coreEvolutionTip.sticky.label : undefined}
              coordinate={coreEvolutionTip.sticky ? coreEvolutionTip.sticky.coordinate : undefined}
              formatter={(value) => [`${Number(value)} reps`, "Core"]}
            />
            <Bar dataKey="coreReps" fill={OK} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartBlock>

      <ChartBlock title="Intensidade" subtitle="distribuição das sessões">
        <div className="flex items-center gap-4">
          <div className="h-40 w-40 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={intensityData}
                  dataKey="value"
                  innerRadius={38}
                  outerRadius={62}
                  stroke="none"
                  onClick={(entry) => {
                    intensityTip.show({
                      label: entry.name,
                      payload: [{ name: entry.name, value: entry.value }],
                      coordinate: { x: 80, y: 80 },
                    });
                  }}
                >
                  {intensityData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  {...tooltipProps}
                  active={intensityTip.sticky ? true : false}
                  payload={intensityTip.sticky ? (intensityTip.sticky.payload as never) : undefined}
                  label={intensityTip.sticky ? intensityTip.sticky.label : undefined}
                  coordinate={intensityTip.sticky ? intensityTip.sticky.coordinate : undefined}
                  formatter={(value, name) => [
                    `${Number(value)} ${Number(value) === 1 ? "sessão" : "sessões"}`,
                    name,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="space-y-2 text-sm">
            {intensityData.map((row) => (
              <li key={row.name} className="flex items-center gap-2">
                <span className="size-2 rounded-full" style={{ background: row.color }} />
                <span className="text-muted-foreground">{row.name}</span>
                <span className="ml-auto tabular-nums">{row.value}</span>
              </li>
            ))}
          </ul>
        </div>
      </ChartBlock>

      <ChartBlock title="Pernas vs braços" subtitle="minutos acumulados">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart
            data={focusData}
            layout="vertical"
            barSize={22}
            onClick={(state) => {
              if (state?.activePayload) {
                focusTip.show({
                  label: state.activeLabel,
                  payload: state.activePayload,
                  coordinate: state.activeCoordinate,
                });
              }
            }}
          >
            <CartesianGrid horizontal={false} stroke={GRID} />
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: MUTED, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={64}
            />
            <Tooltip
              {...tooltipProps}
              active={focusTip.sticky ? true : false}
              payload={focusTip.sticky ? (focusTip.sticky.payload as never) : undefined}
              label={focusTip.sticky ? focusTip.sticky.label : undefined}
              coordinate={focusTip.sticky ? focusTip.sticky.coordinate : undefined}
              formatter={(value) => [`${Number(value)} min`, "Volume"]}
            />
            <Bar dataKey="minutes" fill={PAPER} radius={[0, 8, 8, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          {focusData.map((row) => (
            <p key={row.name} className="text-muted-foreground">
              <span className="text-foreground tabular-nums">{row.count}</span>{" "}
              {row.count === 1 ? "sessão" : "sessões"} · {row.name.toLowerCase()}
            </p>
          ))}
        </div>
      </ChartBlock>

      {stats.byMuscleGroup.length === 0 ? null : (
        <ChartBlock
          title="Grupo muscular"
          subtitle={`sessões por grupo${periodActive ? ` ${periodLabel}` : ""}`}
        >
          <ResponsiveContainer width="100%" height={Math.max(140, stats.byMuscleGroup.length * 36)}>
            <BarChart
              data={stats.byMuscleGroup}
              layout="vertical"
              barSize={18}
              onClick={(state) => {
                if (state?.activePayload) {
                  muscleGroupTip.show({
                    label: state.activeLabel,
                    payload: state.activePayload,
                    coordinate: state.activeCoordinate,
                  });
                }
              }}
            >
              <CartesianGrid horizontal={false} stroke={GRID} />
              <XAxis type="number" hide allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: MUTED, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={92}
              />
              <Tooltip
                {...tooltipProps}
                active={muscleGroupTip.sticky ? true : false}
                payload={muscleGroupTip.sticky ? (muscleGroupTip.sticky.payload as never) : undefined}
                label={muscleGroupTip.sticky ? muscleGroupTip.sticky.label : undefined}
                coordinate={muscleGroupTip.sticky ? muscleGroupTip.sticky.coordinate : undefined}
                formatter={(value) => [
                  `${Number(value)} ${Number(value) === 1 ? "sessão" : "sessões"}`,
                  "Grupo",
                ]}
              />
              <Bar dataKey="sessions" fill={WARN} radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <ul className="mt-3 space-y-1.5 text-sm">
            {stats.byMuscleGroup.map((row) => (
              <li key={row.name} className="flex items-center justify-between">
                <span className="text-muted-foreground">{row.name}</span>
                <span className="tabular-nums text-foreground">
                  {row.sessions} {row.sessions === 1 ? "sessão" : "sessões"}
                </span>
              </li>
            ))}
          </ul>
        </ChartBlock>
      )}

      {!periodActive && (
        <section>
          <h2 className="font-display text-xl tracking-tight">Comparativos</h2>
          <p className="mt-1 text-sm text-muted-foreground">Semana, mês e atletas lado a lado.</p>
          <div className="mt-3 space-y-2">
            <CompareRow
              title="Semana atual vs anterior"
              leftLabel="agora"
              rightLabel="passada"
              left={`${stats.week.count} treinos · ${formatDuration(stats.week.minutes)}`}
              right={`${stats.lastWeek.count} treinos · ${formatDuration(stats.lastWeek.minutes)}`}
              delta={weekDelta}
            />
            <CompareRow
              title="Mês atual vs anterior"
              leftLabel="agora"
              rightLabel="passado"
              left={`${stats.month.count} treinos · ${formatDuration(stats.month.minutes)}`}
              right={`${stats.lastMonth.count} treinos · ${formatDuration(stats.lastMonth.minutes)}`}
              delta={monthDelta}
            />
            <CompareRow
              title="Pernas vs braços"
              leftLabel="pernas"
              rightLabel="braços"
              left={`${stats.byFocus.pernas.count} · ${formatDuration(stats.byFocus.pernas.minutes)}`}
              right={`${stats.byFocus.bracos.count} · ${formatDuration(stats.byFocus.bracos.minutes)}`}
              delta={deltaPct(stats.byFocus.pernas.minutes, stats.byFocus.bracos.minutes)}
              deltaSuffix=" de pernas sobre braços"
            />
          </div>
        </section>
      )}

      {!singleAthlete && (
        <section>
          <h2 className="font-display text-xl tracking-tight">Atletas</h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {stats.athletes.map((athlete) => (
              <Card key={athlete.name} className="p-4">
                <p className="text-2xs font-medium uppercase tracking-widest text-muted-foreground">
                  {athlete.name}
                </p>
                <p className="mt-2 font-display text-2xl tabular-nums leading-none">
                  {athlete.sessions}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">sessões</p>
                <p className="mt-3 text-sm text-muted-foreground">
                  Core <span className="tabular-nums text-foreground">{athlete.coreReps}</span> reps
                </p>
                <p className="text-sm text-muted-foreground">
                  <span className="tabular-nums text-foreground">
                    {formatDuration(athlete.minutes)}
                  </span>{" "}
                  em treino
                </p>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section className="grid grid-cols-2 gap-2">
        <Card className="p-4">
          <p className="text-2xs font-medium uppercase tracking-widest text-muted-foreground">
            Core
          </p>
          <p className="mt-2 font-display text-3xl tabular-nums leading-none">
            {stats.all.coreReps}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {periodActive
              ? `reps ${periodLabel}`
              : `reps no total — ${stats.week.coreReps} nesta semana`}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-2xs font-medium uppercase tracking-widest text-muted-foreground">
            Cardio
          </p>
          <p className="mt-2 font-display text-3xl tabular-nums leading-none">
            {formatDuration(stats.all.cardio)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {periodActive
              ? `bike e demais, ${periodLabel}`
              : `bike e demais — ${formatDuration(stats.week.cardio)} nesta semana`}
          </p>
        </Card>
      </section>
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card className="p-3.5">
      <p className="text-2xs font-medium uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-2xl tabular-nums leading-none tracking-tight">{value}</p>
      <p className="mt-1.5 text-xs text-faint">{hint}</p>
    </Card>
  );
}

function ChartBlock({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <Card className="p-4">
      <p className="font-medium text-foreground">{title}</p>
      <p className="mb-3 text-xs text-faint">{subtitle}</p>
      <div className="min-w-0">{children}</div>
    </Card>
  );
}

function Delta({ value }: { value: number }) {
  if (value === 0) return <span className="tabular-nums text-muted-foreground">estável</span>;
  const up = value > 0;
  return (
    <span className={up ? "tabular-nums text-ok" : "tabular-nums text-danger"}>
      {up ? "+" : ""}
      {value}%
    </span>
  );
}

function CompareRow({
  title,
  leftLabel,
  rightLabel,
  left,
  right,
  delta,
  deltaSuffix = "",
}: {
  title: string;
  leftLabel: string;
  rightLabel: string;
  left: string;
  right: string;
  delta: number;
  deltaSuffix?: string;
}) {
  return (
    <Card className="p-4">
      <p className="font-medium">{title}</p>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-2xs uppercase tracking-widest text-faint">{leftLabel}</p>
          <p className="mt-1 text-foreground">{left}</p>
        </div>
        <div>
          <p className="text-2xs uppercase tracking-widest text-faint">{rightLabel}</p>
          <p className="mt-1 text-foreground">{right}</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        <Delta value={delta} />
        {deltaSuffix}
      </p>
    </Card>
  );
}
