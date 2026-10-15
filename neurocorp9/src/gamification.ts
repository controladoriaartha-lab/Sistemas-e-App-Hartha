import { calcularIndice, chaveDia, doDia, streak } from "./metrics";
import { CATEGORIAS } from "./types";
import type { Atividade } from "./types";

export const NIVEIS = [
  { min: 0, nome: "Despertar" },
  { min: 100, nome: "Movimento" },
  { min: 300, nome: "Constância" },
  { min: 700, nome: "Fluxo" },
  { min: 1300, nome: "Equilíbrio" },
  { min: 2200, nome: "Maestria" },
];

export function xpTotal(lista: Atividade[]): number {
  return lista.reduce((s, a) => s + a.score, 0);
}

export function nivel(xp: number) {
  let i = 0;
  NIVEIS.forEach((n, idx) => {
    if (xp >= n.min) i = idx;
  });
  const atual = NIVEIS[i];
  const prox = NIVEIS[i + 1];
  const pct = prox ? Math.round(((xp - atual.min) / (prox.min - atual.min)) * 100) : 100;
  return { indice: i + 1, nome: atual.nome, pct, faltam: prox ? prox.min - xp : 0, proximo: prox?.nome ?? null };
}

export function maiorSequencia(lista: Atividade[]): number {
  const dias = [...new Set(lista.map((a) => chaveDia(a.created_at)))].sort();
  let melhor = 0;
  let atual = 0;
  let anterior: Date | null = null;
  for (const d of dias) {
    const dt = new Date(d + "T12:00:00");
    if (anterior && Math.round((dt.getTime() - anterior.getTime()) / 86400000) === 1) atual += 1;
    else atual = 1;
    melhor = Math.max(melhor, atual);
    anterior = dt;
  }
  return melhor;
}

export interface Conquista {
  id: string;
  titulo: string;
  descricao: string;
  atual: number;
  meta: number;
}

export function conquistas(lista: Atividade[]): Conquista[] {
  const dias = [...new Set(lista.map((a) => chaveDia(a.created_at)))];
  const porDia = dias.map((d) => doDia(lista, d));
  const diaCompleto = porDia.some((l) => CATEGORIAS.every((c) => l.some((a) => a.categorias.includes(c))));
  const melhorPontos = Math.max(0, ...porDia.map((l) => l.reduce((s, a) => s + a.score, 0)));
  const melhorJari = Math.max(0, ...porDia.map((l) => calcularIndice(l).jari));
  const seq = Math.max(maiorSequencia(lista), streak(lista));
  const conta = (f: (a: Atividade) => boolean) => lista.filter(f).length;
  const diasMental = porDia.filter((l) => l.some((a) => a.categorias.includes("mental"))).length;
  const madrugou = lista.some((a) => new Date(a.created_at).getHours() < 7);

  return [
    { id: "inicio", titulo: "Primeiro passo", descricao: "Faça seu primeiro registro", atual: Math.min(1, lista.length), meta: 1 },
    { id: "tres", titulo: "Ritmo", descricao: "3 dias seguidos", atual: Math.min(3, seq), meta: 3 },
    { id: "sete", titulo: "Semana inteira", descricao: "7 dias seguidos", atual: Math.min(7, seq), meta: 7 },
    { id: "inteiro", titulo: "Dia completo", descricao: "As 6 dimensões em um só dia", atual: diaCompleto ? 1 : 0, meta: 1 },
    { id: "abaixar", titulo: "Joelhos de aço", descricao: "10 registros de abaixar", atual: Math.min(10, conta((a) => a.sub_movimento.includes("abaixar"))), meta: 10 },
    { id: "mente", titulo: "Mente calma", descricao: "5 dias com prática mental", atual: Math.min(5, diasMental), meta: 5 },
    { id: "forca", titulo: "Dia de fogo", descricao: "100 pontos em um dia", atual: Math.min(100, melhorPontos), meta: 100 },
    { id: "casa", titulo: "Casa em ordem", descricao: "7 registros de limpeza", atual: Math.min(7, conta((a) => a.categorias.includes("limpeza casa"))), meta: 7 },
    { id: "madruga", titulo: "Madrugador", descricao: "Registre algo antes das 7h", atual: madrugou ? 1 : 0, meta: 1 },
    { id: "jari80", titulo: "Equilíbrio raro", descricao: "Índice NEUROCORP9 80 em um dia", atual: Math.min(80, melhorJari), meta: 80 },
  ];
}

export function insights(hoje: Atividade[], semana: Atividade[]): string[] {
  const out: string[] = [];
  if (semana.length < 3) return ["Registre por alguns dias e o NEUROCORP9 começa a mostrar seus padrões."];
  const cont: Record<string, number> = {};
  for (const a of semana) for (const c of a.categorias) cont[c] = (cont[c] ?? 0) + 1;
  const ordenado = CATEGORIAS.map((c) => [c, cont[c] ?? 0] as const).sort((a, b) => b[1] - a[1]);
  out.push(`Seu ponto forte nos últimos 7 dias é ${ordenado[0][0]} (${ordenado[0][1]} registros).`);
  const fraco = ordenado[ordenado.length - 1];
  if (fraco[1] < ordenado[0][1]) out.push(`Pouca atenção a ${fraco[0]}: ${fraco[1]} registro${fraco[1] === 1 ? "" : "s"} na semana.`);
  const horas = new Array(24).fill(0);
  for (const a of semana) horas[new Date(a.created_at).getHours()] += a.duracao_min;
  const pico = horas.indexOf(Math.max(...horas));
  if (horas[pico] > 0) out.push(`Você se move mais por volta das ${String(pico).padStart(2, "0")}h.`);
  if (hoje.length === 0) out.push("Hoje ainda está em branco: um registro de 2 minutos já acende o mapa.");
  return out;
}

export function paraCsv(lista: Atividade[]): string {
  const cab = ["data", "hora", "atividade", "categorias", "sub_movimento", "regioes", "duracao_min", "intensidade", "score", "texto"];
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const linhas = lista.map((a) => {
    const d = new Date(a.created_at);
    return [
      chaveDia(d),
      d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      a.atividade,
      a.categorias.join("|"),
      a.sub_movimento.join("|"),
      a.regiao_corporal.join("|"),
      a.duracao_min,
      a.intensidade,
      a.score,
      a.texto_original,
    ]
      .map(esc)
      .join(",");
  });
  return [cab.join(","), ...linhas].join("\n");
}
