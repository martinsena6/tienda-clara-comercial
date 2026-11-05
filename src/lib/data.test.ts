import { describe, expect, it } from "vitest";
import { parseArNumber } from "./data";

describe("importación de números", () => {
  it("interpreta moneda argentina y decimal con punto", () => {
    expect(parseArNumber("$ 1.234,50")).toBe(1234.5);
    expect(parseArNumber("USD 1234.56")).toBe(1234.56);
  });

  it("distingue celdas vacías de valores inválidos", () => {
    expect(parseArNumber("")).toBeNull();
    expect(Number.isNaN(parseArNumber("sin costo"))).toBe(true);
    expect(parseArNumber("-12,50")).toBe(-12.5);
  });
});
