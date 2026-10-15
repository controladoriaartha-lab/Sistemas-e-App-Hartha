import type { Categoria, Classificacao, Regiao, Sub } from "./types";

interface Regra {
  atividade: string;
  padroes: RegExp[];
  categorias: Categoria[];
  sub: Sub[];
  regioes: Regiao[];
  intensidade: number;
  duracaoPadrao: number;
}

// Regras locais PT-BR (modo offline / privado). A Edge Function do Supabase
// substitui isso quando VITE_CLASSIFY_URL estiver configurada.
const REGRAS: Regra[] = [
  { atividade: "lavar louça", padroes: [/lav(ei|ar|ando)\s+(a\s+)?lou[cç]a/, /lou[cç]a/], categorias: ["limpeza casa", "movimento corporal"], sub: ["abaixar", "força"], regioes: ["bracos", "core", "pernas"], intensidade: 2, duracaoPadrao: 15 },
  { atividade: "lavar roupa", padroes: [/roupa/, /estend(i|er)/], categorias: ["limpeza casa", "movimento corporal"], sub: ["abaixar", "puxar"], regioes: ["bracos", "core"], intensidade: 2, duracaoPadrao: 20 },
  { atividade: "varrer ou passar pano", padroes: [/varr(i|er|endo)/, /passei\s+(o\s+)?pano/, /\bch[aã]o\b/, /aspirador/], categorias: ["limpeza casa", "movimento corporal"], sub: ["torção", "empurrar"], regioes: ["bracos", "core"], intensidade: 3, duracaoPadrao: 20 },
  { atividade: "limpar banheiro", padroes: [/banheiro/, /limp(ei|ar|ando)/], categorias: ["limpeza casa", "movimento corporal"], sub: ["abaixar", "força"], regioes: ["bracos", "core", "pernas"], intensidade: 3, duracaoPadrao: 20 },
  { atividade: "agachamento", padroes: [/agach/, /abaix(ei|ar|ada|ado)/], categorias: ["movimento corporal", "física"], sub: ["abaixar", "força"], regioes: ["pernas", "core"], intensidade: 3, duracaoPadrao: 5 },
  { atividade: "musculação", padroes: [/muscula[cç][aã]o/, /academia/, /treino/, /treinei/, /halter/, /flex[aã]o/, /prancha/], categorias: ["física", "movimento corporal"], sub: ["força", "empurrar", "puxar"], regioes: ["corpo_inteiro"], intensidade: 4, duracaoPadrao: 45 },
  { atividade: "caminhada", padroes: [/caminh(ei|ar|ada|ando)/, /andei/, /passeio/], categorias: ["física", "movimento corporal"], sub: ["caminhar"], regioes: ["pernas"], intensidade: 2, duracaoPadrao: 30 },
  { atividade: "corrida", padroes: [/corri\b/, /corrida/, /correr/, /cardio/, /bicicleta/, /pedalei/], categorias: ["física"], sub: ["caminhar", "força"], regioes: ["pernas", "core"], intensidade: 4, duracaoPadrao: 30 },
  { atividade: "yoga", padroes: [/yoga/, /pilates/], categorias: ["física", "mental", "movimento corporal"], sub: ["equilíbrio", "força"], regioes: ["core", "pernas"], intensidade: 3, duracaoPadrao: 20 },
  { atividade: "alongamento", padroes: [/along(uei|ar|amento|ando)/, /espregui/], categorias: ["movimento corporal", "física"], sub: ["torção", "equilíbrio"], regioes: ["corpo_inteiro"], intensidade: 1, duracaoPadrao: 10 },
  { atividade: "equilíbrio", padroes: [/equil[ií]brio/, /uma\s+perna/], categorias: ["movimento corporal"], sub: ["equilíbrio"], regioes: ["pernas", "core"], intensidade: 2, duracaoPadrao: 5 },
  { atividade: "meditação", padroes: [/medit(ei|ar|a[cç][aã]o|ando)/, /respira[cç][aã]o/, /respirei/, /mindful/, /pausa/], categorias: ["mental"], sub: [], regioes: ["cabeca"], intensidade: 1, duracaoPadrao: 10 },
  { atividade: "estudo", padroes: [/estud(ei|ar|o|ando)/, /curso/, /aula/, /concurso/], categorias: ["intelectual"], sub: [], regioes: ["cabeca"], intensidade: 3, duracaoPadrao: 60 },
  { atividade: "leitura", padroes: [/\bli\b/, /leitura/, /ler\b/, /livro/, /lendo/], categorias: ["intelectual"], sub: [], regioes: ["cabeca"], intensidade: 2, duracaoPadrao: 30 },
  { atividade: "escrita", padroes: [/escrev(i|er|endo)/, /escrita/, /di[aá]rio/], categorias: ["intelectual", "mental"], sub: [], regioes: ["cabeca", "bracos"], intensidade: 2, duracaoPadrao: 20 },
  { atividade: "jogo cognitivo", padroes: [/jogo/, /jogu?ei/, /xadrez/, /sudoku/, /cruzad/, /videogame/, /\bgame\b/, /quebra.?cabe/, /puzzle/], categorias: ["intelectual", "mental"], sub: [], regioes: ["cabeca"], intensidade: 3, duracaoPadrao: 30 },
  { atividade: "escuta ativa", padroes: [/podcast/, /audio.?livro/, /palestra/, /ouvi\b/, /ouvindo/, /document[aá]rio/], categorias: ["intelectual"], sub: [], regioes: ["cabeca"], intensidade: 2, duracaoPadrao: 30 },
  { atividade: "planejamento", padroes: [/planej(ei|ar|amento)/, /organiz(ei|ar)/, /agenda/, /contas/, /arrumei\s+(a\s+)?mesa/, /arrum(ei|ar)/], categorias: ["organização"], sub: [], regioes: ["cabeca"], intensidade: 1, duracaoPadrao: 15 },
  { atividade: "cozinhar", padroes: [/cozinh(ei|ar|ando)/, /almo[cç]o\s+feito/, /preparei/], categorias: ["limpeza casa"], sub: ["força"], regioes: ["bracos"], intensidade: 2, duracaoPadrao: 40 },
];

