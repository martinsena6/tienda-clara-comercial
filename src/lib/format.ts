import type { Availability, OrderStatus, StockMovementType } from "./domain/types";

const ars = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

export function formatPrice(n: number): string {
  return ars.format(n);
}

const TZ = "America/Argentina/Buenos_Aires";
const dateFmt = new Intl.DateTimeFormat("es-AR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("es-AR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

/** Acepta fecha sola (aaaa-mm-dd) o fecha y hora completa. */
function toDate(v: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T12:00:00-03:00`) : new Date(v);
}

export function formatDate(v: string): string {
  const d = toDate(v);
  return isNaN(d.getTime()) ? "" : dateFmt.format(d);
}

export function formatDateTime(v: string): string {
  const d = toDate(v);
  return isNaN(d.getTime()) ? "" : dateTimeFmt.format(d).replace(",", "");
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
