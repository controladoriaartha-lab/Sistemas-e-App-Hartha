import { formatExtras, parseExtras } from "./extras";
import type { Workout } from "./types";

function norm(name: string) {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Compara nomes sem diferenciar acento, maiusculas e espacos ("Vania" = "Vânia "). */
export function sameAthlete(a: string | undefined, b: string): boolean {
  return !!a && norm(a) === norm(b);
}

/**
 * Visao de um unico atleta: o treino continua o mesmo, mas as linhas de core,
 * cardio e os itens de "Outros treinos" marcados para OUTRO atleta saem (sem
 * atleta marcado vale para todos) e o nome exibido passa a ser so o do
 * atleta filtrado. Assim cartao, painel, relatorio e graficos (Grupo
 * muscular inclusive) nunca somam nem mostram dados de quem nao foi
 * filtrado.
 *
 * Musculação (aparelhos/séries/repetições) e Grupo muscular continuam sendo
 * um numero/texto so por treino, sem marca de atleta — nao ha o que filtrar
 * ali, contam pro treino inteiro (e por tabela, pros dois participantes).
 */
export function forAthlete(list: Workout[], athlete: string): Workout[] {
  return list
    .filter((w) => w.athletes.some((a) => sameAthlete(a, athlete)))
    .map((w) => ({
      ...w,
      athletes: [athlete],
      core: w.core.filter((r) => !r.athlete || sameAthlete(r.athlete, athlete)),
      cardio: w.cardio.filter((r) => !r.athlete || sameAthlete(r.athlete, athlete)),
      extras: formatExtras(
        parseExtras(w.extras).filter(
          (item) => !item.athlete || sameAthlete(item.athlete, athlete),
        ),
      ),
    }));
}
