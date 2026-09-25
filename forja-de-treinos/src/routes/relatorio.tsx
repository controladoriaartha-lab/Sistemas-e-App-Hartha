import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Printer } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatDuration, formatHours, formatWeekday, parseDate } from "@/lib/format";
import { buildReport } from "@/lib/report";
import { deltaPct } from "@/lib/stats";
import { INTENSITY_LABEL } from "@/lib/types";
import { sortedWorkouts, useWorkoutStore } from "@/store/workouts";

export const Route = createFileRoute("/relatorio")({
  component: ReportPage,
  validateSearch: (search: Record<string, unknown>): { atleta?: string } => ({
    atleta: typeof search.atleta === "string" && search.atleta ? search.atleta : undefined,
  }),
});

// A4 retrato: 794px de folha, 45px de margem => 704px de area util (= 186mm
// na impressao com margem de 12mm). Os graficos usam essa largura fixa, entao
// a previa na tela e o PDF saem identicos.
const SHEET = 794;
const PAD = 45;
const W = SHEET - PAD * 2;
const HALF = (W - 14) / 2;

const C = {
  ink: "#241f1a",
  muted: "#6b645c",
  faint: "#8a8175",
  line: "rgba(36,31,26,0.14)",
  grid: "rgba(36,31,26,0.09)",
  accent: "#b8511e",
  gold: "#b98a2c",
  green: "#4f6a49",
  paper: "#f4efe8",
};

const TICK = { fill: C.muted, fontSize: 10 };

function Card({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`report-avoid rounded-lg border border-[color:var(--rp-line)] bg-white p-3.5 ${className}`}
    >
      <h3 className="text-[13px] font-semibold leading-tight text-[color:var(--rp-ink)]">
        {title}
      </h3>
      {subtitle && <p className="mb-2 text-[10.5px] text-[color:var(--rp-muted)]">{subtitle}</p>}
      {children}
    </section>
  );
}

function SectionTitle({ n, children }: { n: string; children: ReactNode }) {
  return (
    <div className="mb-3 mt-6 flex items-center gap-2.5">
      <span className="flex size-6 items-center justify-center rounded-full bg-[color:var(--rp-accent)] text-[11px] font-semibold text-white">
        {n}
      </span>
      <h2 className="font-display text-[18px] font-medium tracking-tight text-[color:var(--rp-ink)]">
        {children}
      </h2>
      <span className="h-px flex-1 bg-[color:var(--rp-line)]" />
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="report-avoid rounded-lg border border-[color:var(--rp-line)] bg-white px-3 py-2.5">
      <p className="text-[9.5px] font-semibold uppercase tracking-widest text-[color:var(--rp-muted)]">
        {label}
      </p>
      <p className="mt-1 font-display text-[22px] font-medium leading-none tabular-nums text-[color:var(--rp-ink)]">
        {value}
      </p>
      {hint && <p className="mt-1 text-[10px] text-[color:var(--rp-faint)]">{hint}</p>}
    </div>
  );
}

function Legend({ items }: { items: { color: string; label: string; value?: string }[] }) {
  return (
    <ul className="space-y-1.5 text-[11.5px]">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-2">
          <span className="size-2.5 rounded-full" style={{ background: it.color }} />
          <span className="text-[color:var(--rp-muted)]">{it.label}</span>
          {it.value && <span className="ml-auto font-medium tabular-nums">{it.value}</span>}
        </li>
      ))}
    </ul>
  );
}

function Heatmap({ data }: { data: ReturnType<typeof buildReport> }) {
  const cell = 15;
  const gap = 3;
  const left = 26;
  const top = 16;
  const width = left + data.heatCols * (cell + gap);
  const height = top + 7 * (cell + gap);
  const shade = (minutes: number) => {
    if (minutes <= 0) return "#ece6da";
    const t = Math.min(1, minutes / data.heatMax);
    if (t > 0.75) return "#8f3f14";
    if (t > 0.5) return C.accent;
    if (t > 0.25) return "#d98a58";
    return "#efc09c";
  };
  return (
    <svg width={Math.min(width, W - 28)} height={height} viewBox={`0 0 ${width} ${height}`}>
      {["Seg", "Qua", "Sex", "Dom"].map((d, i) => (
        <text key={d} x={0} y={top + i * 2 * (cell + gap) + cell - 3} fontSize="9" fill={C.muted}>
          {d}
        </text>
      ))}
      {data.heatMonths.map((m) => (
        <text
          key={`${m.col}-${m.label}`}
          x={left + m.col * (cell + gap)}
          y={10}
          fontSize="9"
          fill={C.muted}
        >
          {m.label}
        </text>
      ))}
      {data.heat.map((c) => (
        <rect
          key={c.iso}
          x={left + c.col * (cell + gap)}
          y={top + c.row * (cell + gap)}
          width={cell}
          height={cell}
          rx={3}
          fill={shade(c.minutes)}
        />
      ))}
    </svg>
  );
}

