import { describe, expect, it } from "vitest";
import { productCatalogSchema, productSchema } from "./validation";

describe("validación del catálogo para vendedor", () => {
  it("permite cargar un producto sin pedir costo ni proveedor", () => {
    expect(
      productCatalogSchema.safeParse({
        name: "Gomitas",
        category_id: "golosinas",
        price: "1500",
        featured: "on",
        badge: "Nuevo",
        description: "",
      }).success,
    ).toBe(true);
  });

  it("usa siete como mínimo e inicializa el stock solicitado", () => {
    const parsed = productSchema.safeParse({
      name: "Gomitas",
      category_id: "golosinas",
      price: "190",
      cost: "100",
      featured: "on",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.min_stock).toBe(7);
      expect(parsed.data.initial_stock).toBe(0);
    }
  });
});
