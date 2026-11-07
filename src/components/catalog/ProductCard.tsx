import { Link } from "@tanstack/react-router";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AvailabilityBadge } from "@/components/shared/AvailabilityBadge";
import type { PublicProduct } from "@/lib/domain/types";
import { formatPrice } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { ProductImage } from "./ProductImage";

export function ProductCard({ product }: { product: PublicProduct }) {
  const { add, items, setQuantity, remove } = useCart();
  const quantity = items[product.slug] ?? 0;
  const out = product.availability === "sin_stock";
  const photo = product.images[0] || product.image;
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border bg-card shadow-soft transition-shadow hover:shadow-lift">
      <Link
        to="/catalogo/producto/$slug"
        params={{ slug: product.slug }}
        className="block aspect-square overflow-hidden bg-muted"
      >
        <ProductImage
          src={photo}
          alt={product.name}
          className="size-full transition-transform duration-500 group-hover:scale-105"
          imgClassName="size-full object-cover"
        />
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <span className="text-xs text-muted-foreground">{product.categoryName}</span>
        {product.badge && (
          <span className="w-fit rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
            {product.badge}
          </span>
        )}
        <Link
          to="/catalogo/producto/$slug"
          params={{ slug: product.slug }}
          className="font-display font-semibold leading-snug hover:text-primary"
        >
          {product.name}
        </Link>
        <AvailabilityBadge value={product.availability} />
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="font-display text-lg font-bold">{formatPrice(product.price)}</span>
          {out && !quantity ? (
            <Button size="sm" variant="outline" disabled>
              Sin stock
            </Button>
          ) : quantity ? (
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="outline"
                aria-label={`Quitar una unidad de ${product.name}`}
                onClick={() =>
                  quantity === 1 ? remove(product.slug) : setQuantity(product.slug, quantity - 1)
                }
              >
                <Minus />
              </Button>
              <span className="min-w-6 text-center text-sm font-medium">{quantity}</span>
              <Button
                size="icon"
                variant="outline"
                disabled={out}
                aria-label={`Agregar una unidad de ${product.name}`}
                onClick={() => setQuantity(product.slug, quantity + 1)}
              >
                <Plus />
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              onClick={() => {
                add(product.slug);
                toast.success(`${product.name} agregado al carrito`);
              }}
              aria-label={`Agregar ${product.name}`}
            >
              <Plus /> Agregar
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

export function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
    >
      {label}
    </button>
  );
}
