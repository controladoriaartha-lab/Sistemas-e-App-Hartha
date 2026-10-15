import type { Atividade } from "./types";

export type AreaId =
  | "prefrontal"
  | "frontal"
  | "motor"
  | "somato"
  | "parietal"
  | "temporal"
  | "auditivo"
  | "occipital"
  | "cerebelo";

export const AREAS: { id: AreaId; nome: string; funcao: string; cor: string }[] = [
  { id: "prefrontal", nome: "Córtex pré-frontal", funcao: "foco, decisão e planejamento", cor: "#FDE68A" },
  { id: "frontal", nome: "Lobo frontal", funcao: "fala, escrita e iniciativa", cor: "#FEF3C7" },
  { id: "motor", nome: "Córtex motor", funcao: "execução dos movimentos", cor: "#A78BFA" },
  { id: "somato", nome: "Somatossensorial", funcao: "tato e consciência do corpo", cor: "#F9A8D4" },
  { id: "parietal", nome: "Lobo parietal", funcao: "leitura, cálculo e orientação", cor: "#FBCFE8" },
  { id: "temporal", nome: "Lobo temporal", funcao: "memória e linguagem", cor: "#E879A0" },
  { id: "auditivo", nome: "Córtex auditivo", funcao: "escuta e sons", cor: "#C084FC" },
  { id: "occipital", nome: "Lobo occipital", funcao: "visão e leitura visual", cor: "#6B7FB0" },
  { id: "cerebelo", nome: "Cerebelo", funcao: "equilíbrio e coordenação", cor: "#60A5FA" },
];

type Pesos = Partial<Record<AreaId, number>>;

export type Tipo = "meditacao" | "estudo" | "leitura" | "escrita" | "planejamento" | "jogo" | "escuta" | "movimento" | "equilibrio" | "casa";

export const ROTULO_TIPO: Record<Tipo, string> = {
  meditacao: "Meditação",
  estudo: "Estudo",
  leitura: "Leitura",
  escrita: "Escrita",
  planejamento: "Planejamento",
  jogo: "Jogos",
  escuta: "Escuta ativa",
  movimento: "Movimento",
  equilibrio: "Equilíbrio",
  casa: "Tarefas da casa",
};

const POR_TIPO: Record<Tipo, Pesos> = {
  meditacao: { prefrontal: 1, somato: 0.4, frontal: 0.3, parietal: 0.3 },
  estudo: { prefrontal: 0.9, frontal: 0.6, parietal: 0.7, temporal: 0.8, occipital: 0.3 },
  leitura: { occipital: 0.9, temporal: 0.8, parietal: 0.6, prefrontal: 0.3, auditivo: 0.3 },
  escrita: { frontal: 0.9, prefrontal: 0.5, parietal: 0.5, motor: 0.5, somato: 0.3 },
  planejamento: { prefrontal: 1, frontal: 0.6, parietal: 0.3 },
  jogo: { prefrontal: 0.8, parietal: 0.8, occipital: 0.7, motor: 0.5, somato: 0.3 },
  escuta: { auditivo: 1, temporal: 0.8, prefrontal: 0.3 },
  movimento: { motor: 0.7, somato: 0.5, cerebelo: 0.5 },
  equilibrio: { cerebelo: 1, motor: 0.3, somato: 0.3 },
  casa: { motor: 0.4, cerebelo: 0.3, parietal: 0.3, somato: 0.3 },
};

const PADROES: [Tipo, RegExp][] = [
  ["meditacao", /medit|respira|pausa|mindful|yoga|relax/],
  ["estudo", /estud|curso|aula|concurso|prova|revis/],
  ["leitura", /\bli\b|leitura|\bler\b|livro|lendo|autor|artigo/],
  ["escrita", /escrev|escrita|di[aá]rio|reda[cç][aã]o/],
  ["planejamento", /planej|organiz|agenda|contas|arrum/],
  ["jogo", /jogo|jogu?ei|xadrez|sudoku|cruzad|videogame|\bgame\b|quebra.?cabe|puzzle/],
  ["escuta", /podcast|audio.?livro|palestra|\bouvi\b|ouvindo|document[aá]rio/],
];

export function tiposDe(a: Atividade): Tipo[] {
  const t = `${a.atividade} ${a.texto_original}`.toLowerCase();
  const out: Tipo[] = PADROES.filter(([, re]) => re.test(t)).map(([k]) => k);
  if (a.sub_movimento.includes("equilíbrio")) out.push("equilibrio");
  if (a.categorias.includes("movimento corporal") || a.categorias.includes("física")) out.push("movimento");
  if (a.categorias.includes("limpeza casa")) out.push("casa");
  return [...new Set(out)];
}

/** Minutos "equivalentes" do esforco mental: a intensidade pesa um pouco. */
function pontos(a: Atividade) {
  return a.duracao_min * (0.6 + 0.1 * a.intensidade);
}

export interface AreaNivel {
  nivel: number; // 0-1, curva suave em relacao a meta do periodo (nunca estoura)
  pontos: number;
  fontes: string[];
}

export function niveisCerebro(lista: Atividade[], meta: number): Record<AreaId, AreaNivel> {
  const base = Object.fromEntries(AREAS.map((a) => [a.id, { nivel: 0, pontos: 0, fontes: [] as string[] }])) as Record<AreaId, AreaNivel>;
  for (const a of lista) {
    let tipos = tiposDe(a);
    if (tipos.length === 0) {
      if (a.categorias.includes("mental")) tipos = ["meditacao"];
      else if (a.categorias.includes("intelectual")) tipos = ["estudo"];
    }
    const p = pontos(a) / Math.max(1, tipos.length);
    for (const t of tipos) {
      for (const [id, w] of Object.entries(POR_TIPO[t]) as [AreaId, number][]) {
        base[id].pontos += p * w;
        if (!base[id].fontes.includes(ROTULO_TIPO[t])) base[id].fontes.push(ROTULO_TIPO[t]);
      }
    }
  }
  for (const id of Object.keys(base) as AreaId[]) base[id].nivel = base[id].pontos <= 0 ? 0 : Math.max(0.2, Math.min(1, Math.sqrt(base[id].pontos / (meta * 7))));
  return base;
}

/** Minutos de atividade mental/intelectual por tipo cognitivo. */
export function minutosPorTipo(lista: Atividade[]): { tipo: Tipo; min: number }[] {
  const m: Partial<Record<Tipo, number>> = {};
  for (const a of lista) {
    const tipos = tiposDe(a).filter((t) => ["meditacao", "estudo", "leitura", "escrita", "planejamento", "jogo", "escuta"].includes(t));
    for (const t of tipos) m[t] = (m[t] ?? 0) + a.duracao_min;
  }
  return (Object.entries(m) as [Tipo, number][]).map(([tipo, min]) => ({ tipo, min })).sort((a, b) => b.min - a.min);
}

export function minutosMentais(lista: Atividade[]): number {
  return lista
    .filter((a) => a.categorias.includes("mental") || a.categorias.includes("intelectual"))
    .reduce((s, a) => s + a.duracao_min, 0);
}
