import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  Copy,
  FileText,
  MapPin,
  MessageCircle,
  Phone,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CatalogLayout, useSettings } from "@/components/catalog/CatalogLayout";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { buildOrderMessage, buildWhatsAppUrls } from "@/lib/whatsapp";

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
    Number.isFinite(o["total"]) &&
    typeof o["name"] === "string" &&
    typeof o["phone"] === "string" &&
    (o["delivery"] === "retiro" || o["delivery"] === "envio") &&
    typeof o["address"] === "string" &&
    typeof o["eventDate"] === "string" &&
    typeof o["notes"] === "string" &&
    Array.isArray(o["items"]) &&
    o["items"].every(
      (item) =>
        item &&
        typeof item.name === "string" &&
        typeof item.quantity === "number" &&
        Number.isSafeInteger(item.quantity) &&
        item.quantity > 0 &&
        typeof item.unit_price === "number" &&
        Number.isFinite(item.unit_price) &&
        item.unit_price >= 0,
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
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const number = Number(numero);
    if (!Number.isSafeInteger(number) || number <= 0) {
      setLoaded(true);
      return;
    }

    const storageKey = `festiva-pedido-${number}`;
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(storageKey);
    } catch {
      /* puede usarse el respaldo local */
    }
    if (!raw) {
      try {
        raw = localStorage.getItem(storageKey);
      } catch {
        /* el almacenamiento puede estar deshabilitado */
      }
    }

    try {
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (isOrderPayload(parsed, number)) {
        setPayload(parsed);
        clear();
      }
    } catch {
      setPayload(null);
    } finally {
      try {
        localStorage.removeItem(storageKey);
      } catch {
        /* el almacenamiento puede estar deshabilitado */
      }
      setLoaded(true);
    }
  }, [numero, clear]);

  if (!loaded) {
    return (
      <CatalogLayout>
        <p role="status" className="text-center text-sm text-muted-foreground">
          Cargando los datos del pedido…
        </p>
      </CatalogLayout>
    );
  }

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
  const { urlDirecta, urlWeb } = buildWhatsAppUrls(settings.whatsapp, message);
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
        <section
          aria-labelledby="customer-details-heading"
          className="mb-6 space-y-3 rounded-xl border bg-secondary/40 p-4 text-sm"
        >
          <h2 id="customer-details-heading" className="flex items-center gap-2 font-semibold">
            <User className="size-4 text-primary" /> Datos del cliente y entrega
          </h2>
          <div className="grid gap-2 text-muted-foreground sm:grid-cols-2">
            <p>
              <span className="font-medium text-foreground">Nombre:</span> {payload.name}
            </p>
            <p className="flex items-center gap-1">
              <Phone className="size-3.5" />
              <span className="font-medium text-foreground">Celular:</span> {payload.phone}
            </p>
            <p className="flex items-start gap-1 sm:col-span-2">
              <MapPin className="mt-0.5 size-3.5 shrink-0" />
              <span>
                <span className="font-medium text-foreground">Entrega:</span>{" "}
                {payload.delivery === "envio"
                  ? `Envío a domicilio${payload.address ? ` — ${payload.address}` : ""}`
                  : "Retiro en el local"}
              </span>
            </p>
            {payload.eventDate && (
              <p className="flex items-center gap-1 sm:col-span-2">
                <Calendar className="size-3.5" />
                <span>
                  <span className="font-medium text-foreground">Fecha del evento:</span>{" "}
                  {payload.eventDate}
                </span>
              </p>
            )}
            {payload.notes && (
              <p className="flex items-start gap-1 sm:col-span-2">
                <FileText className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  <span className="font-medium text-foreground">Aclaraciones:</span> {payload.notes}
                </span>
              </p>
            )}
          </div>
        </section>
        <div className="grid gap-3 sm:grid-cols-2">
          <a
            href={urlDirecta}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-whatsapp px-4 py-2 text-sm font-medium text-whatsapp-foreground hover:bg-whatsapp/90"
          >
            <MessageCircle className="size-4" /> Abrir en WhatsApp
          </a>
          <Button variant="outline" onClick={copyMessage}>
            <Copy /> Copiar mensaje al portapapeles
          </Button>
        </div>
        <p className="mt-3 text-center text-sm text-muted-foreground">
          ¿Abrir en WhatsApp Web desde la compu?{" "}
          <a
            href={urlWeb}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline"
          >
            Abrir WhatsApp Web
          </a>
        </p>
      </section>
    </CatalogLayout>
  );
}
