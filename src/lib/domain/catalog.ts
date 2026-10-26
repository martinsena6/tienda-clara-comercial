import type { Availability, PublicProduct } from "./types";

export function getAvailability(stock: number, minStock: number): Availability {
  if (stock <= 0) return "sin_stock";
  if (stock <= minStock) return "pocas_unidades";
  return "disponible";
}

/** Busca sobre la vista pública: nunca toca costo, proveedor ni stock. */
export function searchPublicProducts(products: PublicProduct[], q?: string, categorySlug?: string): PublicProduct[] {
  const term = (q ?? "").trim().toLowerCase();
  return products.filter(
    (p) =>
      (!categorySlug || p.categorySlug === categorySlug) &&
      (!term || p.name.toLowerCase().includes(term) || p.categoryName.toLowerCase().includes(term)),
  );
}

/** Margen bruto en porcentaje sobre el precio de venta. */
export function marginPct(price: number, cost: number): number {
  if (price <= 0) return 0;
  return Math.round(((price - cost) / price) * 100);
}
