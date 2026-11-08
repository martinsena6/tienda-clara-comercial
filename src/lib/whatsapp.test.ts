import { describe, expect, it } from "vitest";
import { arWhatsAppPhone, buildWhatsAppUrl, buildWhatsAppUrls } from "./whatsapp";

describe("enlaces de WhatsApp argentinos", () => {
  it("agrega el prefijo móvil internacional a un celular local", () => {
    expect(arWhatsAppPhone("362 5436293")).toBe("5493625436293");
  });

  it("preserva el prefijo internacional existente", () => {
    expect(arWhatsAppPhone("+54 9 362 5436293")).toBe("5493625436293");
    expect(buildWhatsAppUrl("5493625436293", "Hola")).toContain("https://wa.me/5493625436293?");
  });

  it("quita el 15 y genera enlaces directo y web", () => {
    expect(arWhatsAppPhone("+54 9 362 15 5436293")).toBe("5493625436293");
    const urls = buildWhatsAppUrls("+54 362 15 5436293", "Hola Festiva");
    expect(urls.urlDirecta).toContain("https://wa.me/5493625436293?text=");
    expect(urls.urlWeb).toBe(urls.urlDirecta);
  });
});
