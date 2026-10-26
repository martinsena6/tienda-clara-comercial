// Datos de ejemplo solo para Compras y Gastos (todavía sin tabla en la base).
// Productos, precios, pedidos, stock y configuración viven en la base de datos (src/lib/data.ts).
import type { Expense, Purchase } from "./types";

export const purchases: Purchase[] = [
  { id: "u1", supplier: "Distribuidora", description: "Mercadería surtida", total: 84000, date: "2026-10-18" },
  { id: "u2", supplier: "Mayorista golosinas", description: "Gomitas surtidas", total: 39000, date: "2026-10-21" },
];

export const expenses: Expense[] = [
  { id: "e1", category: "Alquiler", description: "Alquiler del local – octubre", amount: 180000, date: "2026-10-01" },
  { id: "e2", category: "Servicios", description: "Internet y luz", amount: 32000, date: "2026-10-05" },
  { id: "e3", category: "Marketing", description: "Publicidad en redes", amount: 25000, date: "2026-10-12" },
];
