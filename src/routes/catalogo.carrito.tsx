import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageCircle, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/admin/FormField";
import { CatalogLayout, useSettings } from "@/components/catalog/CatalogLayout";
import { EmptyState } from "@/components/shared/EmptyState";
import { useCart } from "@/lib/cart";
import { createOrder, errorMessage, publicProductsQuery } from "@/lib/data";
import { formatPrice } from "@/lib/format";
import { buildWhatsAppMessage, buildWhatsAppUrl } from "@/lib/whatsapp";

export const Route = createFileRoute("/catalogo/carrito")({
  head: () => ({
    meta: [
      { title: "Tu carrito — Festiva" },
      { name: "description", content: "Revisá tu pedido y envialo por WhatsApp." },
      { property: "og:title", content: "Tu carrito — Festiva" },
      { property: "og:description", content: "Revisá tu pedido y envialo por WhatsApp." },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(publicProductsQuery),
  errorComponent: ({ error }) => (
    <CatalogLayout>
      <p role="alert" className="text-center text-muted-foreground">No pudimos cargar el carrito. {error instanceof Error ? error.message : ""}</p>
    </CatalogLayout>
  ),
  component: Carrito,
});

function Carrito() {
  const { items, setQuantity, remove, clear } = useCart();
  const { data: products } = useSuspenseQuery(publicProductsQuery);
  const settings = useSettings();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const lines = Object.entries(items)
    .map(([slug, quantity]) => ({ product: products.find((p) => p.slug === slug), quantity }))
    .filter((l): l is { product: NonNullable<typeof l.product>; quantity: number } => Boolean(l.product) && l.quantity > 0);
  const total = lines.reduce((s, l) => s + l.product.price * l.quantity, 0);

  const send = async () => {
    if (!name.trim()) {
      toast.error("Ingresá tu nombre para registrar el pedido");
      return;
    }
    setBusy(true);
    try {
      const order = await createOrder(
        lines.map((l) => ({ slug: l.product.slug, quantity: l.quantity })),
        name.trim(),
      );
      const message = buildWhatsAppMessage(
        settings.name,
        lines.map((l) => ({ name: l.product.name, quantity: l.quantity, price: l.product.price })),
        order.order_number,
      );
      window.open(buildWhatsAppUrl(settings.whatsapp, message), "_blank", "noopener");
      toast.success(`Pedido #${order.order_number} registrado`, { description: "Queda pendiente hasta que el negocio lo confirme." });
      clear();
      setName("");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <CatalogLayout>
      <h1 className="text-3xl font-bold">Tu carrito</h1>
      {lines.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon={ShoppingCart} title="Tu carrito está vacío" description="Agregá productos del catálogo para armar tu pedido." action={<Button asChild><Link to="/catalogo/productos">Ver productos</Link></Button>} />
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
          <ul className="divide-y rounded-2xl border bg-card">
            {lines.map(({ product, quantity }) => (
              <li key={product.slug} className="flex gap-4 p-4">
                <img src={product.image} alt={product.name} width={816} height={816} loading="lazy" className="size-20 rounded-lg object-cover" />
                <div className="flex flex-1 flex-col gap-2">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{product.name}</span>
                    <span className="font-display font-bold">{formatPrice(product.price * quantity)}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatPrice(product.price)} c/u</span>
                  <div className="flex items-center gap-2">
                    <Button size="icon" variant="outline" className="size-8" onClick={() => setQuantity(product.slug, quantity - 1)} aria-label="Restar"><Minus /></Button>
                    <span className="w-6 text-center text-sm">{quantity}</span>
                    <Button size="icon" variant="outline" className="size-8" onClick={() => setQuantity(product.slug, quantity + 1)} aria-label="Sumar"><Plus /></Button>
                    <Button size="sm" variant="ghost" className="ml-auto text-muted-foreground" onClick={() => remove(product.slug)}><Trash2 /> Quitar</Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <aside className="h-fit space-y-4 rounded-2xl border bg-card p-5 shadow-soft">
            <div className="flex justify-between text-lg"><span>Total estimado</span><span className="font-display font-bold">{formatPrice(total)}</span></div>
            <FormField label="Tu nombre" htmlFor="customer-name" hint="Así identificamos tu pedido">
              <Input id="customer-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre y apellido" maxLength={120} />
            </FormField>
            <Button size="lg" className="w-full bg-whatsapp text-whatsapp-foreground hover:bg-whatsapp/90" disabled={busy} onClick={send}>
              <MessageCircle /> {busy ? "Enviando…" : "Pedir por WhatsApp"}
            </Button>
            <p className="text-xs text-muted-foreground">Tu pedido queda pendiente hasta que el negocio confirme disponibilidad. No se realiza ningún cobro online.</p>
          </aside>
        </div>
      )}
    </CatalogLayout>
  );
}
