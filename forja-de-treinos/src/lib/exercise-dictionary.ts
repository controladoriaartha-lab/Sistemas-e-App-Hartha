import type { RegionId } from "./muscle-map";

/**
 * DICIONÁRIO DE EXERCÍCIOS — a memória permanente do app sobre "o que cada
 * exercício trabalha". Qualquer nome digitado em Grupo muscular, Outros
 * treinos, Core, Cardio ou nas Notas é procurado aqui; se casar, as regiões do
 * corpo correspondentes entram na figura "Músculos trabalhados".
 *
 * Para ensinar um exercício novo: acrescente uma linha em ENTRIES (força) ou
 * CARDIO_ENTRIES (cardio). Os padrões são regex sobre o texto SEM acento e em
 * minúsculas (ex.: "tríceps francês" vira "triceps frances"). Os pesos vão de
 * 0 a 1: 1 = músculo principal, menos = músculo que ajuda.
 *
 * Regras de funcionamento:
 *  - a lista é percorrida em ordem e cada padrão que casa "consome" o trecho
 *    que reconheceu, então as entradas mais específicas ficam ANTES das gerais
 *    ("deltoide posterior" antes de "posterior"; "flexão bíceps" antes de "flexão");
 *  - uma mesma frase pode casar várias entradas ("anteriores posteriores");
 *  - entradas `generic` (ex.: "halter", "peso") só valem se nada mais casou;
 *  - `core` marca exercícios de abdômen: não contam em dobro quando o treino
 *    tem core com séries e repetições;
 *  - `notes: false` tira a entrada da leitura das Notas (palavras que também
 *    existem no dia a dia, como "ponte" ou "terra").
 */
export type Weights = Partial<Record<RegionId, number>>;

export type ExerciseEntry = {
  name: string;
  test: RegExp;
  weights: Weights;
  generic?: boolean;
  core?: boolean;
  notes?: boolean;
};

export const LEGS: Weights = { quadriceps: 1, posteriores: 1, gluteos: 0.8, panturrilha: 0.7 };

const e = (
  name: string,
  test: RegExp,
  weights: Weights,
  options: Partial<Pick<ExerciseEntry, "generic" | "core" | "notes">> = {},
): ExerciseEntry => ({ name, test, weights, ...options });

// Qualquer parte do ombro: "deltoide posterior", "ombro lateral"…
const SHOULDER_WORD = "(ombros?|deltoides?)( (anterior|posterior|lateral|frontal|medio))?";

