import type { ReactNode } from "react";
import { levelColor, type RegionId } from "@/lib/muscle-map";

const BODY_FILL = "#cfd6e2";
const BODY_STROKE = "#7f8aa0";
const IDLE_FILL = "#dde2eb";

// Silhueta única (cabeça à parte): usada na frente e nas costas. Coordenadas
// locais de 200x420, centro em x=100; o lado direito espelha o esquerdo.
const SILHOUETTE =
  "M90,52 L90,64 C80,68 64,72 55,78 C45,84 41,96 39,112 L33,160 C31,178 27,202 25,224 L21,248 C21,255 30,256 32,249 L40,226 C44,204 48,182 52,160 L58,122 C58,150 60,175 62,198 C58,215 54,225 54,240 L58,318 C59,334 62,364 64,392 L60,410 L90,410 L88,392 C90,360 92,330 94,300 L98,262 C99,256 101,256 102,262 L106,300 C108,330 110,360 112,392 L110,410 L140,410 L136,392 C138,364 141,334 142,318 L146,240 C146,225 142,215 138,198 C140,175 142,150 142,122 L148,160 C152,182 156,204 160,226 L168,249 C170,256 179,255 179,248 L175,224 C173,202 169,178 167,160 L161,112 C159,96 155,84 145,78 C136,72 120,68 110,64 L110,52 Z";

type Levels = Partial<Record<RegionId, number>>;

/** Desenha o lado esquerdo e o espelho dele (lado direito) com o mesmo preenchimento. */
function Pair({
  id,
  levels,
  children,
}: {
  id: RegionId;
  levels: Levels;
  children: ReactNode;
}) {
  const ratio = levels[id];
  const color = ratio === undefined ? null : levelColor(ratio);
  const props = {
    fill: color?.fill ?? IDLE_FILL,
    stroke: color?.stroke ?? BODY_STROKE,
    strokeWidth: color ? 1.2 : 0.8,
    strokeLinejoin: "round" as const,
  };
  return (
    <>
      <g {...props}>{children}</g>
      <g {...props} transform="translate(200 0) scale(-1 1)">
        {children}
      </g>
    </>
  );
}

/** Região única, no centro do corpo. */
function Center({ id, levels, children }: { id: RegionId; levels: Levels; children: ReactNode }) {
  const ratio = levels[id];
  const color = ratio === undefined ? null : levelColor(ratio);
  return (
    <g
      fill={color?.fill ?? IDLE_FILL}
      stroke={color?.stroke ?? BODY_STROKE}
      strokeWidth={color ? 1.2 : 0.8}
      strokeLinejoin="round"
    >
      {children}
    </g>
  );
}

function Body({ children, label }: { children: ReactNode; label: string }) {
  return (
    <svg viewBox="0 0 200 420" role="img" aria-label={label} className="mx-auto h-auto w-full">
      <g fill={BODY_FILL} stroke={BODY_STROKE} strokeWidth={1.2} strokeLinejoin="round">
        <ellipse cx="100" cy="32" rx="19" ry="23" />
        <path d={SILHOUETTE} />
      </g>
      {children}
    </svg>
  );
}

const ARM_UPPER = "M41,112 C40,130 38,146 35,158 L51,160 C53,148 56,134 58,122 C52,118 46,114 41,112 Z";
const ARM_FOREARM = "M33,166 L51,166 C48,186 44,206 40,224 L26,222 C28,204 31,184 33,166 Z";
const DELTOID =
  "M55,78 C48,82 44,92 42,106 C42,116 46,124 54,126 C60,120 64,108 64,96 C64,88 62,82 55,78 Z";
const CALF =
  "M60,326 C74,322 86,324 93,326 C92,350 90,372 88,392 L64,392 C62,370 60,346 60,326 Z";

/** Corpo de frente e de costas, com cada músculo pintado conforme o quanto foi trabalhado (0–1). */
export function MuscleFigure({ levels }: { levels: Levels }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <figure>
        <Body label="Corpo humano de frente, com os músculos trabalhados em destaque">
          <Pair id="biceps" levels={levels}>
            <path d={ARM_UPPER} />
          </Pair>
          <Pair id="antebraco" levels={levels}>
            <path d={ARM_FOREARM} />
          </Pair>
          <Pair id="quadriceps" levels={levels}>
            <path d="M56,238 C60,244 86,252 98,264 L94,300 C84,312 68,316 58,316 C56,296 54,262 56,238 Z" />
          </Pair>
          <Pair id="panturrilha" levels={levels}>
            <path d={CALF} />
          </Pair>
          <Pair id="peitoral" levels={levels}>
            <path d="M98,92 C88,88 74,90 66,98 C62,108 64,122 72,130 C82,134 94,130 98,124 Z" />
          </Pair>
          <Pair id="ombros" levels={levels}>
            <path d={DELTOID} />
          </Pair>
          <Center id="abdomen" levels={levels}>
            <path d="M86,136 L114,136 L114,205 Q100,212 86,205 Z" />
            <path d="M86,154 H114 M86,172 H114 M86,190 H114 M100,136 V208" fill="none" strokeWidth="0.8" />
          </Center>
        </Body>
        <figcaption className="mt-1 text-center text-[21px] text-muted-foreground">Frente</figcaption>
      </figure>

      <figure>
        <Body label="Corpo humano de costas, com os músculos trabalhados em destaque">
          <Pair id="triceps" levels={levels}>
            <path d={ARM_UPPER} />
          </Pair>
          <Pair id="antebraco" levels={levels}>
            <path d={ARM_FOREARM} />
          </Pair>
          <Pair id="posteriores" levels={levels}>
            <path d="M56,262 C70,270 88,270 98,262 L94,300 C84,312 68,316 58,316 C56,296 55,278 56,262 Z" />
          </Pair>
          <Pair id="panturrilha" levels={levels}>
            <path d={CALF} />
          </Pair>
          <Pair id="dorsais" levels={levels}>
            <path d="M98,134 C86,118 70,104 62,100 C58,116 58,150 62,196 C74,196 90,190 98,176 Z" />
          </Pair>
          <Center id="trapezio" levels={levels}>
            <path d="M100,56 C90,64 76,70 64,80 C70,92 86,104 100,128 C114,104 130,92 136,80 C124,70 110,64 100,56 Z" />
          </Center>
          <Center id="lombar" levels={levels}>
            <path d="M88,178 C94,176 106,176 112,178 L112,210 C106,216 94,216 88,210 Z" />
          </Center>
          <Pair id="gluteos" levels={levels}>
            <path d="M56,222 C54,236 54,248 60,258 C72,266 90,266 98,258 C100,244 100,230 98,222 C84,216 68,216 56,222 Z" />
          </Pair>
          <Pair id="ombros" levels={levels}>
            <path d={DELTOID} />
          </Pair>
        </Body>
        <figcaption className="mt-1 text-center text-[21px] text-muted-foreground">Costas</figcaption>
      </figure>
    </div>
  );
}
