import { useSyncExternalStore } from "react";

/**
 * Cor de destaque do app (as "bolinhas"): troca o laranja por outra cor em
 * toda a interface — barra de titulo, etiquetas, colunas dos graficos, brilhos.
 * A escolha fica no aparelho (localStorage). As cores sao aplicadas como
 * variaveis CSS em <html>; um script no <head> (ver routes/__root.tsx) refaz
 * isso antes da primeira pintura, para nao piscar a cor padrao.
 */
export type Accent = {
  id: string;
  label: string;
  /** Degrade claro > medio > escuro dos botoes/etiquetas em relevo. */
  l1: string;
  l2: string;
  l3: string;
  /** "Espessura" (sombra solida) dos elementos em relevo. */
  edge: string;
  /** Degrade da barra de titulo. */
  t1: string;
  t2: string;
  t3: string;
  /** RGB do brilho (glow) em "r g b". */
  glow: string;
  /** Cor de texto/destaque no tema escuro e no claro. */
  dark: string;
  light: string;
};

export const ACCENTS: Accent[] = [
  {
    id: "laranja",
    label: "Laranja",
    l1: "#f0975f",
    l2: "#d36a2c",
    l3: "#a9481a",
    edge: "#6d2c0c",
    t1: "#e2824c",
    t2: "#c45c26",
    t3: "#8a3c13",
    glow: "240 151 95",
    dark: "#c45c26",
    light: "#b8511e",
  },
  {
    id: "vermelho",
    label: "Vermelho",
    l1: "#f0786a",
    l2: "#d3392c",
    l3: "#a1221a",
    edge: "#5e0f0a",
    t1: "#e5604f",
    t2: "#c4342a",
    t3: "#8a1c14",
    glow: "240 120 106",
    dark: "#d6463a",
    light: "#b8302a",
  },
  {
    id: "dourado",
    label: "Dourado",
    l1: "#f3d37a",
    l2: "#d9a63a",
    l3: "#a87618",
    edge: "#5f4209",
    t1: "#e8bf5c",
    t2: "#c9972e",
    t3: "#8a6112",
    glow: "243 211 122",
    dark: "#d9a63a",
    light: "#93672c",
  },
  {
    id: "verde",
    label: "Verde",
    l1: "#9fcb8a",
    l2: "#5f9a4c",
    l3: "#3e7230",
    edge: "#234a19",
    t1: "#86bb70",
    t2: "#57914a",
    t3: "#366a2b",
    glow: "159 203 138",
    dark: "#6fa352",
    light: "#4f6a49",
  },
  {
    id: "petroleo",
    label: "Petróleo",
    l1: "#7ccbdd",
    l2: "#3f9db3",
    l3: "#26697a",
    edge: "#123c47",
    t1: "#62b9cd",
    t2: "#3590a5",
    t3: "#1f5c6c",
    glow: "124 203 221",
    dark: "#3f9db3",
    light: "#2a7a8c",
  },
  {
    id: "azul",
    label: "Azul",
    l1: "#8db4f0",
    l2: "#4a7fd6",
    l3: "#2c55a3",
    edge: "#162f5e",
    t1: "#76a2e8",
    t2: "#3f72c8",
    t3: "#274c92",
    glow: "141 180 240",
    dark: "#4a7fd6",
    light: "#2f5fb3",
  },
  {
    id: "violeta",
    label: "Violeta",
    l1: "#b79af0",
    l2: "#8a63d6",
    l3: "#5f3fa3",
    edge: "#33205e",
    t1: "#a283e6",
    t2: "#7c56c8",
    t3: "#553894",
    glow: "183 154 240",
    dark: "#8a63d6",
    light: "#6a46b5",
  },
  {
    id: "rosa",
    label: "Rosa",
    l1: "#f09ac4",
    l2: "#d65a98",
    l3: "#a33a6c",
    edge: "#5e1f3d",
    t1: "#e581b2",
    t2: "#c84d89",
    t3: "#8f305d",
    glow: "240 154 196",
    dark: "#d65a98",
    light: "#b8447f",
  },
];

const KEY = "forja-accent-v1";

export function accentById(id: string | null | undefined): Accent {
  return ACCENTS.find((a) => a.id === id) ?? ACCENTS[0];
}

/** Variaveis CSS de uma cor de destaque (nomes usados em styles.css). */
export function accentVars(a: Accent): Record<string, string> {
  return {
    "--acc-1": a.l1,
    "--acc-2": a.l2,
    "--acc-3": a.l3,
    "--acc-edge": a.edge,
    "--acc-t1": a.t1,
    "--acc-t2": a.t2,
    "--acc-t3": a.t3,
    "--acc-glow": a.glow,
    "--acc-dark": a.dark,
    "--acc-light": a.light,
  };
}

function readStored(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function applyToDocument(a: Accent) {
  const style = document.documentElement.style;
  for (const [name, value] of Object.entries(accentVars(a))) style.setProperty(name, value);
}

let current: Accent = ACCENTS[0];
if (typeof window !== "undefined") {
  current = accentById(readStored());
  applyToDocument(current);
}

const listeners = new Set<() => void>();

export function setAccent(id: string) {
  current = accentById(id);
  applyToDocument(current);
  try {
    localStorage.setItem(KEY, current.id);
  } catch {
    // sem armazenamento: vale so nesta sessao
  }
  listeners.forEach((l) => l());
}

export function useAccent(): Accent {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => ACCENTS[0],
  );
}

/** Script do <head>: aplica a cor escolhida antes da primeira pintura. */
export function accentBootScript(): string {
  const table = Object.fromEntries(ACCENTS.map((a) => [a.id, accentVars(a)]));
  return `try{var a=localStorage.getItem(${JSON.stringify(KEY)});var t=${JSON.stringify(table)};if(a&&t[a]){var s=document.documentElement.style,v=t[a];for(var k in v)s.setProperty(k,v[k]);}}catch(e){}`;
}