const NUMEROS: Record<string, number> = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, "três": 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
  quinze: 15, vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50,
};

export function extrairDuracao(trecho: string): number | null {
  const t = trecho.toLowerCase();
  if (/meia\s+hora/.test(t)) return 30;
  let m = t.match(/(\d+(?:[.,]\d+)?)\s*(h|hora|horas)\b/);
  if (m) return Math.round(parseFloat(m[1].replace(",", ".")) * 60);
  m = t.match(/(\d+)\s*(min|mins|minuto|minutos)\b/);
  if (m) return parseInt(m[1], 10);
  m = t.match(/\b([a-zçã]+)\s+(hora|horas)\b/);
  if (m && NUMEROS[m[1]]) return NUMEROS[m[1]] * 60;
  m = t.match(/\b([a-zçã]+)\s+(minuto|minutos)\b/);
  if (m && NUMEROS[m[1]]) return NUMEROS[m[1]];
  return null;
}

function ajustarIntensidade(base: number, trecho: string): number {
  let i = base;
  if (/(pesad|forte|intens|exaust|ca[ri]rreguei|subi\s+escada|r[aá]pid)/.test(trecho)) i += 1;
  if (/(leve|devagar|tranquil|suave|de\s+leve)/.test(trecho)) i -= 1;
  return Math.min(5, Math.max(1, i));
}

function semAcento(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function classificarLocal(texto: string): Classificacao[] {
  const soDuracao = /^\s*(\d+(?:[.,]\d+)?|meia|uma?|duas?|dois|tr[eê]s|quatro|cinco|dez|quinze|vinte|trinta)\s*(min|minutos?|h|horas?)\b/i;
  const partes = texto
    .split(/[,.;]|\s+e\s+(?=(?:eu\s+)?(?:\w+ei|\w+i)\b)|\s+depois\s+|\s+tamb[eé]m\s+/i)
    .map((p) => p.trim())
    .filter((p) => p.length > 2)
    // fragmento que e so duracao ("..., 10 minutos") pertence a atividade anterior
    .reduce<string[]>((acc, p) => {
      if (acc.length && soDuracao.test(p) && !extrairDuracao(acc[acc.length - 1])) {
        acc[acc.length - 1] += ` ${p}`;
      } else {
        acc.push(p);
      }
      return acc;
    }, []);

  const resultado: Classificacao[] = [];
  for (const parte of partes.length ? partes : [texto]) {
    const baixo = parte.toLowerCase();
    const alvo = semAcento(baixo);
    const regra = REGRAS.find((r) => r.padroes.some((p) => p.test(baixo) || p.test(alvo)));
    const duracao = Math.min(120, extrairDuracao(baixo) ?? regra?.duracaoPadrao ?? 15);
    const intensidade = ajustarIntensidade(regra?.intensidade ?? 2, baixo);

    const categorias: Categoria[] = regra ? [...regra.categorias] : ["movimento corporal"];
    // quem mencionou "agachada/abaixada" soma o sub-movimento mesmo em outra regra
    const sub: Sub[] = regra ? [...regra.sub] : ["caminhar"];
    if (/(agach|abaix)/.test(baixo) && !sub.includes("abaixar")) {
      sub.push("abaixar");
      if (!categorias.includes("movimento corporal")) categorias.push("movimento corporal");
    }
    const regioes: Regiao[] = regra ? [...regra.regioes] : ["corpo_inteiro"];
    if (/(agach|abaix)/.test(baixo) && !regioes.includes("pernas")) regioes.push("pernas");

    resultado.push({
      texto_original: parte,
      atividade: regra?.atividade ?? parte.slice(0, 30),
      categorias,
      sub_movimento: sub,
      duracao_min: duracao,
      regiao_corporal: regioes,
      intensidade,
      score: Math.round((duracao * intensidade) / 2),
    });
  }
  return resultado;
}

// Classifica via Edge Function quando configurada; cai para regras locais em erro.
export async function classificar(texto: string): Promise<{ itens: Classificacao[]; origem: "ia" | "local" }> {
  const url = import.meta.env.VITE_CLASSIFY_URL as string | undefined;
  if (url) {
    try {
      const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(anon ? { Authorization: `Bearer ${anon}`, apikey: anon } : {}),
        },
        body: JSON.stringify({ text: texto }),
      });
      if (res.ok) {
        const d = await res.json();
        if (d && !d.error && Array.isArray(d.categorias)) {
          const duracao = Math.min(120, Number(d.duracao_min) || 15);
          const intensidade = Math.min(5, Math.max(1, Number(d.intensidade) || 2));
          return {
            origem: "ia",
            itens: [
              {
                texto_original: texto,
                atividade: String(d.atividade ?? texto.slice(0, 30)),
                categorias: d.categorias,
                sub_movimento: d.sub_movimento ?? [],
                duracao_min: duracao,
                regiao_corporal: d.regiao_corporal ?? [],
                intensidade,
                score: Math.round((duracao * intensidade) / 2),
              },
            ],
          };
        }
      }
    } catch {
      /* segue para o classificador local */
    }
  }
  return { itens: classificarLocal(texto), origem: "local" };
}
