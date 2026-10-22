import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AvailabilityBadge } from "@/components/shared/AvailabilityBadge";
import type { PublicProduct } from "@/lib/domain/types";
import { formatPrice } from "@/lib/format";
import { useCart } from "@/lib/cart";

export function ProductCard({ product }: { product: PublicProduct }) {
  const { add } = useCart();
  const out = product.availability === "sin_stock";
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border bg-card shadow-soft transition-shadow hover:shadow-lift">
      <Link to="/catalogo/producto/$slug" params={{ slug: product.slug }} className="block aspect-square overflow-hidden bg-muted">
        <img src={product.image} alt={product.name} loading="lazy" width={816} height={816} className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <span className="text-xs text-muted-foreground">{product.categoryName}</span>
        <Link to="/catalogo/producto/$slug" params={{ slug: product.slug }} className="font-display font-semibold leading-snug hover:text-primary">
          {product.name}
        </Link>
        <AvailabilityBadge value={product.availability} />
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="font-display text-lg font-bold">{formatPrice(product.price)}</span>
          <Button size="sm" disabled={out} onClick={() => { add(product.slug); toast.success(`${product.name} agregado al carrito`); }} aria-label={`Agregar ${product.name}`}>
            <Plus /> Agregar
          </Button>
        </div>
      </div>
    </article>
  );
}

export function CategoryChip({ label, active, onClick }: { label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}>
      {label}
    </button>
  );
}