function Delta({ value }: { value: number }) {
  if (value === 0) return <span className="text-[color:var(--rp-muted)]">estável</span>;
  return (
    <span className={value > 0 ? "text-[#4f6a49]" : "text-[#b8402f]"}>
      {value > 0 ? "+" : ""}
      {value}%
    </span>
  );
}

function Sheet({ athlete }: { athlete?: string }) {
  const allWorkouts = useWorkoutStore((s) => s.workouts);
  // Com um atleta escolhido, o relatorio so leva os treinos dele e, nos
  // treinos em dupla, so as linhas de core dele (ou sem dono definido).
  const workouts = useMemo(() => {
    if (!athlete) return allWorkouts;
    return allWorkouts
      .filter((w) => w.athletes.includes(athlete))
      .map((w) => ({
        ...w,
        athletes: [athlete],
        core: w.core.filter((r) => !r.athlete || r.athlete === athlete),
      }));
  }, [allWorkouts, athlete]);
  const data = useMemo(() => buildReport(workouts), [workouts]);
  const { stats } = data;
  const list = useMemo(() => sortedWorkouts(workouts), [workouts]);
  const generated = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  const periodText =
    data.first && data.last
      ? `${format(parseDate(data.first), "dd/MM/yyyy")} a ${format(parseDate(data.last), "dd/MM/yyyy")}`
      : "sem treinos";

  const intensityData = (["forte", "medio", "leve"] as const).map((k) => ({
    name: INTENSITY_LABEL[k],
    value: stats.byIntensity[k],
    color: k === "forte" ? C.accent : k === "medio" ? C.gold : C.green,
  }));
  const focusData = [
    { name: "Pernas", count: stats.byFocus.pernas.count, minutes: stats.byFocus.pernas.minutes },
    { name: "Braços", count: stats.byFocus.bracos.count, minutes: stats.byFocus.bracos.minutes },
  ];
  const share = (n: number) => (stats.all.count ? Math.round((n / stats.all.count) * 100) : 0);
  const weekDelta = deltaPct(stats.week.minutes, stats.lastWeek.minutes);
  const monthDelta = deltaPct(stats.month.count, stats.lastMonth.count);

  return (
    <div
      data-report
      className="report-sheet relative mx-auto bg-[color:var(--rp-paper)] text-[color:var(--rp-ink)] shadow-[0_10px_40px_rgba(0,0,0,0.35)]"
      style={
        {
          width: SHEET,
          padding: PAD,
          "--rp-ink": C.ink,
          "--rp-muted": C.muted,
          "--rp-faint": C.faint,
          "--rp-line": C.line,
          "--rp-accent": C.accent,
          "--rp-paper": "#fbf8f3",
        } as React.CSSProperties
      }
    >
      {/* Cabecalho */}
      <header className="flex items-center gap-5 border-b-2 border-[color:var(--rp-accent)] pb-4">
        <img src="/artha-logo.png" alt="ARTHA" className="h-[74px] w-auto" />
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[color:var(--rp-accent)]">
            {athlete ? `Relatório individual · ${athlete}` : "Relatório do diário de treino"}
          </p>
          <h1 className="font-display text-[30px] font-medium leading-tight tracking-tight">
            Forja de Treinos
          </h1>
          <p className="text-[12px] text-[color:var(--rp-muted)]">
            {periodText} · {stats.all.count} treinos ·{" "}
            {athlete ??
              stats.athletes
                .filter((a) => a.sessions > 0)
                .map((a) => a.name)
                .join(" e ")}
          </p>
        </div>
        <p className="self-start text-right text-[10px] leading-snug text-[color:var(--rp-faint)]">
          Gerado em
          <br />
          {generated}
        </p>
      </header>

      {/* 1. Indicadores */}
      <SectionTitle n="1">Indicadores gerais</SectionTitle>
      <div className="grid grid-cols-4 gap-2.5">
        <Kpi
          label="Treinos"
          value={String(stats.all.count)}
          hint={athlete ? `de ${athlete}` : "no diário todo"}
        />
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
        <Kpi
          label="Constância"
          value={`${data.consistency}%`}
          hint={`${data.activeWeeks} semanas ativas`}
        />
        <Kpi label="Sequência atual" value={`${stats.streak}`} hint="dias seguidos" />
        <Kpi label="Maior sequência" value={`${data.longestStreak}`} hint="dias seguidos" />
        <Kpi label="Semanas fortes" value={`${data.strongWeeks}`} hint="3 ou mais treinos" />
        <Kpi label="Aparelhos" value={`${data.totalMachines}`} hint="no total" />
        <Kpi label="Core" value={`${stats.all.coreReps}`} hint="repetições" />
        <Kpi label="Cardio" value={formatDuration(stats.all.cardio)} hint="no total" />
        <Kpi
          label="Sessão mais longa"
          value={formatDuration(data.longest?.durationMin ?? 0)}
          hint={`menor: ${formatDuration(data.minDuration)}`}
        />
      </div>

      <Card title="Leitura rápida" subtitle="Resumo automático dos seus números" className="mt-3">
        <ul className="space-y-1.5 text-[12px] leading-snug">
          {data.insights.map((t) => (
            <li key={t} className="flex gap-2">
              <span className="mt-[5px] size-1.5 shrink-0 rounded-full bg-[color:var(--rp-accent)]" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </Card>

      {/* 2. Evolucao */}
      <div className="report-break" />
      <SectionTitle n="2">Evolução no tempo</SectionTitle>
      <div className="space-y-3">
        <Card title="Volume semanal" subtitle="Minutos treinados por semana (últimas 20)">
          <BarChart
            width={W - 28}
            height={170}
            data={data.weeksShown}
            margin={{ top: 16, right: 4, left: 4, bottom: 0 }}
          >
            <CartesianGrid vertical={false} stroke={C.grid} />
            <XAxis dataKey="label" tick={TICK} axisLine={false} tickLine={false} interval={0} />
            <YAxis hide />
            <Bar dataKey="minutes" fill={C.ink} radius={[3, 3, 0, 0]} isAnimationActive={false}>
              <LabelList
                dataKey="minutes"
                position="top"
                fontSize={8.5}
                fill={C.muted}
                formatter={(v: number) => (v ? v : "")}
              />
            </Bar>
          </BarChart>
        </Card>

        <div className="grid grid-cols-2 gap-3.5">
          <Card title="Evolução mensal" subtitle="Minutos por mês">
            <BarChart
              width={HALF - 28}
              height={160}
              data={data.months}
              margin={{ top: 16, right: 4, left: 4, bottom: 0 }}
            >
              <CartesianGrid vertical={false} stroke={C.grid} />
              <XAxis dataKey="label" tick={TICK} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Bar
                dataKey="minutes"
                fill={C.accent}
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
              >
                <LabelList dataKey="minutes" position="top" fontSize={9} fill={C.muted} />
              </Bar>
            </BarChart>
          </Card>
          <Card title="Treinos por mês" subtitle="Quantidade de sessões">
            <BarChart
              width={HALF - 28}
              height={160}
              data={data.months}
              margin={{ top: 16, right: 4, left: 4, bottom: 0 }}
            >
              <CartesianGrid vertical={false} stroke={C.grid} />
              <XAxis dataKey="label" tick={TICK} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Bar dataKey="count" fill={C.gold} radius={[3, 3, 0, 0]} isAnimationActive={false}>
                <LabelList dataKey="count" position="top" fontSize={9} fill={C.muted} />
              </Bar>
            </BarChart>
          </Card>
        </div>

        <Card title="Duração por sessão" subtitle="Minutos de cada treino, do primeiro ao último">
          <LineChart
            width={W - 28}
            height={160}
            data={data.durationSeries}
            margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
          >
            <CartesianGrid vertical={false} stroke={C.grid} />
            <XAxis
              dataKey="label"
              tick={TICK}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={26}
            />
            <YAxis hide domain={["dataMin - 10", "dataMax + 10"]} />
            <Line
              type="monotone"
              dataKey="minutes"
              stroke={C.accent}
              strokeWidth={2}
              dot={{ r: 2.5, fill: C.accent, stroke: "#fff", strokeWidth: 1 }}
              isAnimationActive={false}
            />
          </LineChart>
        </Card>

        <Card
          title="Calendário de treinos"
          subtitle="Cada quadrado é um dia — quanto mais escuro, mais minutos treinados (últimas 26 semanas)"
        >
          <Heatmap data={data} />
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-[color:var(--rp-muted)]">
            <span>menos</span>
            {["#ece6da", "#efc09c", "#d98a58", C.accent, "#8f3f14"].map((c) => (
              <span key={c} className="size-3 rounded-[3px]" style={{ background: c }} />
            ))}
            <span>mais</span>
          </div>
        </Card>
      </div>

      {/* 3. Perfil do treino */}
      <div className="report-break" />
      <SectionTitle n="3">Perfil do treino</SectionTitle>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3.5">
          <Card title="Dia da semana" subtitle="Em que dias você mais treina">
            <BarChart
              width={HALF - 28}
              height={160}
              data={data.weekday}
              margin={{ top: 16, right: 4, left: 4, bottom: 0 }}
            >
              <CartesianGrid vertical={false} stroke={C.grid} />
              <XAxis dataKey="label" tick={TICK} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Bar dataKey="count" fill={C.ink} radius={[3, 3, 0, 0]} isAnimationActive={false}>
                <LabelList dataKey="count" position="top" fontSize={9} fill={C.muted} />
              </Bar>
            </BarChart>
          </Card>
          <Card title="Intensidade" subtitle="Distribuição das sessões">
            <div className="flex items-center gap-3">
              <PieChart width={130} height={130}>
                <Pie
                  data={intensityData}
                  dataKey="value"
                  innerRadius={36}
                  outerRadius={60}
                  stroke="none"
                  isAnimationActive={false}
                >
                  {intensityData.map((e) => (
                    <Cell key={e.name} fill={e.color} />
                  ))}
                </Pie>
              </PieChart>
              <div className="flex-1">
                <Legend
                  items={intensityData.map((e) => ({
                    color: e.color,
                    label: e.name,
                    value: `${e.value} (${share(e.value)}%)`,
                  }))}
                />
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-2 gap-3.5">
          <Card title="Pernas vs braços" subtitle="Sessões e tempo por foco">
            <BarChart
              width={HALF - 28}
              height={110}
              data={focusData}
              layout="vertical"
              margin={{ top: 4, right: 40, left: 0, bottom: 0 }}
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ ...TICK, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <Bar
                dataKey="minutes"
                fill={C.ink}
                radius={[0, 4, 4, 0]}
                barSize={18}
                isAnimationActive={false}
              >
                <LabelList
                  dataKey="minutes"
                  position="right"
                  fontSize={10}
                  fill={C.muted}
                  formatter={(v: number) => formatDuration(v)}
                />
              </Bar>
            </BarChart>
            <p className="mt-1 text-[11px] text-[color:var(--rp-muted)]">
              {focusData[0].count} sessões de pernas · {focusData[1].count} de braços · média{" "}
              {data.avgByFocus.pernas} / {data.avgByFocus.bracos} min
            </p>
          </Card>
          <Card
            title="Grupo muscular"
            subtitle="Sessões por grupo (inclui o que foi anotado em Extra)"
          >
            <BarChart
              width={HALF - 28}
              height={Math.max(110, stats.byMuscleGroup.length * 24 + 10)}
              data={stats.byMuscleGroup}
              layout="vertical"
              margin={{ top: 2, right: 26, left: 0, bottom: 0 }}
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ ...TICK, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={84}
                interval={0}
              />
              <Bar
                dataKey="sessions"
                fill={C.gold}
                radius={[0, 4, 4, 0]}
                barSize={13}
                isAnimationActive={false}
              >
                <LabelList dataKey="sessions" position="right" fontSize={9.5} fill={C.muted} />
              </Bar>
            </BarChart>
          </Card>
        </div>

        <Card
          title="Core — repetições por semana"
          subtitle="Séries × repetições somadas em cada semana (últimas 20)"
        >
          <BarChart
            width={W - 28}
            height={150}
            data={data.weeksShown}
            margin={{ top: 16, right: 4, left: 4, bottom: 0 }}
          >
            <CartesianGrid vertical={false} stroke={C.grid} />
            <XAxis dataKey="label" tick={TICK} axisLine={false} tickLine={false} interval={0} />
            <YAxis hide />
            <Bar dataKey="coreReps" fill={C.green} radius={[3, 3, 0, 0]} isAnimationActive={false}>
              <LabelList
                dataKey="coreReps"
                position="top"
                fontSize={8.5}
                fill={C.muted}
                formatter={(v: number) => (v ? v : "")}
              />
            </Bar>
          </BarChart>
        </Card>
      </div>

      {/* 4. Comparativos */}
      <div className="report-break" />
      <SectionTitle n="4">Comparativos</SectionTitle>
      <div className="space-y-3">
        {!athlete && (
          <Card title="Comparação entre atletas" subtitle="Desempenho de cada um">
            <table className="w-full text-[11.5px]">
              <thead>
                <tr className="border-b border-[color:var(--rp-line)] text-left text-[10px] uppercase tracking-wider text-[color:var(--rp-muted)]">
                  <th className="py-1.5 font-semibold">Atleta</th>
                  <th className="py-1.5 text-right font-semibold">Sessões</th>
                  <th className="py-1.5 text-right font-semibold">Tempo</th>
                  <th className="py-1.5 text-right font-semibold">Média</th>
                  <th className="py-1.5 text-right font-semibold">Core (reps)</th>
                </tr>
              </thead>
              <tbody>
                {stats.athletes.map((a) => (
                  <tr key={a.name} className="border-b border-[color:var(--rp-line)] last:border-0">
                    <td className="py-1.5 font-medium">{a.name}</td>
                    <td className="py-1.5 text-right tabular-nums">{a.sessions}</td>
                    <td className="py-1.5 text-right tabular-nums">{formatDuration(a.minutes)}</td>
                    <td className="py-1.5 text-right tabular-nums">
                      {formatDuration(a.sessions ? Math.round(a.minutes / a.sessions) : 0)}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{a.coreReps}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-3.5">
          <Card title="Semana atual vs anterior">
            <p className="text-[12px]">
              Agora: <b>{stats.week.count}</b> {stats.week.count === 1 ? "treino" : "treinos"} ·{" "}
              {formatDuration(stats.week.minutes)}
            </p>
            <p className="text-[12px]">
              Anterior: <b>{stats.lastWeek.count}</b>{" "}
              {stats.lastWeek.count === 1 ? "treino" : "treinos"} ·{" "}
              {formatDuration(stats.lastWeek.minutes)}
            </p>
            <p className="mt-1 text-[12px]">
              Tempo: <Delta value={weekDelta} />
            </p>
          </Card>
          <Card title="Mês atual vs anterior">
            <p className="text-[12px]">
              Agora: <b>{stats.month.count}</b> {stats.month.count === 1 ? "treino" : "treinos"} ·{" "}
              {formatDuration(stats.month.minutes)}
            </p>
            <p className="text-[12px]">
              Anterior: <b>{stats.lastMonth.count}</b>{" "}
              {stats.lastMonth.count === 1 ? "treino" : "treinos"} ·{" "}
              {formatDuration(stats.lastMonth.minutes)}
            </p>
            <p className="mt-1 text-[12px]">
              Treinos: <Delta value={monthDelta} />
            </p>
          </Card>
        </div>

        <div className="grid grid-cols-2 gap-3.5">
          <Card title="Cardio por tipo" subtitle="Minutos e sessões">
            {data.cardioByKind.length ? (
              <Legend
                items={data.cardioByKind.map((c) => ({
                  color: C.accent,
                  label: `${c.kind} · ${c.sessions}×`,
                  value: formatDuration(c.minutes),
                }))}
              />
            ) : (
              <p className="text-[11.5px] text-[color:var(--rp-muted)]">
                Nenhum cardio registrado.
              </p>
            )}
          </Card>
          <Card title="Core por exercício" subtitle="Repetições acumuladas">
            {data.coreByExercise.length ? (
              <Legend
                items={data.coreByExercise.slice(0, 8).map((c) => ({
                  color: C.green,
                  label: c.exercise,
                  value: `${c.reps}`,
                }))}
              />
            ) : (
              <p className="text-[11.5px] text-[color:var(--rp-muted)]">Nenhum core registrado.</p>
            )}
          </Card>
        </div>
      </div>

      {/* 5. Registro completo */}
      <div className="report-break" />
      <SectionTitle n="5">Registro completo dos treinos</SectionTitle>
      <table className="w-full border-collapse text-[10.5px] leading-snug">
        <thead>
          <tr className="border-b-2 border-[color:var(--rp-ink)] text-left text-[9.5px] uppercase tracking-wider text-[color:var(--rp-muted)]">
            <th className="w-[92px] py-1.5 pr-2 font-semibold">Data</th>
            <th className="w-[52px] py-1.5 pr-2 font-semibold">Foco</th>
            <th className="w-[62px] py-1.5 pr-2 font-semibold">Duração</th>
            <th className="w-[50px] py-1.5 pr-2 font-semibold">Int.</th>
            <th className="py-1.5 font-semibold">Detalhes</th>
          </tr>
        </thead>
        <tbody>
          {list.map((w) => {
            const details: string[] = [];
            if (w.machines)
              details.push(`Musculação: ${w.machines} aparelhos (${w.sets}×${w.reps})`);
            if (w.muscleGroups.length) details.push(`Grupo: ${w.muscleGroups.join(", ")}`);
            if (w.extras) details.push(`Extra: ${w.extras}`);
            for (const r of w.core)
              details.push(
                `Core: ${r.exercise} (${r.sets}×${r.reps})${r.athlete ? ` ${r.athlete}` : ""}`,
              );
            for (const c of w.cardio) details.push(`Cardio: ${c.kind} (${c.minutes} min)`);
            if (w.notes) details.push(`Nota: ${w.notes}`);
            return (
              <tr
                key={w.id}
                className="report-avoid border-b border-[color:var(--rp-line)] align-top"
              >
                <td className="py-1.5 pr-2">
                  <b className="tabular-nums">{format(parseDate(w.date), "dd/MM/yyyy")}</b>
                  <br />
                  <span className="text-[color:var(--rp-muted)]">{formatWeekday(w.date)}</span>
                </td>
                <td className="py-1.5 pr-2 font-medium">{w.focusLabel}</td>
                <td className="py-1.5 pr-2 tabular-nums">{formatDuration(w.durationMin)}</td>
                <td className="py-1.5 pr-2">{INTENSITY_LABEL[w.intensity]}</td>
                <td className="py-1.5 text-[color:var(--rp-ink)]">
                  <span className="text-[color:var(--rp-muted)]">{w.athletes.join(", ")}</span>
                  {details.map((d) => (
                    <span key={d} className="block">
                      {d}
                    </span>
                  ))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <footer className="mt-6 flex items-center justify-between border-t border-[color:var(--rp-line)] pt-3 text-[10px] text-[color:var(--rp-faint)]">
        <span>ARTHA · Forja de Treinos</span>
        <span>
          {stats.all.count} treinos · gerado em {generated}
        </span>
      </footer>
    </div>
  );
}

function ReportPage() {
  const { atleta: athlete } = Route.useSearch();
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    setRoot(document.body);
    document.body.classList.add("report-open");
    const fit = () => setZoom(Math.min(1, (window.innerWidth - 16) / SHEET));
    fit();
    window.addEventListener("resize", fit);
    return () => {
      document.body.classList.remove("report-open");
      window.removeEventListener("resize", fit);
    };
  }, []);

  if (!root) return null;

  return createPortal(
    <div id="report-root" className="fixed inset-0 z-[80] overflow-auto bg-[#2b2622]">
      <div className="report-toolbar sticky top-0 z-10 flex items-center gap-3 bg-[#141210]/95 px-4 py-3 backdrop-blur-md">
        <Link
          to="/dashboard"
          className="flex h-11 items-center gap-2 rounded-md bg-[#1c1916] px-4 text-[15px] font-medium text-[#f4efe8]"
        >
          <ArrowLeft className="size-5" />
          Voltar
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-md bg-[#f4efe8] px-4 text-[15px] font-semibold text-[#0c0b0a]"
        >
          <Printer className="size-5" />
          Imprimir / Salvar PDF
        </button>
      </div>
      <p className="report-toolbar px-4 pt-3 text-center text-[13px] text-[#9a9086]">
        Página A4 em retrato. Na janela de impressão, escolha “Salvar como PDF”.
      </p>
      <div className="py-4" style={{ zoom }}>
        <Sheet athlete={athlete} />
      </div>
    </div>,
    root,
  );
}
