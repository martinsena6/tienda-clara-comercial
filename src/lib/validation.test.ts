import { describe, expect, it } from "vitest";
import { driveLinksSchema, productCatalogSchema } from "./validation";

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

  it("valida enlaces Drive seguros y rechaza otros destinos", () => {
    expect(
      driveLinksSchema.safeParse({
        photos_url: "https://drive.google.com/drive/folders/fotos",
        spreadsheets_url: "https://docs.google.com/spreadsheets/d/costos",
      }).success,
    ).toBe(true);
    expect(
      driveLinksSchema.safeParse({
        photos_url: "http://drive.google.com/folder",
        spreadsheets_url: "https://example.com/costos",
      }).success,
    ).toBe(false);
  });
});
