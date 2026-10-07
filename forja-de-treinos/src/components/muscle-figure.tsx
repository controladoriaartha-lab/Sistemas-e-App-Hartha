import type { ReactNode } from "react";
import { levelColor, type RegionId } from "@/lib/muscle-map";

const BODY_FILL = "#cfd6e2";
const BODY_STROKE = "#6f7a92";
const IDLE_FILL = "#dde2eb";

// Silhueta musculosa única (cabeça, mãos e pés à parte), usada na frente e
// nas costas. Coordenadas locais de 200x440, centro em x=100; o lado direito
// espelha o esquerdo.
const SILHOUETTE =
  "M89,50 L89,66 C80,70 64,72 50,80 C40,86 32,98 31,114 C29,132 26,150 24,168 C21,184 19,204 18,236 L37,236 C40,214 44,190 46,168 C50,152 54,138 56,120 C58,150 68,180 76,200 C74,214 66,222 62,238 C54,262 52,290 60,326 C54,350 60,380 64,402 L64,404 L86,404 C90,380 94,350 92,330 C96,300 97,275 98,256 L102,256 C103,275 104,300 108,330 C106,350 110,380 114,404 L136,404 L136,402 C140,380 146,350 140,326 C148,290 146,262 138,238 C134,222 126,214 124,200 C132,180 142,150 144,120 C146,138 150,152 154,168 C156,190 160,214 163,236 L182,236 C181,204 179,184 176,168 C174,150 171,132 169,114 C168,98 160,86 150,80 C136,72 120,70 111,66 L111,50 Z";

type Levels = Partial<Record<RegionId, number>>;

const MIRROR = "translate(200 0) scale(-1 1)";

function regionStyle(levels: Levels, id: RegionId) {
  const ratio = levels[id];
  if (ratio === undefined) {
    return { fill: IDLE_FILL, stroke: BODY_STROKE, strokeWidth: 0.9 };
  }
  const color = levelColor(ratio);
  return { fill: color.fill, stroke: color.stroke, strokeWidth: ratio >= 0.66 ? 1.7 : 1.2 };
}

/** Desenha o lado esquerdo e o espelho dele (lado direito) com o mesmo preenchimento. */
function Pair({ id, levels, children }: { id: RegionId; levels: Levels; children: ReactNode }) {
  const style = { ...regionStyle(levels, id), strokeLinejoin: "round" as const };
  return (
    <>
      <g {...style}>{children}</g>
      <g {...style} transform={MIRROR}>
        {children}
      </g>
    </>
  );
}

/** Região única, no centro do corpo. */
function Center({ id, levels, children }: { id: RegionId; levels: Levels; children: ReactNode }) {
  return (
    <g {...regionStyle(levels, id)} strokeLinejoin="round">
      {children}
    </g>
  );
}

/** Linha de definição muscular, desenhada por cima do preenchimento. */
function Line({ d }: { d: string }) {
  return <path d={d} fill="none" strokeWidth="0.9" strokeOpacity="0.65" strokeLinecap="round" />;
}

function Hand() {
  return (
    <>
      <rect x="22" y="254" width="4.6" height="26" rx="2.3" />
      <rect x="26.6" y="254" width="4.6" height="30" rx="2.3" />
      <rect x="31.2" y="254" width="4.6" height="27" rx="2.3" />
      <rect x="35.8" y="254" width="4.4" height="22" rx="2.2" />
      <rect x="13.5" y="240" width="6" height="23" rx="3" transform="rotate(16 16.5 240)" />
      <path d="M19,234 L37,234 C39,244 40.5,252 40,260 L20,260 C19,252 18,242 19,234 Z" />
    </>
  );
}

function Foot({ back }: { back?: boolean }) {
  return (
    <>
      <path d="M65,402 L86,402 C89,412 91,422 89,428 C84,435 70,435 63,430 C60,422 62,412 65,402 Z" />
      {back ? (
        <path d="M67,424 C72,430 82,430 86,424 M70,404 C71,414 71,420 70,426" fill="none" strokeWidth="0.8" />
      ) : (
        <>
          <ellipse cx="84" cy="430" rx="4.6" ry="4" />
          <ellipse cx="77.5" cy="432" rx="3.3" ry="3.2" />
          <ellipse cx="72" cy="432.5" rx="3" ry="3" />
          <ellipse cx="67.2" cy="431.5" rx="2.7" ry="2.8" />
          <ellipse cx="63.4" cy="429.5" rx="2.4" ry="2.5" />
        </>
      )}
    </>
  );
}

function Body({ children, label, back }: { children: ReactNode; label: string; back?: boolean }) {
  return (
    <svg viewBox="0 0 200 440" role="img" aria-label={label} className="mx-auto h-auto w-full">
      <g fill={BODY_FILL} stroke={BODY_STROKE} strokeWidth={1.2} strokeLinejoin="round">
        <ellipse cx="100" cy="30" rx="18" ry="22" />
        <path d={SILHOUETTE} />
        <Hand />
        <g transform={MIRROR}>
          <Hand />
        </g>
        <Foot back={back} />
        <g transform={MIRROR}>
          <Foot back={back} />
        </g>
        <path
          d="M92,50 L96,68 M89,66 C80,72 66,76 54,82"
          fill="none"
          strokeWidth="0.8"
          strokeOpacity="0.7"
        />
        <path
          d="M92,50 L96,68 M89,66 C80,72 66,76 54,82"
          fill="none"
          strokeWidth="0.8"
          strokeOpacity="0.7"
          transform={MIRROR}
        />
      </g>
      {children}
    </svg>
  );
}

