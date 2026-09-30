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

export function parseExtras(raw: string): ExtraItem[] {
  return raw
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((part) => {
      const m = part.match(/^(.*?)\s*\((\d+)\s*[x×]\s*(\d+)\)\s*(?:\[(.+?)\])?$/);
      if (m) return { name: m[1].trim(), sets: Number(m[2]), reps: Number(m[3]), athlete: m[4] };
      const a = part.match(/^(.*?)\s*\[(.+?)\]$/);
      if (a) return { name: a[1].trim(), sets: 0, reps: 0, athlete: a[2] };
      return { name: part, sets: 0, reps: 0 };
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
