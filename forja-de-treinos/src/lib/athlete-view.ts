import type { Workout } from "./types";

function norm(name: string) {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Compara nomes sem diferenciar acento, maiusculas e espacos ("Vania" = "Vânia "). */
export function sameAthlete(a: string | undefined, b: string): boolean {
  return !!a && norm(a) === norm(b);
}

/**
 * Visao de um unico atleta: o treino continua o mesmo, mas as linhas de core
 * marcadas para OUTRO atleta saem (linhas sem atleta valem para todos). Assim
 * cartao, painel e relatorio nunca somam nem mostram o core de quem nao foi
 * filtrado.
 */
export function forAthlete(list: Workout[], athlete: string): Workout[] {
  return list
    .filter((w) => w.athletes.some((a) => sameAthlete(a, athlete)))
    .map((w) => ({
      ...w,
      core: w.core.filter((r) => !r.athlete || sameAthlete(r.athlete, athlete)),
    }));
}