const ARM_UPPER =
  "M33,122 C30,138 27,152 25,164 L45,166 C49,154 53,140 56,124 C50,122 40,122 33,122 Z";
const ARM_FOREARM = "M25,172 L46,172 C44,194 41,216 37,236 L19,236 C20,212 22,192 25,172 Z";
const DELTOID =
  "M50,80 C38,86 32,98 31,114 C31,124 38,132 48,134 C56,128 62,114 62,98 C62,88 58,82 50,80 Z";

/** Corpo de frente e de costas, com cada músculo pintado conforme o quanto foi trabalhado (0–1). */
export function MuscleFigure({ levels }: { levels: Levels }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <figure>
        <Body label="Corpo humano de frente, com os músculos trabalhados em destaque">
          <Pair id="biceps" levels={levels}>
            <path d={ARM_UPPER} />
            <Line d="M34,134 C42,141 50,141 55,134" />
          </Pair>
          <Pair id="antebraco" levels={levels}>
            <path d={ARM_FOREARM} />
            <Line d="M36,178 C34,198 31,218 29,234" />
          </Pair>
          <Pair id="quadriceps" levels={levels}>
            <path d="M62,240 C70,248 90,252 98,258 L94,300 C92,318 90,328 88,330 C78,334 66,332 60,326 C52,296 54,264 62,240 Z" />
            <Line d="M70,262 C68,284 68,306 72,324" />
            <Line d="M85,268 C85,290 83,310 81,326" />
            <Line d="M84,322 C88,326 91,326 93,322" />
          </Pair>
          <Pair id="panturrilha" levels={levels}>
            <path d="M60,332 C72,336 84,336 91,334 C92,356 90,380 86,402 L64,402 C60,382 54,356 60,332 Z" />
            <Line d="M75,340 C73,362 73,382 75,398" />
          </Pair>
          <Pair id="peitoral" levels={levels}>
            <path d="M99,92 C90,88 76,88 62,94 C56,104 56,122 62,132 C74,144 90,146 99,136 Z" />
            <Line d="M99,102 C90,106 76,108 60,110" />
          </Pair>
          <Pair id="ombros" levels={levels}>
            <path d={DELTOID} />
            <Line d="M44,94 C48,108 50,120 48,132" />
          </Pair>
          <Pair id="abdomen" levels={levels}>
            <path d="M86,142 L99,142 L99,204 C94,206 90,204 86,200 Z" />
            <path d="M64,142 C66,160 72,180 78,198 L86,198 L86,148 C78,150 70,148 64,142 Z" />
            <Line d="M86,158 H99 M86,174 H99 M86,190 H99" />
            <Line d="M66,150 L76,156 M68,162 L78,168 M72,174 L81,180" />
          </Pair>
          <Line d="M100,142 V206" />
        </Body>
        <figcaption className="mt-1 text-center text-[21px] text-muted-foreground">Frente</figcaption>
      </figure>

      <figure>
        <Body back label="Corpo humano de costas, com os músculos trabalhados em destaque">
          <Pair id="triceps" levels={levels}>
            <path d={ARM_UPPER} />
            <Line d="M36,128 C34,146 34,156 36,164 M52,128 C52,146 50,156 48,164" />
          </Pair>
          <Pair id="antebraco" levels={levels}>
            <path d={ARM_FOREARM} />
            <Line d="M36,178 C34,198 31,218 29,234" />
          </Pair>
          <Pair id="posteriores" levels={levels}>
            <path d="M62,266 C74,274 90,274 98,266 L94,306 C92,318 90,326 88,330 C78,334 66,332 60,326 C54,300 56,280 62,266 Z" />
            <Line d="M80,274 C80,296 80,314 82,330" />
          </Pair>
          <Pair id="panturrilha" levels={levels}>
            <path d="M60,332 C72,336 84,336 91,334 C93,350 92,372 88,392 L64,392 C58,372 54,352 60,332 Z" />
            <Line d="M76,340 C76,358 76,376 76,392" />
          </Pair>
          <Pair id="dorsais" levels={levels}>
            <path d="M98,148 C90,130 76,118 60,112 C58,130 60,150 66,170 C70,184 74,194 78,202 C88,200 96,190 98,176 Z" />
            <Line d="M62,104 C72,110 84,114 94,122" />
            <Line d="M66,122 C74,134 82,148 90,162" />
          </Pair>
          <Center id="trapezio" levels={levels}>
            <path d="M100,58 C92,64 80,70 64,78 C62,92 74,108 88,124 C94,134 98,142 100,150 C102,142 106,134 112,124 C126,108 138,92 136,78 C120,70 108,64 100,58 Z" />
            <Line d="M100,60 V150" />
            <Line d="M80,74 C84,92 92,108 100,122 M120,74 C116,92 108,108 100,122" />
          </Center>
          <Center id="lombar" levels={levels}>
            <path d="M86,178 C92,176 108,176 114,178 L114,214 C108,220 92,220 86,214 Z" />
            <Line d="M100,176 V218" />
            <Line d="M93,182 C92,196 92,206 94,216 M107,182 C108,196 108,206 106,216" />
          </Center>
          <Pair id="gluteos" levels={levels}>
            <path d="M64,224 C60,238 62,254 70,264 C80,272 94,270 99,260 L99,224 C88,218 74,218 64,224 Z" />
            <Line d="M70,236 C76,246 84,248 94,246" />
          </Pair>
          <Pair id="ombros" levels={levels}>
            <path d={DELTOID} />
            <Line d="M44,94 C48,108 50,120 48,132" />
          </Pair>
        </Body>
        <figcaption className="mt-1 text-center text-[21px] text-muted-foreground">Costas</figcaption>
      </figure>
    </div>
  );
}
