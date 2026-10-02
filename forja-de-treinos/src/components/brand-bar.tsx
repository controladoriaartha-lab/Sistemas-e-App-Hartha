import { cn } from "@/lib/utils";

/**
 * "Diário Forja de Treinos" — nome do app numa barra única, com relevo 3D
 * (gradiente + sombra interna/externa), no lugar do antigo título em duas
 * linhas ("Diário" em cima, "Forja de Treinos" embaixo). Usado nos dois
 * lugares que mostram essa marca — topo de Treinos e tela de login — pra
 * ficarem iguais entre si, como já eram antes.
 */
export function BrandBar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl px-5 py-3.5 text-center shadow-[0_16px_34px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.3),inset_0_-3px_6px_rgba(0,0,0,0.35)]",
        className,
      )}
      style={{ background: "linear-gradient(160deg, #e2824c 0%, #c45c26 45%, #8a3c13 100%)" }}
    >
      <p
        className="whitespace-nowrap text-[24px] font-bold leading-none tracking-tight text-[#fbf2e6] drop-shadow-[0_2px_3px_rgba(0,0,0,0.4)]"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        Diário Forja de Treinos
      </p>
    </div>
  );
}

/** Mesma barra 3D, versão branca para o topo do Painel ("Painel" em laranja, "Números" em preto). */
export function PanelBrandBar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl px-5 py-3.5 text-center shadow-[0_16px_34px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.3),inset_0_-3px_6px_rgba(0,0,0,0.35)]",
        className,
      )}
      style={{ background: "linear-gradient(160deg, #ffffff 0%, #f2ece1 45%, #ddd2bf 100%)" }}
    >
      <p
        className="whitespace-nowrap text-[24px] font-bold leading-none tracking-tight"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        <span className="text-accent">Painel</span> <span className="text-ink">Números</span>
      </p>
    </div>
  );
}
