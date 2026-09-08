import { Badge } from "@/components/ui/badge";
import { INTENSITY_LABEL, type Intensity } from "@/lib/types";

const variant: Record<Intensity, "accent" | "warn" | "ok"> = {
  forte: "accent",
  medio: "warn",
  leve: "ok",
};

export function IntensityBadge({ intensity }: { intensity: Intensity }) {
  return <Badge variant={variant[intensity]}>{INTENSITY_LABEL[intensity]}</Badge>;
}
