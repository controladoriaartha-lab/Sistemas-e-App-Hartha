import { useEffect, useRef, useState } from "react";

/** Cores e comportamento comuns dos graficos do Painel (e de outros blocos com grafico). */
// Recharts needs literal colors (SVG fill/stroke), not CSS variables, so
// chart colors can't just ride the theme's CSS custom properties like the
// rest of the app does. Same "paper/ink" duality as everywhere else: a
// paper-colored bar pops on the dark background, an ink-colored one pops on
// the light one.
export const CHART_COLORS = {
  dark: {
    ink: "#0c0b0a",
    barPrimary: "#f4efe8",
    muted: "#9a9086",
    grid: "rgba(244,239,232,0.08)",
    accent: "#c45c26",
    warn: "#c4a574",
    ok: "#7d9478",
    tooltipBg: "#211c18",
    tooltipBorder: "rgba(244,239,232,0.16)",
    tooltipItem: "#f4efe8",
    tooltipLabel: "#9a9086",
  },
  light: {
    ink: "#0c0b0a",
    barPrimary: "#0c0b0a",
    muted: "#6b645c",
    grid: "rgba(12,11,10,0.1)",
    accent: "#b8511e",
    warn: "#93672c",
    ok: "#4f6a49",
    tooltipBg: "#ffffff",
    tooltipBorder: "rgba(12,11,10,0.12)",
    tooltipItem: "#241f1a",
    tooltipLabel: "#6b645c",
  },
} as const;

/** Uma cor (e um tom de coluna 3D) por atleta, iguais nos tres graficos de comparacao. */
export const ATHLETE_TONES = ["orange", "teal", "gold", "green"] as const;
export type Tone = (typeof ATHLETE_TONES)[number];
export const ATHLETE_LINE: Record<"dark" | "light", string[]> = {
  dark: ["#f0975f", "#6cc0d4", "#e0b954", "#9bc27f"],
  light: ["#b8511e", "#2a7a8c", "#93672c", "#4f6a49"],
};

export type StickyTooltip = {
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
export function useStickyTooltip(ms = 4000) {
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


/** Estilo padrao do balao (tooltip) dos graficos, por tema. */
export function chartTooltipProps(c: (typeof CHART_COLORS)["dark" | "light"]) {
  return {
    contentStyle: {
      background: c.tooltipBg,
      border: `1px solid ${c.tooltipBorder}`,
      borderRadius: 12,
      boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
      padding: "8px 12px",
    },
    itemStyle: { color: c.tooltipItem, fontSize: 12, padding: 0 },
    labelStyle: { color: c.tooltipLabel, fontSize: 11, marginBottom: 4 },
    wrapperStyle: { outline: "none", zIndex: 20 },
  } as const;
}
