import type { Availability, OrderStatus, StockMovementType } from "./domain/types";

const ars = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

export function formatPrice(n: number): string {
  return ars.format(n);
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export const availabilityLabel: Record<Availability, string> = {
  disponible: "Disponible",
  pocas_unidades: "Pocas unidades",
  sin_stock: "Sin stock",
};

export const orderStatusLabel: Record<OrderStatus, string> = {
  pendiente: "Pendiente de confirmar",
  confirmado: "Venta confirmada",
  cancelado: "Cancelado",
};

export const movementLabel: Record<StockMovementType, string> = {
  entrada: "Entrada",
  salida: "Salida",
  ajuste: "Ajuste",
};
