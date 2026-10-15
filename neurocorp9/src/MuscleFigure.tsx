import { useRef, useState } from "react";
import { REGION_LABEL } from "./muscles";
import type { RegionId } from "./muscles";
import { IMAGE_SIZE, REGION_SHAPES } from "./muscle-regions";

type Levels = Partial<Record<RegionId, number>>;
export type Vista = "frente" | "costas" | "ambos";

const toPoints = (pts: [number, number][]) => pts.map(([x, y]) => `${x},${y}`).join(" ");
const overlay = (r: number) => 0.5 + 0.5 * r;

export function MuscleFigure({ levels, aura }: { levels: Levels; aura: number }) {
  const [vista, setVista] = useState<Vista>("frente");
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const box = useRef<HTMLDivElement>(null);
  const { width, height } = IMAGE_SIZE;
  const worked = (Object.keys(REGION_SHAPES) as RegionId[]).filter((id) => levels[id] !== undefined);
  const ranking = Object.entries(levels)
    .map(([id, v]) => ({ id: id as RegionId, v: v ?? 0 }))
    .sort((a, b) => b.v - a.v);

  const half = width / 2;
  const vb =
    vista === "ambos"
      ? `0 0 ${width} ${height}`
      : vista === "frente"
        ? `0 0 ${half} ${height}`
        : `${half} 0 ${half} ${height}`;

  const mover = (e: React.PointerEvent) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    setTilt({
      x: ((e.clientY - r.top) / r.height - 0.5) * -8,
      y: ((e.clientX - r.left) / r.width - 0.5) * 10,
    });
  };

  return (
    <div className="figure">
      <div className="seg" role="tablist" aria-label="Vista do corpo">
        {(["frente", "costas", "ambos"] as Vista[]).map((v) => (
          <button key={v} role="tab" aria-selected={vista === v} className={vista === v ? "on" : ""} onClick={() => setVista(v)}>
            {v === "ambos" ? "Frente e costas" : v === "frente" ? "Frente" : "Costas"}
          </button>
        ))}
      </div>

      <div
        ref={box}
        className="figure-stage"
        onPointerMove={mover}
        onPointerLeave={() => setTilt({ x: 0, y: 0 })}
        style={{ transform: `perspective(900px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}
      >
        <div className="stage-bg" />
        <div className="stage-grid" />
        <div className="stage-ring r1" />
        <div className="stage-ring r2" />
        <div className="figure-aura" style={{ opacity: 0.2 + aura * 0.8 }} />
        <div className="stage-floor" />
        <svg viewBox={vb} className="figure-svg" role="img" aria-label="Anatomia com os músculos trabalhados em destaque">
          <defs>
            <filter id="jf-pale" colorInterpolationFilters="sRGB">
              <feColorMatrix type="saturate" values="0" />
              <feComponentTransfer>
                <feFuncR type="linear" slope="0.55" intercept="0.42" />
                <feFuncG type="linear" slope="0.58" intercept="0.46" />
                <feFuncB type="linear" slope="0.55" intercept="0.5" />
              </feComponentTransfer>
            </filter>
            <filter id="jf-hot" colorInterpolationFilters="sRGB">
              <feColorMatrix type="matrix" values="1.15 0 0 0 -0.08  0 0.78 0 0 -0.02  0 0 0.75 0 -0.02  0 0 0 1 0" />
            </filter>
            <filter id="jf-glow" x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur stdDeviation="9" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="jf-bloom" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="14" />
            </filter>
            <filter id="jf-soft" filterUnits="userSpaceOnUse" x="0" y="0" width={width} height={height}>
              <feGaussianBlur stdDeviation="3.5" />
            </filter>
            {worked.map((id) => (
              <mask id={`jf-mask-${id}`} key={id} maskUnits="userSpaceOnUse" x="0" y="0" width={width} height={height}>
                <g fill="#fff" filter="url(#jf-soft)">
                  {REGION_SHAPES[id].flatMap((s, i) => [
                    <polygon key={`${i}l`} points={toPoints(s.pts)} />,
                    <polygon key={`${i}r`} points={toPoints(s.pts)} transform={`translate(${2 * s.xc} 0) scale(-1 1)`} />,
                  ])}
                </g>
              </mask>
            ))}
          </defs>

          <image href="/musculos.webp" width={width} height={height} filter="url(#jf-pale)" />
          <g filter="url(#jf-bloom)" opacity="0.55">
            {worked.map((id) => (
              <g key={`b-${id}`} mask={`url(#jf-mask-${id})`} opacity={overlay(levels[id] ?? 0)}>
                <image href="/musculos.webp" width={width} height={height} />
              </g>
            ))}
          </g>
          {worked.map((id) => {
            const r = levels[id] ?? 0;
            return (
              <g key={id} mask={`url(#jf-mask-${id})`} opacity={overlay(r)} filter={r >= 0.7 ? "url(#jf-hot)" : undefined}>
                <image href="/musculos.webp" width={width} height={height} />
              </g>
            );
          })}
        </svg>
      </div>

      <ul className="ranking">
        {ranking.length === 0 && <li className="muted">Registre um movimento e os músculos acendem aqui.</li>}
        {ranking.slice(0, 6).map(({ id, v }) => (
          <li key={id}>
            <span>{REGION_LABEL[id]}</span>
            <div className="rk-track">
              <div className="rk-fill" style={{ width: `${Math.max(6, v * 100)}%` }} />
            </div>
            <b>{Math.round(v * 100)}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}
