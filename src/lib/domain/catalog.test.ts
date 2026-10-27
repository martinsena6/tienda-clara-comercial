import { describe, expect, it } from "vitest";
import { getAvailability, marginPct, searchPublicProducts } from "./catalog";
import { buildWhatsAppMessage } from "../whatsapp";
import type { PublicProduct } from "./types";

const sample: PublicProduct[] = [
  { slug: "a", name: "Chupetín Emoji", categorySlug: "chupetines", categoryName: "Chupetines", description: "", image: "", price: 100, availability: "disponible" },
  { slug: "b", name: "Goma Piñata", categorySlug: "gomitas", categoryName: "Gomitas", description: "", image: "", price: 200, availability: "sin_stock" },
];

describe("catálogo", () => {
  it("calcula la disponibilidad", () => {
    expect(getAvailability(0, 5)).toBe("sin_stock");
    expect(getAvailability(3, 5)).toBe("pocas_unidades");
    expect(getAvailability(10, 5)).toBe("disponible");
  });

  it("busca por nombre y categoría", () => {
    expect(searchPublicProducts(sample, "emoji").map((p) => p.slug)).toEqual(["a"]);
    expect(searchPublicProducts(sample, undefined, "gomitas").map((p) => p.slug)).toEqual(["b"]);
  });

  it("calcula el margen", () => {
    expect(marginPct(100, 60)).toBe(40);
  });

  it("el mensaje de WhatsApp incluye número de pedido", () => {
    const msg = buildWhatsAppMessage("Festiva", [{ name: "Chupetín Emoji", quantity: 2, unitPrice: 100 }], 7);
    expect(msg).toContain("#7");
    expect(msg).toContain("Chupetín Emoji");
  });
});
