import type { Availability } from "@/lib/domain/types";
import { availabilityLabel } from "@/lib/format";
import { StatusBadge } from "./StatusBadge";

const tone = { disponible: "success", pocas_unidades: "warning", sin_stock: "danger" } as const;

export function AvailabilityBadge({ value }: { value: Availability }) {
  return <StatusBadge tone={tone[value]}>{availabilityLabel[value]}</StatusBadge>;
}
