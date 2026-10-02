import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, Fingerprint, LogOut, Printer, TriangleAlert, Upload } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { forAthlete } from "@/lib/athlete-view";
import { PanelBrandBar } from "@/components/brand-bar";
import { friendlyPasskeyError, hasBiometricUnlock } from "@/lib/biometric";
import { DashboardPanel } from "@/components/dashboard-panel";
import { DayPicker, FilterGroup, MonthPicker, PillRow } from "@/components/filters";
import { Button } from "@/components/ui/button";
import { parseMarkdownDiary, workoutsToMarkdown } from "@/lib/diary-md";
import { parseDate, todayIso } from "@/lib/format";
import { filterByPeriod, PERIOD_IN_PHRASE, PERIODS, recentMonths, type Period } from "@/lib/period";
import { DEFAULT_ATHLETES } from "@/lib/types";
import { supabase } from "@/lib/cloud";
import { resetSyncForLogout, syncNow } from "@/lib/sync";
import { useWorkoutStore } from "@/store/workouts";

export const Route = createFileRoute("/dashboard")({ component: DashboardPage });

function DashboardPage() {
  const workouts = useWorkoutStore((s) => s.workouts);
  const customAthletes = useWorkoutStore((s) => s.customAthletes);
  const importWorkouts = useWorkoutStore((s) => s.importWorkouts);
  const restoreSeed = useWorkoutStore((s) => s.restoreSeed);
  const fileRef = useRef<HTMLInputElement>(null);

  const [athlete, setAthlete] = useState<string>("todos");
  const [period, setPeriod] = useState<Period>("tudo");
  const [monthOffset, setMonthOffset] = useState(0);
  const [dayIso, setDayIso] = useState(todayIso());
  const [canBiometric, setCanBiometric] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void hasBiometricUnlock().then((ok) => {
      if (alive) setCanBiometric(ok);
    });
    return () => {
      alive = false;
    };
  }, []);

  const athleteOptions = useMemo(() => {
    const set = new Set<string>(DEFAULT_ATHLETES);
    for (const w of workouts) for (const a of w.athletes) set.add(a);
    for (const a of customAthletes) set.add(a);
    return ["todos", ...set];
  }, [workouts, customAthletes]);

  const filtered = useMemo(() => {
    let list = workouts;
    if (athlete !== "todos") list = forAthlete(list, athlete);
    list = filterByPeriod(list, period, monthOffset, dayIso);
    return list;
  }, [workouts, athlete, period, monthOffset, dayIso]);

  const periodActive = period !== "tudo";
  const singleAthlete = athlete !== "todos";
  const filtersActive = periodActive || singleAthlete;
  const periodLabel =
    period === "dia"
      ? `em ${format(parseDate(dayIso), "dd/MM/yyyy")}`
      : period === "mes" && monthOffset > 0
        ? `em ${recentMonths(monthOffset + 1).at(-1)?.label}`
        : PERIOD_IN_PHRASE[period];

  const reportSearch = {
    atleta: singleAthlete ? athlete : undefined,
    periodo: periodActive ? period : undefined,
    mes: period === "mes" && monthOffset > 0 ? monthOffset : undefined,
    dia: period === "dia" ? dayIso : undefined,
  };

  function setPeriodFilter(value: Period) {
    setPeriod(value);
    if (value !== "mes") setMonthOffset(0);
  }

  function clearFilters() {
    setAthlete("todos");
    setPeriod("tudo");
    setMonthOffset(0);
    setDayIso(todayIso());
  }

  function handleExport() {
    if (workouts.length === 0) return;
    const markdown = workoutsToMarkdown(workouts);
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `diario-de-treino-${todayIso()}.md`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success("Diário exportado (.md)");
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseMarkdownDiary(text);
      if (parsed.length === 0) {
        toast.error("Nenhum treino reconhecido no arquivo");
        return;
      }
      const ok = window.confirm(
        `Importar ${parsed.length} treino(s)? Isso substitui o diário atual (também na nuvem).`,
      );
      if (!ok) return;
      importWorkouts(parsed);
      toast.success(`${parsed.length} treino(s) importado(s)`);
    } catch {
      toast.error("Falha ao ler o arquivo");
    }
  }

  async function handleRegisterBiometric() {
    setBioBusy(true);
    try {
      const { error } = await supabase.auth.registerPasskey();
      if (error) {
        const text = friendlyPasskeyError(error);
        if (text) toast.error(text);
      } else {
        toast.success("Biometria cadastrada! Da próxima vez, é só tocar no dedo para entrar.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível cadastrar a biometria");
    } finally {
      setBioBusy(false);
    }
  }

  async function handleLogout() {
    await syncNow();
    if (!window.confirm("Sair da conta neste aparelho? Seus treinos continuam guardados na nuvem."))
      return;
    await supabase.auth.signOut();
    resetSyncForLogout();
  }

  return (
    <main className="relative px-5 pb-28 pt-16">
      <header className="mb-6">
        <PanelBrandBar />
        <p className="mt-3 max-w-sm text-[24px] text-muted-foreground">
          KPIs, volume, intensidade e comparativos entre semanas, meses e atletas.
        </p>
        {workouts.length > 0 && (
          <Button asChild variant="secondary" className="mt-4 h-12 text-base">
            <Link to="/relatorio" search={reportSearch}>
              <Printer />
              {singleAthlete ? `Imprimir PDF de ${athlete}` : "Imprimir PDF de todo o treino"}
            </Link>
          </Button>
        )}
      </header>

      {workouts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem dados ainda. Lance o primeiro treino.</p>
      ) : (
        <>
          <div className="mb-5 space-y-3">
            <FilterGroup label="Atletas">
              <PillRow
                options={athleteOptions.map((name) => ({
                  value: name,
                  label: name === "todos" ? "Todos" : name,
                }))}
                value={athlete}
                onChange={setAthlete}
              />
            </FilterGroup>
            <FilterGroup label="Período">
              <PillRow options={PERIODS} value={period} onChange={setPeriodFilter} />
              {period === "mes" && <MonthPicker offset={monthOffset} onChange={setMonthOffset} />}
              {period === "dia" && <DayPicker value={dayIso} onChange={setDayIso} />}
            </FilterGroup>
          </div>

          {filtersActive && (
            <div className="mb-4 flex items-center justify-between text-sm text-faint">
              <span className="tabular-nums">
                {filtered.length} {filtered.length === 1 ? "treino" : "treinos"}
                {periodActive ? ` ${periodLabel}` : ""}
              </span>
              <button
                type="button"
                onClick={clearFilters}
                className="min-h-9 rounded-md px-2 font-medium text-muted-foreground"
              >
                Limpar filtros
              </button>
            </div>
          )}

          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum treino com esses filtros.</p>
          ) : (
            <DashboardPanel
              workouts={filtered}
              extraAthletes={customAthletes}
              periodActive={periodActive}
              singleAthlete={singleAthlete}
              periodLabel={periodLabel}
            />
          )}
        </>
      )}

      <div className="mt-10 space-y-6 border-t border-border pt-6">
        <div>
          <p className="font-medium">Backup do diário</p>
          <p className="mt-1 text-base text-faint">
            Exporta e importa no formato Markdown (.md), compatível com o caderno estruturado do
            Obsidian.
          </p>
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-warn/10 p-3">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" />
            <p className="text-sm text-warn">
              Seu diário fica guardado na nuvem, ligado à sua conta. Ainda assim, exporte de vez em
              quando e guarde o arquivo em local seguro como cópia extra.
            </p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={handleExport} disabled={workouts.length === 0}>
              <Download />
              Exportar
            </Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload />
              Importar
            </Button>
          </div>
          <Button asChild variant="default" className="mt-2 w-full">
            <Link to="/relatorio" search={reportSearch}>
              <Printer />
              {singleAthlete ? `Imprimir PDF de ${athlete}` : "Imprimir PDF (relatório completo)"}
            </Link>
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".md,.markdown,text/markdown,text/plain"
            hidden
            onChange={handleImport}
          />
        </div>

        <div>
          <p className="text-sm text-faint">
            Restaurar o diário original substitui o que você editou.
          </p>
          <Button
            variant="ghost"
            className="mt-2 text-faint"
            onClick={() => {
              if (window.confirm("Restaurar o diário original? Isso apaga edições locais.")) {
                restoreSeed();
              }
            }}
          >
            Restaurar diário original
          </Button>
          <Button
            variant="destructive"
            className="mt-2"
            onClick={() => {
              if (
                window.confirm(
                  "Tem certeza que deseja excluir todo o diário de treino? Essa ação não pode ser desfeita.",
                )
              ) {
                importWorkouts([]);
                toast.success("Diário excluído");
              }
            }}
          >
            Excluir tudo
          </Button>
          {canBiometric && (
            <Button
              variant="ghost"
              className="mt-2 block text-faint"
              disabled={bioBusy}
              onClick={() => void handleRegisterBiometric()}
            >
              <Fingerprint />
              {bioBusy ? "Aguarde…" : "Cadastrar biometria neste aparelho"}
            </Button>
          )}
          <Button
            variant="ghost"
            className="mt-2 block text-faint"
            onClick={() => void handleLogout()}
          >
            <LogOut />
            Sair da conta
          </Button>
        </div>
      </div>
    </main>
  );
}
