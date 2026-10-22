import { createFileRoute, Link } from "@tanstack/react-router";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CatalogLayout } from "@/components/catalog/CatalogLayout";
import { WhatsAppButton } from "@/components/catalog/WhatsAppButton";
import { EmptyState } from "@/components/shared/EmptyState";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/format";

export const Route = createFileRoute("/catalogo/carrito")({
  head: () => ({
    meta: [
      { title: "Tu carrito — Catálogo" },
      { name: "description", content: "Revisá tu pedido y envialo por WhatsApp." },
      { property: "og:title", content: "Tu carrito — Catálogo" },
      { property: "og:description", content: "Revisá tu pedido y envialo por WhatsApp." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Carrito,
});

function Carrito() {
  const { lines, total, setQuantity, remove } = useCart();
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
            <WhatsAppButton lines={lines.map((l) => ({ name: l.product.name, quantity: l.quantity, price: l.product.price }))} />
            <p className="text-xs text-muted-foreground">Tu pedido queda pendiente hasta que el negocio confirme disponibilidad. No se realiza ningún cobro online.</p>
          </aside>
        </div>
      )}
    </CatalogLayout>
  );
}
