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
        "relative overflow-hidden rounded-[1.4rem] px-5 py-4 text-center shadow-[0_8px_0_#6d2c0c,0_26px_34px_rgba(0,0,0,0.55),0_0_40px_rgba(240,151,95,0.28),inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-3px_6px_rgba(0,0,0,0.35)]",
        className,
      )}
      style={{ background: "linear-gradient(160deg, #e2824c 0%, #c45c26 45%, #8a3c13 100%)" }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/35 to-transparent"
      />
      <p
        className="relative whitespace-nowrap text-[24px] font-bold leading-none tracking-tight text-[#fbf2e6] drop-shadow-[0_2px_3px_rgba(0,0,0,0.4)]"
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
        "relative overflow-hidden rounded-[1.4rem] px-5 py-4 text-center shadow-[0_8px_0_#b6a88f,0_26px_34px_rgba(0,0,0,0.5),0_0_36px_rgba(240,151,95,0.22),inset_0_1px_0_#ffffff,inset_0_-3px_6px_rgba(90,60,20,0.25)]",
        className,
      )}
      style={{ background: "linear-gradient(160deg, #ffffff 0%, #f2ece1 45%, #ddd2bf 100%)" }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/35 to-transparent"
      />
      <p
        className="relative whitespace-nowrap text-[24px] font-bold leading-none tracking-tight"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        <span className="text-accent">Painel</span> <span className="text-ink">Números</span>
      </p>
    </div>
  );
}