export const ENTRIES: ExerciseEntry[] = [
  // ───── Abdômen / core (antes de "pernas": "elevação de pernas" é abdominal) ─────
  e("Prancha", /prancha|plank/, { abdomen: 1, lombar: 0.4, ombros: 0.3 }, { core: true }),
  e(
    "Elevação de pernas",
    /elevacao de (pernas?|joelhos?)|leg raise|knee raise|canivete|v[ -]?up/,
    { abdomen: 1, quadriceps: 0.2 },
    { core: true },
  ),
  e(
    "Abdominal",
    /abdominal|abdominais|abdomen|abdome|\babs\b|crunch|remador|bicicleta no ar|russian twist|rotacao russa|roda abdominal|ab wheel|mountain climber|escalador|hollow|sit[ -]?up|\bcore\b/,
    { abdomen: 1, lombar: 0.2 },
    { core: true },
  ),

  e(
    "Oblíquos / rotação de tronco",
    /obliquos?|rotacao de tronco|giro de tronco|woodchop|lenhador|pallof|flexao lateral/,
    { abdomen: 1, lombar: 0.3 },
    { core: true },
  ),
  e("Slam ball", /slam ball|slam/, { abdomen: 0.8, ombros: 0.5, dorsais: 0.4 }),

  // ───── Pernas: exercícios específicos ─────
  e(
    "Mesa/cadeira flexora",
    /leg curl|mesa flexora|cadeiras? flexora|flexora|flexao (de |do |da )?(joelhos?|pernas?)|femoral/,
    { posteriores: 1, gluteos: 0.3, panturrilha: 0.2 },
  ),
  e("Cadeira extensora", /leg extension|extensora|extensao (de |do |da )?(joelhos?|pernas?)/, { quadriceps: 1 }),
  e("Terra romeno / stiff", /terra romeno|romanian|\brdl\b|stiff/, {
    posteriores: 1,
    gluteos: 0.8,
    lombar: 0.6,
  }),
  e("Levantamento terra", /levantamento terra|deadlift|terra sumo/, {
    posteriores: 1,
    gluteos: 1,
    lombar: 1,
    trapezio: 0.6,
    dorsais: 0.5,
    quadriceps: 0.5,
    antebraco: 0.5,
  }),
  e(
    "Terra",
    /\bterra\b/,
    {
      posteriores: 1,
      gluteos: 1,
      lombar: 1,
      trapezio: 0.6,
      dorsais: 0.5,
      quadriceps: 0.5,
      antebraco: 0.5,
    },
    { notes: false },
  ),
  e(
    "Elevação pélvica / glúteo",
    /hip thrust|elevacao pelvica|glute bridge|glutes? kickback|kickback (de )?gluteos?|gluteos?|glutes?|\bhip\b|coice (na|no) (polia|cabo|maquina)|abdutor|abducao (de |do )?(quadril|coxa|perna)s?|cadeira abdutora/,
    { gluteos: 1, posteriores: 0.5 },
  ),
  e("Good morning / bom dia", /good morning|bom dia/, { posteriores: 1, lombar: 0.8, gluteos: 0.6 }, {
    notes: false,
  }),
  e("Kettlebell swing", /kettlebell|swing/, { posteriores: 0.9, gluteos: 1, lombar: 0.6, ombros: 0.3 }),
  e("Agachamento pêndulo", /pendulo|pendulum/, { quadriceps: 1, gluteos: 0.7, posteriores: 0.3 }),
  e("Ponte", /\bponte\b/, { gluteos: 1, posteriores: 0.5 }, { notes: false }),
  e("Adutora", /adutor|aducao/, { quadriceps: 0.5, posteriores: 0.3, gluteos: 0.3 }),
  e(
    "Panturrilha",
    /panturrilhas?|gemeos|soleo|\bcalf\b|elevacao de (calcanhar|panturrilha)|donkey/,
    { panturrilha: 1 },
  ),
  e("Flexão plantar", /flexao plantar|plantar/, { panturrilha: 1 }),
  e("Flexão de quadril", /flexao (de |do )?quadril/, { quadriceps: 0.6, abdomen: 0.4 }),
  e("Afundo / avanço", /afundo|avanco|passada|lunge|bulgaro|step[ -]?up|subida no banco/, {
    quadriceps: 1,
    gluteos: 0.9,
    posteriores: 0.5,
    panturrilha: 0.2,
  }),
  e("Leg press / prensa", /leg ?press|prensa|press 45|press horizontal/, {
    quadriceps: 1,
    gluteos: 0.7,
    posteriores: 0.5,
  }),
  e("Agachamento", /agachament|squat|\bhack\b|sissy/, {
    quadriceps: 1,
    gluteos: 0.8,
    posteriores: 0.5,
    lombar: 0.3,
    panturrilha: 0.2,
  }),

  // ───── Bíceps / antebraço (antes de "flexão", "braço" e "costas") ─────
  e("Rosca martelo", /rosca (martelo|hammer)|martelo/, { biceps: 0.9, antebraco: 0.7 }),
  e("Rosca inversa", /rosca inversa|reverse curl/, { antebraco: 1, biceps: 0.6 }),
  e("Punho / antebraço", /(flexao|extensao|rosca) (de |do )?punhos?|wrist curl|antebracos?/, {
    antebraco: 1,
  }),
  e("Rosca / bíceps", /(flexao (do |de )?)?biceps|rosca|\bcurl\b|scott|concentrada|barra w/, {
    biceps: 1,
    antebraco: 0.4,
  }),

  // ───── Tríceps ─────
  e("Mergulho / paralelas", /mergulho|paralelas?|\bdips?\b/, {
    triceps: 1,
    peitoral: 0.6,
    ombros: 0.4,
  }),
  e("Tríceps", /triceps|testa|frances|pushdown|kickback|extensao de cotovelo|skull crusher/, {
    triceps: 1,
    ombros: 0.2,
  }),

  // ───── Ombros (antes de peito/costas/pernas) ─────
  e(
    "Elevação / crucifixo invertido",
    new RegExp(
      "(crucifixo|fly|voador|peck deck|pec deck) (invertido|inverso)|reverse fly|face pull|elevacao posterior|(ombros?|deltoides?) posterior",
    ),
    { ombros: 1, trapezio: 0.5, dorsais: 0.3 },
  ),
  e("Remada alta", /remada alta|upright row/, { ombros: 1, trapezio: 0.8, biceps: 0.3 }),
  e("Encolhimento", /encolhiment|shrug|trapezios?/, { trapezio: 1, ombros: 0.3, antebraco: 0.3 }),
  e(
    "Desenvolvimento",
    /desenvolviment|shoulder press|press militar|militar|arnold|overhead press|\bohp\b/,
    { ombros: 1, triceps: 0.5, trapezio: 0.3 },
  ),
  e(
    "Elevação lateral / frontal",
    /elevacao (lateral|frontal)|lateral raise|front raise|abducao de ombro/,
    { ombros: 1, trapezio: 0.2 },
  ),
  e("Corda naval", /corda naval|battle rope|ropes?\b/, { ombros: 1, abdomen: 0.4, triceps: 0.3, biceps: 0.3 }),
  e("Manguito rotador", /manguito|rotacao (externa|interna)/, { ombros: 0.8 }),
  e("Ombro / deltoide", new RegExp(SHOULDER_WORD), { ombros: 1, trapezio: 0.4 }),

  // ───── Peito ─────
  e(
    "Supino inclinado",
    /supino inclinad\w*|incline (bench|press)|chest press inclinad\w*/,
    { peitoral: 1, ombros: 0.6, triceps: 0.5 },
  ),
  e("Supino declinado", /supino declinad\w*|decline (bench|press)/, {
    peitoral: 1,
    triceps: 0.6,
    ombros: 0.3,
  }),
  e("Supino", /supino|bench press|press de peito|chest press|maquina de peito/, {
    peitoral: 1,
    triceps: 0.5,
    ombros: 0.4,
  }),
  e(
    "Crucifixo / voador / crossover",
    /crucifixo|\bfly\b|peck deck|pec deck|voador|borboleta|crossover|cross over|cruzamento|polia cruzada/,
    { peitoral: 1, ombros: 0.3 },
  ),
  e("Flexão de braço", /flexao( de bracos?)?|push[ -]?up|apoio no solo/, {
    peitoral: 1,
    triceps: 0.7,
    ombros: 0.5,
    abdomen: 0.3,
  }),
  e("Pullover", /pullover/, { peitoral: 0.8, dorsais: 0.8, triceps: 0.3 }),
  e("Peito", /peito|peitoral|peitorais/, { peitoral: 1, triceps: 0.35, ombros: 0.25 }),

  // ───── Costas ─────
  e(
    "Barra fixa / puxada",
    /puxada|pulldown|pull down|barra fixa|pull[ -]?up|chin[ -]?up|graviton/,
    { dorsais: 1, biceps: 0.5, trapezio: 0.3, antebraco: 0.2 },
  ),
  e("Remada", /remada|\bremo\b|serrote|cavalinho|t[ -]?bar|\brow\b|rowing/, {
    dorsais: 1,
    trapezio: 0.6,
    biceps: 0.4,
    lombar: 0.3,
    ombros: 0.2,
  }),
  e("Lombar / hiperextensão", /hiperextens|extensao lombar|banco romano|cadeira romana|superman|lombar/, {
    lombar: 1,
    gluteos: 0.4,
    posteriores: 0.4,
  }),
  e("Costas", /costas|dorsal|dorsais|latissimo/, {
    dorsais: 1,
    trapezio: 0.7,
    lombar: 0.4,
    biceps: 0.35,
  }),

  // ───── Grupos digitados por extenso ─────
  e("Braços", /bracos?|membros superiores|superiores/, { biceps: 1, triceps: 1, antebraco: 0.6 }),
  e("Posterior de coxa", /posteriores( de coxa)?|posterior( de coxa)?|isquio\w*/, {
    posteriores: 1,
    gluteos: 0.6,
  }),
  e("Anterior de coxa", /anteriores?|quadriceps|coxas?|frente de coxa/, {
    quadriceps: 1,
    gluteos: 0.3,
  }),
  e("Pernas", /pernas?|\blegs?\b|membros inferiores|inferiores/, LEGS),

  // ───── Só valem se nada mais casou ─────
  e(
    "Halteres / pesos",
    /halter|pesos?/,
    { biceps: 0.6, triceps: 0.6, ombros: 0.6 },
    { generic: true },
  ),
];

