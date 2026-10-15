import { classificarLocal } from "./classifier";
import type { Atividade, Classificacao } from "./types";

const MODELOS: string[][] = [
  ["Meditei 10 minutos", "Estudei 1 hora", "Caminhei 30 minutos"],
  ["Lavei a louça agachada 15 minutos", "Alonguei 10 minutos", "Planejei a agenda"],
  ["Treino de musculação 45 minutos", "Meditei 10 minutos", "Lavei roupa 20 minutos"],
  ["Yoga 20 minutos", "Li um livro 30 minutos", "Varri a casa 15 minutos"],
  ["Estudei 2 horas", "Agachamento 5 minutos", "Organizei a mesa"],
  ["Corrida 30 minutos", "Respiração 5 minutos", "Limpei o banheiro 20 minutos"],
  ["Caminhei 40 minutos", "Escrevi no diário 15 minutos", "Alonguei 10 minutos"],
];

// Gera ~3 semanas de historico previsivel (sem aleatoriedade) para conhecer o app.
export function gerarDemo(): { itens: Classificacao[]; quando: Date }[] {
  const out: { itens: Classificacao[]; quando: Date }[] = [];
  const hoje = new Date();
  for (let d = 21; d >= 1; d--) {
    if (d % 6 === 0) continue; // alguns dias de folga
    const base = MODELOS[d % MODELOS.length];
    const qtd = 2 + (d % 2);
    base.slice(0, qtd).forEach((txt, i) => {
      const quando = new Date(hoje);
      quando.setDate(hoje.getDate() - d);
      quando.setHours(7 + i * 4 + (d % 3), (d * 7) % 50, 0, 0);
      out.push({ itens: classificarLocal(txt), quando });
    });
  }
  return out;
}

/** Historico + dia de hoje para quem ainda nao entrou (somente visualizacao). */
export function exemploAtividades(): Atividade[] {
  const out: Atividade[] = [];
  let n = 0;
  const push = (itens: Classificacao[], quando: Date) =>
    itens.forEach((c, i) =>
      out.push({ ...c, id: `exemplo-${n++}`, created_at: new Date(quando.getTime() + i * 1000).toISOString() }),
    );
  gerarDemo().forEach((d) => push(d.itens, d.quando));
  const hora = (h: number, m: number) => {
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  };
  push(classificarLocal("Lavei a louça agachada, 10 minutos"), hora(7, 40));
  push(classificarLocal("Meditei 10 minutos"), hora(8, 15));
  push(classificarLocal("Estudei 1 hora"), hora(9, 30));
  push(classificarLocal("Caminhei 30 minutos"), hora(12, 20));
  return out;
}
