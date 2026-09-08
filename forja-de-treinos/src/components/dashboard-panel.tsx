import type { ReactNode } from "react";
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

function tooltipStyle() {
  return {
    background: "#141210",
    border: "1px solid rgba(244,239,232,0.12)",
    borderRadius: 12,
    color: PAPER,
    fontSize: 12,
  };
}

export function DashboardPanel({
  workouts,
  extraAthletes = [],
}: {
  workouts: Workout[];
  extraAthletes?: string[];
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

      <ChartBlock title="Volume semanal" subtitle="minutos nas últimas 8 semanas">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={stats.weeks} barSize={18}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="label" tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip
              contentStyle={tooltipStyle()}
              formatter={(value) => [`${Number(value)} min`, "Volume"]}
            />
            <Bar dataKey="minutes" fill={PAPER} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartBlock>

      <ChartBlock title="Duração por sessão" subtitle="últimos treinos">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={stats.recent}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="date" tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip
              contentStyle={tooltipStyle()}
              formatter={(value) => [`${Number(value)} min`, "Duração"]}
            />
            <Line
              type="monotone"
              dataKey="minutes"
              stroke={ACCENT}
              strokeWidth={2}
              dot={{ r: 3, fill: ACCENT, stroke: INK, strokeWidth: 1 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartBlock>

      <ChartBlock title="Intensidade" subtitle="distribuição das sessões">
        <div className="flex items-center gap-4">
          <div className="h-40 w-40 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={intensityData} dataKey="value" innerRadius={38} outerRadius={62} stroke="none">
                  {intensityData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle()} />
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
          <BarChart data={focusData} layout="vertical" barSize={22}>
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
              contentStyle={tooltipStyle()}
              formatter={(value) => [`${Number(value)} min`, "Volume"]}
            />
            <Bar dataKey="minutes" fill={PAPER} radius={[0, 8, 8, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          {focusData.map((row) => (
            <p key={row.name} className="text-muted-foreground">
              <span className="text-foreground tabular-nums">{row.count}</span> sessões ·{" "}
              {row.name.toLowerCase()}
            </p>
          ))}
        </div>
      </ChartBlock>

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

      <section>
        <h2 className="font-display text-xl tracking-tight">Atletas</h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {stats.athletes.map((athlete) => (
            <Card key={athlete.name} className="p-4">
              <p className="text-2xs font-medium uppercase tracking-widest text-muted-foreground">
                {athlete.name}
              </p>
              <p className="mt-2 font-display text-2xl tabular-nums leading-none">{athlete.sessions}</p>
              <p className="mt-1 text-sm text-muted-foreground">sessões</p>
              <p className="mt-3 text-sm text-muted-foreground">
                Core <span className="tabular-nums text-foreground">{athlete.coreReps}</span> reps
              </p>
              <p className="text-sm text-muted-foreground">
                <span className="tabular-nums text-foreground">{formatDuration(athlete.minutes)}</span> em
                treino
              </p>
            </Card>
          ))}
        </div>
      </section>

      <Card className="p-4">
        <p className="text-2xs font-medium uppercase tracking-widest text-muted-foreground">Cardio</p>
        <p className="mt-2 font-display text-3xl tabular-nums leading-none">
          {formatDuration(stats.all.cardio)}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          bike e demais — {formatDuration(stats.week.cardio)} nesta semana
        </p>
      </Card>
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
