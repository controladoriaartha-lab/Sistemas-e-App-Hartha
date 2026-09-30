/**
 * "Outros treinos" (campo `extras`, texto livre) guarda uma lista separada
 * por virgula, cada item podendo trazer series/repeticoes e o atleta que fez
 * aquilo — "Pesos (4x15)[Geovanil], Pesos (3x10)[Vânia]". O `[Atleta]` e uma
 * marca interna nossa, nunca mostrada assim ao usuario (veja `displayExtras`
 * em lib/format.ts para a leitura, e `labelFromFreeText` em lib/stats.ts, que
 * a remove antes de virar categoria de grafico).
 *
 * Compartilhado entre o formulario (workout-form.tsx) e o filtro por atleta
 * (athlete-view.ts), para os dois lerem/escreverem exatamente o mesmo
 * formato.
 */
export type ExtraItem = { name: string; sets: number; reps: number; athlete?: string };

function normLoose(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Acha um atleta conhecido em qualquer parte do texto, sem exigir um formato
 * especifico — pra reconhecer registros antigos, digitados a mao antes do
 * marcador `[Atleta]` existir ("Pesos 2x12 Vânia"). `knownAthletes` e a
 * lista de atletas do proprio treino (`w.athletes`/`draft.athletes`), entao
 * nao precisa vir de fora.
 */
function extractKnownAthlete(
  text: string,
  knownAthletes: string[],
): { rest: string; athlete?: string } {
  const hay = normLoose(text);
  const isWordChar = (c: string | undefined) => !!c && /[a-z0-9]/i.test(c);
  for (const known of knownAthletes) {
    const needle = normLoose(known.trim());
    if (!needle) continue;
    const idx = hay.indexOf(needle);
    if (idx === -1) continue;
    if (isWordChar(hay[idx - 1]) || isWordChar(hay[idx + needle.length])) continue;
    const rest = (text.slice(0, idx) + text.slice(idx + needle.length))
      .replace(/\s+/g, " ")
      .trim();
    return { rest, athlete: known };
  }
  return { rest: text };
}

/**
 * `knownAthletes` (normalmente `w.athletes` ou `draft.athletes`) so entra
 * pra reconhecer o formato antigo sem marcador — o formato atual `(SxR)
 * [Atleta]` e sempre reconhecido, marcador vindo de dentro dos parenteses
 * ou nao.
 */
export function parseExtras(raw: string, knownAthletes: string[] = []): ExtraItem[] {
  return raw
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((part) => {
      // "Nome (SxR)" com ou sem "[Atleta]" ou um nome solto logo depois.
      const withParens = part.match(/^(.*?)\s*\((\d+)\s*[x×]\s*(\d+)\)\s*(.*)$/);
      if (withParens) {
        const [, name, sets, reps, tail] = withParens;
        const bracket = tail.match(/^\[(.+?)\]$/);
        const athlete = bracket ? bracket[1] : extractKnownAthlete(tail, knownAthletes).athlete;
        return { name: name.trim(), sets: Number(sets), reps: Number(reps), athlete };
      }
      // "Nome[Atleta]" sem numeros.
      const bracketOnly = part.match(/^(.*?)\s*\[(.+?)\]$/);
      if (bracketOnly) {
        return { name: bracketOnly[1].trim(), sets: 0, reps: 0, athlete: bracketOnly[2] };
      }
      // Formato antigo sem parenteses: "Nome SxR Atleta" (ou so "Nome SxR").
      const loose = part.match(/^(.*?)\s+(\d+)\s*[x×]\s*(\d+)\b\s*(.*)$/i);
      if (loose) {
        const [, name, sets, reps, tail] = loose;
        const { athlete } = extractKnownAthlete(tail, knownAthletes);
        return { name: name.trim(), sets: Number(sets), reps: Number(reps), athlete };
      }
      // Sem numero nenhum: so tenta achar um atleta solto no texto.
      const { rest, athlete } = extractKnownAthlete(part, knownAthletes);
      return { name: (rest || part).trim(), sets: 0, reps: 0, athlete };
    });
}

export function formatExtras(items: ExtraItem[]): string {
  return items
    .map((item) => {
      let s = item.name;
      if (item.sets > 0 || item.reps > 0) s += ` (${item.sets}x${item.reps})`;
      if (item.athlete) s += `[${item.athlete}]`;
      return s;
    })
    .join(", ");
}
