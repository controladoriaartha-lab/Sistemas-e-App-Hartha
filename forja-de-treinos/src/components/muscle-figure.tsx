import { overlayOpacity, type RegionId } from "@/lib/muscle-map";
import { IMAGE_SIZE, REGION_SHAPES } from "@/lib/muscle-regions";

const IMAGE_SRC = "/musculos.webp";
const LABEL_ROOM = 62;

type Levels = Partial<Record<RegionId, number>>;

const toPoints = (pts: [number, number][]) => pts.map(([x, y]) => `${x},${y}`).join(" ");

/**
 * Anatomia em 3D de frente e de costas. Todo o corpo aparece no tom claro;
 * cada grupo trabalhado volta a ser o vermelho original da imagem (cheio no
 * mais trabalhado, mais suave nos menos). Os contornos de cada grupo estão em
 * lib/muscle-regions.ts.
 */
export function MuscleFigure({ levels }: { levels: Levels }) {
  const worked = (Object.keys(REGION_SHAPES) as RegionId[]).filter(
    (id) => levels[id] !== undefined,
  );
  const { width, height } = IMAGE_SIZE;

  return (
    <div className="-mx-2 overflow-hidden rounded-2xl bg-[#14110f] px-1 pb-1 pt-3">
      <svg
        viewBox={`0 0 ${width} ${height + LABEL_ROOM}`}
        role="img"
        aria-label="Anatomia humana de frente e de costas, com os músculos trabalhados em vermelho"
        className="h-auto w-full"
      >
        <defs>
          {/* tom claro: tira a cor, clareia e dá um leve azul-acinzentado */}
          <filter id="mf-pale" colorInterpolationFilters="sRGB">
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncR type="linear" slope="0.62" intercept="0.5" />
              <feFuncG type="linear" slope="0.62" intercept="0.53" />
              <feFuncB type="linear" slope="0.6" intercept="0.6" />
            </feComponentTransfer>
          </filter>
          {/* vermelho mais escuro e saturado para o que foi mais trabalhado */}
          <filter id="mf-hot" colorInterpolationFilters="sRGB">
            <feColorMatrix
              type="matrix"
              values="1.1 0 0 0 -0.1  0 0.8 0 0 -0.02  0 0 0.8 0 -0.02  0 0 0 1 0"
            />
          </filter>
          {/* borda suave: o vermelho esmaece nas divisas em vez de cortar reto */}
          <filter
            id="mf-soft"
            filterUnits="userSpaceOnUse"
            x="0"
            y="0"
            width={width}
            height={height}
          >
            <feGaussianBlur stdDeviation="3.5" />
          </filter>
          {worked.map((id) => (
            <mask
              id={`mf-mask-${id}`}
              key={id}
              maskUnits="userSpaceOnUse"
              x="0"
              y="0"
              width={width}
              height={height}
            >
              <g fill="#fff" filter="url(#mf-soft)">
                {REGION_SHAPES[id].flatMap((shape, i) => [
                  <polygon key={`${i}-l`} points={toPoints(shape.pts)} />,
                  <polygon
                    key={`${i}-r`}
                    points={toPoints(shape.pts)}
                    transform={`translate(${2 * shape.xc} 0) scale(-1 1)`}
                  />,
                ])}
              </g>
            </mask>
          ))}
        </defs>

        <image href={IMAGE_SRC} width={width} height={height} filter="url(#mf-pale)" />

        {worked.map((id) => {
          const ratio = levels[id] ?? 0;
          return (
            <g
              key={id}
              mask={`url(#mf-mask-${id})`}
              opacity={overlayOpacity(ratio)}
              filter={ratio >= 0.7 ? "url(#mf-hot)" : undefined}
            >
              <image href={IMAGE_SRC} width={width} height={height} />
            </g>
          );
        })}

        <g fill="#9a9086" fontSize="50" textAnchor="middle">
          <text x="276" y="1038">
            Frente
          </text>
          <text x="880" y="1038">
            Costas
          </text>
        </g>
      </svg>
    </div>
  );
}
