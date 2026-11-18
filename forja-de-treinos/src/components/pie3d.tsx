import { useId } from "react";

export type Pie3DSlice = { name: string; value: number; color: string };

/** Mistura dois #rrggbb (t = 0 fica em `a`, t = 1 em `b`). */
function mix(a: string, b: string, t: number) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Pizza 3D: o disco visto de cima e inclinado, com a parede lateral (espessura)
 * mais escura, brilho em cada fatia e o percentual escrito em cima. Vale para a
 * tela e para o PDF (so SVG, sem biblioteca de grafico).
 */
export function Pie3D({
  data,
  className,
  labelColor = "#ffffff",
}: {
  data: Pie3DSlice[];
  className?: string;
  labelColor?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const W = 240;
  const H = 170;
  const cx = W / 2;
  const cy = 66;
  const rx = 100;
  const ry = 56;
  const depth = 28;
  const TAU = Math.PI * 2;

  const slices = data.filter((d) => d.value > 0);
  const total = slices.reduce((s, d) => s + d.value, 0);
  const pt = (a: number, dy = 0): [number, number] => [cx + rx * Math.cos(a), cy + ry * Math.sin(a) + dy];
  const f = (n: number) => n.toFixed(2);

  let angle = -Math.PI / 2;
  const parts = slices.map((d, i) => {
    const sweep = (d.value / total) * TAU;
    const a0 = angle;
    const a1 = angle + sweep;
    angle = a1;
    const [x0, y0] = pt(a0);
    const [x1, y1] = pt(a1);
    const full = sweep >= TAU - 1e-6;
    const top = full
      ? `M ${f(cx - rx)} ${f(cy)} A ${rx} ${ry} 0 1 1 ${f(cx + rx)} ${f(cy)} A ${rx} ${ry} 0 1 1 ${f(cx - rx)} ${f(cy)} Z`
      : `M ${f(cx)} ${f(cy)} L ${f(x0)} ${f(y0)} A ${rx} ${ry} 0 ${sweep > Math.PI ? 1 : 0} 1 ${f(x1)} ${f(y1)} Z`;
    // parede lateral: so a parte da frente do disco (angulos de 0 a PI) aparece
    const s = Math.max(a0, 0);
    const e = Math.min(a1, Math.PI);
    let wall: string | null = null;
    if (e > s + 1e-6) {
      const [sx, sy] = pt(s);
      const [ex, ey] = pt(e);
      wall = `M ${f(sx)} ${f(sy)} L ${f(sx)} ${f(sy + depth)} A ${rx} ${ry} 0 0 1 ${f(ex)} ${f(ey + depth)} L ${f(ex)} ${f(ey)} A ${rx} ${ry} 0 0 0 ${f(sx)} ${f(sy)} Z`;
    }
    const mid = (a0 + a1) / 2;
    const [lx, ly] = [cx + rx * 0.62 * Math.cos(mid), cy + ry * 0.62 * Math.sin(mid)];
    return {
      key: `${d.name}-${i}`,
      top,
      wall,
      lx,
      ly,
      pct: Math.round((d.value / total) * 100),
      color: d.color,
      showLabel: d.value / total >= 0.07,
    };
  });

  if (slices.length === 0) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-label="Sem dados">
        <ellipse cx={cx} cy={cy + depth} rx={rx} ry={ry} fill="#8a8175" opacity={0.5} />
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#cfc6b8" />
      </svg>
    );
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-label="Grafico de pizza 3D">
      <defs>
        {parts.map((p, i) => (
          <linearGradient key={p.key} id={`${uid}-g${i}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={mix(p.color, "#ffffff", 0.35)} />
            <stop offset="55%" stopColor={p.color} />
            <stop offset="100%" stopColor={mix(p.color, "#000000", 0.18)} />
          </linearGradient>
        ))}
      </defs>
      <ellipse cx={cx} cy={cy + depth + 10} rx={rx * 0.95} ry={ry * 0.5} fill="#000000" opacity={0.18} />
      {parts.map((p) =>
        p.wall ? <path key={`${p.key}-w`} d={p.wall} fill={mix(p.color, "#000000", 0.38)} /> : null,
      )}
      {parts.map((p, i) => (
        <path
          key={`${p.key}-t`}
          d={p.top}
          fill={`url(#${uid}-g${i})`}
          stroke="rgba(255,255,255,0.55)"
          strokeWidth={1.2}
          strokeLinejoin="round"
        />
      ))}
      {parts.map((p) =>
        p.showLabel ? (
          <text
            key={`${p.key}-l`}
            x={p.lx}
            y={p.ly}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={17}
            fontWeight={700}
            fill={labelColor}
            stroke="rgba(0,0,0,0.35)"
            strokeWidth={2.5}
            paintOrder="stroke"
          >
            {p.pct}%
          </text>
        ) : null,
      )}
    </svg>
  );
}
