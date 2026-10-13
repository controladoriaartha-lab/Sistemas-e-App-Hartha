import { INTENSITY_LABEL, type Intensity } from "@/lib/types";

export function IntensityBadge({ intensity }: { intensity: Intensity }) {
  return (
    <span className="badge-3d" data-tone={intensity}>
      {INTENSITY_LABEL[intensity]}
    </span>
  );
}
