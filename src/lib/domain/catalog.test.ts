import { describe, expect, it } from "vitest";
import { getAvailability, getPublicProducts, toPublicProduct } from "./catalog";
import { products } from "./mock-data";
import { buildWhatsAppMessage } from "../whatsapp";

describe("catálogo público", () => {
  it("no expone costo, proveedor ni stock", () => {
    const pub = toPublicProduct(products[0]!) as unknown as Record<string, unknown>;
    expect(pub).not.toHaveProperty("cost");
    expect(pub).not.toHaveProperty("supplier");
    expect(pub).not.toHaveProperty("stock");
    expect(pub).not.toHaveProperty("id");
  });

  it("usa el mismo precio que el producto interno (fuente única)", () => {
    const pub = getPublicProducts().find((p) => p.slug === products[1]!.slug);
    expect(pub?.price).toBe(products[1]!.price);
  });

  it("calcula la disponibilidad", () => {
    expect(getAvailability(0, 3)).toBe("sin_stock");
    expect(getAvailability(3, 3)).toBe("pocas_unidades");
    expect(getAvailability(10, 3)).toBe("disponible");
  });
});

describe("pedido por WhatsApp", () => {
  it("incluye el total y pide confirmación", () => {
    const msg = buildWhatsAppMessage("Tienda", [
      { name: "Taza", quantity: 2, price: 1000 },
      { name: "Vela", quantity: 1, price: 500 },
    ]);
    expect(msg).toContain("2 x Taza");
    expect(msg.replace(/\s/g, "")).toContain("$2.500");
    expect(msg).toContain("confirmación");
  });
});
