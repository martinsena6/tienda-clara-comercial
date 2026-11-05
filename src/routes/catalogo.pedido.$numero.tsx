import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Copy, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CatalogLayout, useSettings } from "@/components/catalog/CatalogLayout";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { buildOrderMessage, buildWhatsAppUrl } from "@/lib/whatsapp";

interface OrderPayload {
  number: number;
  total: number;
  items: { name: string; quantity: number; unit_price: number }[];
  name: string;
  phone: string;
  delivery: "retiro" | "envio";
  address: string;
  eventDate: string;
  notes: string;
}

function isOrderPayload(value: unknown, expectedNumber: number): value is OrderPayload {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  return (
    o["number"] === expectedNumber &&
    typeof o["total"] === "number" &&
    typeof o["name"] === "string" &&
    typeof o["phone"] === "string" &&
    (o["delivery"] === "retiro" || o["delivery"] === "envio") &&
    Array.isArray(o["items"]) &&
    o["items"].every(
      (item) =>
        item &&
        typeof item.name === "string" &&
        typeof item.quantity === "number" &&
        typeof item.unit_price === "number",
    )
  );
}

export const Route = createFileRoute("/catalogo/pedido/$numero")({
  head: () => ({
    meta: [
      { title: "Pedido registrado — Festiva" },
      { name: "description", content: "Resumen de tu pedido registrado." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PedidoRegistrado,
});

function PedidoRegistrado() {
  const { numero } = Route.useParams();
  const settings = useSettings();
  const { clear } = useCart();
  const [payload, setPayload] = useState<OrderPayload | null>(null);

  useEffect(() => {
    const number = Number(numero);
    if (!Number.isSafeInteger(number) || number <= 0) return;
    try {
      const raw = sessionStorage.getItem(`festiva-pedido-${number}`);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (!isOrderPayload(parsed, number)) return;
      setPayload(parsed);
      clear();
    } catch {
      setPayload(null);
    }
  }, [numero, clear]);

  if (!payload) {
    return (
      <CatalogLayout>
        <section className="mx-auto max-w-xl rounded-2xl border bg-card p-8 text-center">
          <h1 className="text-xl font-semibold">No encontramos los datos de este pedido</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Volvé al catálogo para armar un nuevo pedido.
          </p>
          <Button asChild className="mt-5">
            <Link to="/catalogo/productos">Ir al catálogo</Link>
          </Button>
        </section>
      </CatalogLayout>
    );
  }

  const message = buildOrderMessage(settings.name, payload);
  const whatsappUrl = buildWhatsAppUrl(settings.whatsapp, message);
  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message);
      toast.success("Mensaje copiado");
    } catch {
      toast.error("No se pudo copiar el mensaje. Seleccionalo y copialo manualmente.");
    }
  };

  return (
    <CatalogLayout>
      <section className="mx-auto max-w-2xl rounded-2xl border bg-card p-6 shadow-soft sm:p-8">
        <div className="text-center">
          <CheckCircle2 className="mx-auto size-12 text-success" />
          <h1 className="mt-3 font-display text-2xl font-bold">
            ¡Pedido #{payload.number} registrado!
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tu pedido queda pendiente hasta que el negocio confirme la disponibilidad.
          </p>
        </div>
        <ul className="my-6 divide-y border-y">
          {payload.items.map((item, index) => (
            <li key={`${item.name}-${index}`} className="flex justify-between gap-4 py-3 text-sm">
              <span>
                {item.quantity} × {item.name}
              </span>
              <span className="whitespace-nowrap font-medium">
                {formatPrice(item.quantity * item.unit_price)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mb-6 flex justify-between text-lg font-semibold">
          <span>Total</span>
          <span>{formatPrice(payload.total)}</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-whatsapp px-4 py-2 text-sm font-medium text-whatsapp-foreground hover:bg-whatsapp/90"
          >
            <MessageCircle className="size-4" /> Enviar por WhatsApp
          </a>
          <Button variant="outline" onClick={copyMessage}>
            <Copy /> Copiar mensaje
          </Button>
        </div>
      </section>
    </CatalogLayout>
  );
}