/** Cardio: o que cada tipo trabalha (a primeira entrada que casar vence). */
export const CARDIO_ENTRIES: { name: string; test: RegExp; weights: Weights }[] = [
  {
    name: "Air bike",
    test: /air ?bike|assault|ventilada/,
    weights: { quadriceps: 0.9, gluteos: 0.6, ombros: 0.4, triceps: 0.3, biceps: 0.3, dorsais: 0.3 },
  },
  {
    name: "Simulador de esqui",
    test: /ski ?erg|simulador de esqui|\bski\b/,
    weights: { dorsais: 0.8, triceps: 0.6, abdomen: 0.5, ombros: 0.4, quadriceps: 0.3 },
  },
  {
    name: "Bike",
    test: /bike|bicicleta|spinning|ciclis|pedal/,
    weights: { quadriceps: 1, posteriores: 0.6, gluteos: 0.6, panturrilha: 0.6 },
  },
  {
    name: "Escada",
    test: /escada|stair|step/,
    weights: { quadriceps: 0.9, gluteos: 0.9, panturrilha: 0.7, posteriores: 0.6 },
  },
  {
    name: "Corrida / esteira",
    test: /corrida|correr|esteira|\brun\w*|trote|sprint/,
    weights: { quadriceps: 0.8, posteriores: 0.8, gluteos: 0.7, panturrilha: 0.9 },
  },
  {
    name: "Caminhada",
    test: /caminhada|caminhar|andar|walk/,
    weights: { quadriceps: 0.6, posteriores: 0.6, gluteos: 0.5, panturrilha: 0.7 },
  },
  {
    name: "Elíptico",
    test: /eliptico|transport/,
    weights: {
      quadriceps: 0.7,
      gluteos: 0.6,
      posteriores: 0.5,
      panturrilha: 0.5,
      biceps: 0.3,
      triceps: 0.3,
    },
  },
  {
    name: "Remo",
    test: /remo|remada|canoa|ergometro de remo/,
    weights: { dorsais: 0.8, biceps: 0.5, trapezio: 0.4, quadriceps: 0.4, posteriores: 0.3 },
  },
  {
    name: "Natação",
    test: /natacao|nado|nadar|piscina|hidro/,
    weights: { ombros: 0.7, dorsais: 0.7, peitoral: 0.5, triceps: 0.4, abdomen: 0.3 },
  },
  {
    name: "Pular corda",
    test: /pular|corda|jump|salto/,
    weights: { panturrilha: 0.9, quadriceps: 0.6, ombros: 0.3 },
  },
  {
    name: "Funcional / HIIT",
    test: /burpee|hiit|funcional|crossfit|circuito/,
    weights: { quadriceps: 0.6, gluteos: 0.4, peitoral: 0.4, ombros: 0.4, abdomen: 0.4 },
  },
  {
    name: "Luta",
    test: /boxe|muay|jiu|kickboxing|karate|luta|judo/,
    weights: { ombros: 0.5, abdomen: 0.5, quadriceps: 0.4, dorsais: 0.3, triceps: 0.4 },
  },
  {
    name: "Dança / aeróbica",
    test: /danca|zumba|aerobica|ritmo/,
    weights: { quadriceps: 0.5, gluteos: 0.5, panturrilha: 0.5, abdomen: 0.3 },
  },
  {
    name: "Esporte",
    test: /futebol|basquete|volei|tenis|futsal|padel|beach/,
    weights: { quadriceps: 0.6, panturrilha: 0.6, gluteos: 0.4, posteriores: 0.4 },
  },
];
export const CARDIO_DEFAULT: Weights = {
  quadriceps: 0.5,
  posteriores: 0.4,
  gluteos: 0.4,
  panturrilha: 0.5,
};

