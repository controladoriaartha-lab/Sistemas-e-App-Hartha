export const CATEGORIAS = [
  "mental",
  "intelectual",
  "física",
  "organização",
  "limpeza casa",
  "movimento corporal",
] as const;
export type Categoria = (typeof CATEGORIAS)[number];

export const SUBS = [
  "força",
  "abaixar",
  "equilíbrio",
  "empurrar",
  "puxar",
  "torção",
  "caminhar",
] as const;
export type Sub = (typeof SUBS)[number];

export const REGIOES = ["cabeca", "bracos", "core", "pernas", "corpo_inteiro"] as const;
export type Regiao = (typeof REGIOES)[number];

export interface Atividade {
  id: string;
  created_at: string; // ISO
  texto_original: string;
  atividade: string;
  categorias: Categoria[];
  sub_movimento: Sub[];
  duracao_min: number;
  regiao_corporal: Regiao[];
  intensidade: number; // 1-5
  score: number; // (duracao * intensidade) / 2
}

export type Classificacao = Omit<Atividade, "id" | "created_at">;

export interface Rotina {
  categoria: Categoria;
  atividade_ideal: string;
  frequencia_diaria: number;
  pontuacao: number;
}

export const ROTINA_PADRAO: Rotina[] = [
  { categoria: "mental", atividade_ideal: "Meditar ou respirar 10 min", frequencia_diaria: 1, pontuacao: 20 },
  { categoria: "intelectual", atividade_ideal: "Estudar ou ler 20 min", frequencia_diaria: 1, pontuacao: 25 },
  { categoria: "física", atividade_ideal: "Movimento com força", frequencia_diaria: 1, pontuacao: 30 },
  { categoria: "organização", atividade_ideal: "Organizar agenda ou mesa", frequencia_diaria: 1, pontuacao: 10 },
  { categoria: "limpeza casa", atividade_ideal: "Lavar louça ou varrer", frequencia_diaria: 1, pontuacao: 10 },
  { categoria: "movimento corporal", atividade_ideal: "Alongar, abaixar ou equilíbrio", frequencia_diaria: 2, pontuacao: 25 },
];

export const ROTULO_CATEGORIA: Record<Categoria, string> = {
  mental: "Mental",
  intelectual: "Intelectual",
  física: "Física",
  organização: "Organização",
  "limpeza casa": "Limpeza",
  "movimento corporal": "Movimento",
};
