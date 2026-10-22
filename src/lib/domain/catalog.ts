import { categories, products } from "./mock-data";
import type { Availability, Order, Product, PublicProduct } from "./types";

export function getAvailability(stock: number, minStock: number): Availability {
  if (stock <= 0) return "sin_stock";
  if (stock <= minStock) return "pocas_unidades";
  return "disponible";
}

/** Única puerta de salida hacia el catálogo: elimina costo, proveedor y stock. */
export function toPublicProduct(p: Product): PublicProduct {
  const cat = categories.find((c) => c.id === p.categoryId);
  return {
    slug: p.slug,
    name: p.name,
    categorySlug: cat?.slug ?? "",
    categoryName: cat?.name ?? "Sin categoría",
    description: p.description,
    image: p.image,
    price: p.price,
    availability: getAvailability(p.stock, p.minStock),
  };
}

export function getPublicProducts(): PublicProduct[] {
  return products.filter((p) => p.active).map(toPublicProduct);
}

export function getPublicProduct(slug: string): PublicProduct | undefined {
  return getPublicProducts().find((p) => p.slug === slug);
}

export function searchPublicProducts(q?: string, categorySlug?: string): PublicProduct[] {
  const term = (q ?? "").trim().toLowerCase();
  return getPublicProducts().filter(
    (p) =>
      (!categorySlug || p.categorySlug === categorySlug) &&
      (!term || p.name.toLowerCase().includes(term) || p.categoryName.toLowerCase().includes(term)),
  );
}

// Utilidades del panel (datos internos)
export function productName(id: string): string {
  return products.find((p) => p.id === id)?.name ?? "Producto eliminado";
}

export function categoryName(id: string): string {
  return categories.find((c) => c.id === id)?.name ?? "Sin categoría";
}

export function orderTotal(o: Order): number {
  return o.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
}

/** Margen bruto en porcentaje sobre el precio de venta. */
export function marginPct(price: number, cost: number): number {
  if (price <= 0) return 0;
  return Math.round(((price - cost) / price) * 100);
}
