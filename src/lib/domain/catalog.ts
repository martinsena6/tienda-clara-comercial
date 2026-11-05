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
      (!term ||
        normalizeSearch(p.name).includes(normalizeSearch(term)) ||
        normalizeSearch(p.categoryName).includes(normalizeSearch(term))),
  );
}

export function normalizeSearch(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
}

export interface CatalogFilters {
  minPrice?: number;
  maxPrice?: number;
  availableOnly?: boolean;
  order?: "price-asc" | "price-desc" | "name";
}

export function filterPublicProducts(products: PublicProduct[], filters: CatalogFilters): PublicProduct[] {
  const filtered = products.filter((product) =>
    (filters.minPrice === undefined || product.price >= filters.minPrice) &&
    (filters.maxPrice === undefined || product.price <= filters.maxPrice) &&
    (!filters.availableOnly || product.availability !== "sin_stock"),
  );
  return filtered.sort((a, b) => {
    const stockOrder = Number(a.availability === "sin_stock") - Number(b.availability === "sin_stock");
    if (stockOrder) return stockOrder;
    if (filters.order === "price-asc") return a.price - b.price;
    if (filters.order === "price-desc") return b.price - a.price;
    if (filters.order === "name") return normalizeSearch(a.name).localeCompare(normalizeSearch(b.name), "es");
    return 0;
  });
}

/** Margen bruto en porcentaje sobre el precio de venta. */
export function marginPct(price: number, cost: number): number {
  if (price <= 0) return 0;
  return Math.round(((price - cost) / price) * 100);
}
