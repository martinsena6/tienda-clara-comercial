import { formatPrice } from "./format";

export interface WhatsAppLine {
  name: string;
  quantity: number;
  price: number;
}

/** Arma el texto del pedido. El pedido queda PENDIENTE: no es una venta confirmada. */
export function buildWhatsAppMessage(
  businessName: string,
  lines: WhatsAppLine[],
  orderNumber?: number,
): string {
  const total = lines.reduce((s, l) => s + l.quantity * l.price, 0);
  const detail = lines.map(
    (l) => `• ${l.quantity} x ${l.name} — ${formatPrice(l.quantity * l.price)}`,
  );
  return [
    `Hola ${businessName}, quiero hacer este pedido:`,
    ...(orderNumber ? ["", `Pedido #${orderNumber}`] : []),
    "",
    ...detail,
    "",
    `Total estimado: ${formatPrice(total)}`,
    "Quedo a la espera de la confirmación. ¡Gracias!",
  ].join("\n");
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  return `https://wa.me/${arWhatsAppPhone(phone)}?text=${encodeURIComponent(message)}`;
}

export function buildWhatsAppUrls(
  phone: string,
  message: string,
): { urlDirecta: string; urlWeb: string } {
  const cleanPhone = arWhatsAppPhone(phone);
  const text = encodeURIComponent(message);
  return {
    urlDirecta: `https://wa.me/${cleanPhone}?text=${text}`,
    urlWeb: `https://wa.me/${cleanPhone}?text=${text}`,
  };
}

export function arWhatsAppPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  let nationalNumber = digits;
  if (digits.startsWith("549")) nationalNumber = digits.slice(3);
  else if (digits.startsWith("54")) nationalNumber = digits.slice(2).replace(/^9/, "");

  if (nationalNumber.startsWith("36215")) {
    nationalNumber = `362${nationalNumber.slice(5)}`;
  }
  if (nationalNumber.length === 10 || digits.startsWith("549")) return `549${nationalNumber}`;
  return digits;
}

export interface OrderMessageData {
  number: number;
  name: string;
  phone: string;
  delivery: "retiro" | "envio";
  address?: string;
  eventDate?: string;
  notes?: string;
  items: { name: string; quantity: number; unit_price: number }[];
  total: number;
}

/** Mensaje completo del pedido registrado (queda PENDIENTE hasta que el negocio lo confirme). */
export function buildOrderMessage(businessName: string, o: OrderMessageData): string {
  return [
    `Hola ${businessName}, hice el pedido #${o.number}:`,
    "",
    ...o.items.map(
      (i) => `• ${i.quantity} x ${i.name} — ${formatPrice(i.quantity * i.unit_price)}`,
    ),
    "",
    `Total: ${formatPrice(o.total)}`,
    "",
    `Nombre: ${o.name}`,
    `Celular: ${o.phone}`,
    o.delivery === "envio" ? `Entrega: Envío a ${o.address ?? ""}` : "Entrega: Retiro en el local",
    ...(o.eventDate ? [`Fecha del evento: ${o.eventDate}`] : []),
    ...(o.notes ? [`Aclaraciones: ${o.notes}`] : []),
    "",
    "Quedo a la espera de la confirmación. ¡Gracias!",
  ].join("\n");
}
