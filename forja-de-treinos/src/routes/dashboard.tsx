import { useRef, type ChangeEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { DashboardPanel } from "@/components/dashboard-panel";
import { Button } from "@/components/ui/button";
import { parseMarkdownDiary, workoutsToMarkdown } from "@/lib/diary-md";
import { todayIso } from "@/lib/format";
import { useWorkoutStore } from "@/store/workouts";

export const Route = createFileRoute("/dashboard")({ component: DashboardPage });

function DashboardPage() {
  const workouts = useWorkoutStore((s) => s.workouts);
  const customAthletes = useWorkoutStore((s) => s.customAthletes);
  const importWorkouts = useWorkoutStore((s) => s.importWorkouts);
  const restoreSeed = useWorkoutStore((s) => s.restoreSeed);
  const fileRef = useRef<HTMLInputElement>(null);

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
        `Importar ${parsed.length} treino(s)? Isso substitui o diário atual neste aparelho.`,
      );
      if (!ok) return;
      importWorkouts(parsed);
      toast.success(`${parsed.length} treino(s) importado(s)`);
    } catch {
      toast.error("Falha ao ler o arquivo");
    }
  }

  return (
    <main className="relative px-5 pb-28 pt-8">
      <header className="mb-6">
        <p className="text-2xs font-medium uppercase tracking-widest text-accent">Painel</p>
        <h1 className="mt-1 font-display text-4xl font-medium tracking-tight">Números</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          KPIs, volume, intensidade e comparativos entre semanas, meses e atletas.
        </p>
      </header>

      {workouts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem dados ainda. Lance o primeiro treino.</p>
      ) : (
        <DashboardPanel workouts={workouts} extraAthletes={customAthletes} />
      )}

      <div className="mt-10 space-y-6 border-t border-border pt-6">
        <div>
          <p className="font-medium">Backup do diário</p>
          <p className="mt-1 text-xs text-faint">
            Exporta e importa no formato Markdown (.md), compatível com o caderno estruturado do
            Obsidian.
          </p>
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
          <input
            ref={fileRef}
            type="file"
            accept=".md,.markdown,text/markdown,text/plain"
            hidden
            onChange={handleImport}
          />
        </div>

        <div>
          <p className="text-xs text-faint">
            Os treinos ficam neste aparelho. Restaurar o diário original substitui o que você editou.
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
        </div>
      </div>
    </main>
  );
}
