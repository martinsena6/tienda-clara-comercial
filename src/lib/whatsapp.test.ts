import { describe, expect, it } from "vitest";
import { arWhatsAppPhone, buildWhatsAppUrl } from "./whatsapp";

describe("enlaces de WhatsApp argentinos", () => {
  it("agrega el prefijo móvil internacional a un celular local", () => {
    expect(arWhatsAppPhone("362 5436293")).toBe("5493625436293");
  });

  it("preserva el prefijo internacional existente", () => {
    expect(arWhatsAppPhone("+54 9 362 5436293")).toBe("5493625436293");
    expect(buildWhatsAppUrl("5493625436293", "Hola")).toContain("https://wa.me/5493625436293?");
  });
});
