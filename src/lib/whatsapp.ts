import { formatPrice } from "./format";

export interface WhatsAppLine {
  name: string;
  quantity: number;
  price: number;
}

/** Arma el texto del pedido. El pedido queda PENDIENTE: no es una venta confirmada. */
export function buildWhatsAppMessage(businessName: string, lines: WhatsAppLine[]): string {
  const total = lines.reduce((s, l) => s + l.quantity * l.price, 0);
  const detail = lines.map((l) => `• ${l.quantity} x ${l.name} — ${formatPrice(l.quantity * l.price)}`);
  return [
    `Hola ${businessName}, quiero hacer este pedido:`,
    "",
    ...detail,
    "",
    `Total estimado: ${formatPrice(total)}`,
    "Quedo a la espera de la confirmación. ¡Gracias!",
  ].join("\n");
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}
