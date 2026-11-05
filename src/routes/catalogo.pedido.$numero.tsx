import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Copy, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CatalogLayout, useSettings } from "@/components/catalog/CatalogLayout";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { buildOrderMessage, buildWhatsAppUrl, type OrderMessageData } from "@/lib/whatsapp";

export const Route = createFileRoute("/catalogo/pedido/$numero")({
  head: () => ({
    meta: [
      { title: "Pedido registrado — Festiva" },
      { name: "description", content: "Tu pedido quedó registrado. Envialo por WhatsApp." },
      { property: "og:title", content: "Pedido registrado — Festiva" },
      { property: "og:description", content: "Tu pedido quedó registrado." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Pedido,
});

function Pedido() {
  const { numero } = Route.useParams();
  const settings = useSettings();
  const { clear } = useCart();
  const [order, setOrder] = useState<OrderMessageData | null | undefined>(undefined);

  useEffect(() => {
    let o: OrderMessageData | null = null;
    try { const s = sessionStorage.getItem(`festiva-pedido-${numero}`); if (s) o = JSON.parse(s); } catch { /* sin almacenamiento */ }
    setOrder(o);
    if (o) clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numero]);

  if (order === undefined) return <CatalogLayout><p className="text-muted-foreground">Cargando…</p></CatalogLayout>;
  if (!order) {
    return (
      <CatalogLayout>
        <div className="mx-auto max-w-md rounded-2xl border bg-card p-8 text-center">
          <p>No encontramos los datos de este pedido en este dispositivo.</p>
          <Button asChild className="mt-4"><Link to="/catalogo/productos">Ir al catálogo</Link></Button>
        </div>
      </CatalogLayout>
    );
  }
  const msg = buildOrderMessage(settings.name, order);
  const copy = async () => {
    try { await navigator.clipboard.writeText(msg); toast.success("Mensaje copiado"); } catch { toast.error("No se pudo copiar"); }
  };
  return (
    <CatalogLayout>
      <div className="mx-auto max-w-lg space-y-5 rounded-2xl border bg-card p-6 shadow-soft">
        <div className="text-center">
          <CheckCircle2 className="mx-auto size-12 text-success" />
          <h1 className="mt-2 text-2xl font-bold">¡Pedido #{order.number} registrado!</h1>
          <p className="text-sm text-muted-foreground">Envialo por WhatsApp para que lo confirmemos.</p>
        </div>
        <ul className="divide-y text-sm">
          {order.items.map((i) => <li key={i.name} className="flex justify-between py-1.5"><span>{i.quantity} x {i.name}</span><span>{formatPrice(i.quantity * i.unit_price)}</span></li>)}
        </ul>
        <div className="flex justify-between text-lg font-bold"><span>Total</span><span>{formatPrice(order.total)}</span></div>
        <p className="text-sm text-muted-foreground">{order.delivery === "envio" ? `Envío a ${order.address}` : "Retiro en el local"}{order.eventDate ? ` · Evento: ${order.eventDate}` : ""}</p>
        <Button asChild size="lg" className="w-full bg-whatsapp text-whatsapp-foreground hover:bg-whatsapp/90">
          <a href={buildWhatsAppUrl(settings.whatsapp, msg)} target="_blank" rel="noopener noreferrer"><MessageCircle /> Enviar por WhatsApp</a>
        </Button>
        <Button variant="outline" className="w-full" onClick={copy}><Copy /> Copiar mensaje</Button>
      </div>
    </CatalogLayout>
  );
}
