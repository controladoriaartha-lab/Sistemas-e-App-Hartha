import type { Focus } from "@/lib/types";

/**
 * Memoria do historico de "Aparelhos e notas": cada item (aparelho/exercicio)
 * ja usado e em quais focos (pernas, bracos...). Fica gravada no aparelho ao
 * salvar um treino, entao o item continua na lista mesmo que o treino em que
 * ele apareceu seja apagado. Os treinos salvos (que vao para a nuvem) tambem
 * alimentam a lista, em qualquer aparelho.
 */
export type RememberedNote = { label: string; foci: Focus[] };

const KEY = "forja-note-history-v1";

export function readRememberedNotes(): Record<string, RememberedNote> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

export function rememberNotes(items: string[], foci: Focus[]) {
  if (items.length === 0) return;
  const all = readRememberedNotes();
  for (const label of items) {
    const key = label.toLowerCase();
    const cur = all[key] ?? { label, foci: [] };
    all[key] = { label: cur.label, foci: [...new Set([...cur.foci, ...foci])] };
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // sem espaco: a lista segue sendo montada a partir dos treinos salvos
  }
}