export function normalizeText(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/**
 * Aparelhos ensinados pelo usuario (tabela custom_exercises na nuvem, ver
 * lib/custom-exercises.ts). Valem ANTES do dicionario padrao, entao o que o
 * usuario cadastra sempre ganha.
 */
let customEntries: ExerciseEntry[] = [];

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function setCustomExercises(
  list: { name: string; keywords: string[]; weights: Weights }[],
) {
  customEntries = list.flatMap((item) => {
    const words = [...new Set([item.name, ...item.keywords].map(normalizeText))].filter(
      (w) => w.length >= 3,
    );
    if (words.length === 0) return [];
    const test = new RegExp(
      `(?<![a-z0-9])(?:${words
        .sort((a, b) => b.length - a.length)
        .map(escapeRegExp)
        .join("|")})(?![a-z0-9])`,
    );
    return [{ name: item.name, test, weights: item.weights }];
  });
}

export type ExerciseHit = { name: string; weights: Weights; core: boolean; generic: boolean };

/**
 * Exercícios reconhecidos num texto livre (nome de grupo, de exercício ou as
 * Notas inteiras). Cada padrão que casa consome o trecho que reconheceu, pra
 * uma entrada geral não repetir o que uma específica já pegou.
 */
export function matchExercises(text: string, options: { forNotes?: boolean } = {}): ExerciseHit[] {
  let rest = ` ${normalizeText(text)} `;
  const hits: ExerciseHit[] = [];
  const consider = (generic: boolean) => {
    for (const entry of generic ? ENTRIES : [...customEntries, ...ENTRIES]) {
      if (Boolean(entry.generic) !== generic) continue;
      if (options.forNotes && entry.notes === false) continue;
      const match = entry.test.exec(rest);
      if (!match) continue;
      hits.push({
        name: entry.name,
        weights: entry.weights,
        core: Boolean(entry.core),
        generic: generic,
      });
      rest = rest.replace(match[0], " ");
    }
  };
  consider(false);
  if (hits.length === 0 && !options.forNotes) consider(true);
  return hits;
}

/** Regiões de um tipo de cardio ("Bike", "Esteira", "Natação"…). */
export function matchCardio(kind: string): Weights {
  const name = normalizeText(kind);
  return CARDIO_ENTRIES.find((entry) => entry.test.test(name))?.weights ?? CARDIO_DEFAULT;
}
