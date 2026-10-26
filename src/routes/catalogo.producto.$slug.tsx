import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CatalogLayout } from "@/components/catalog/CatalogLayout";
import { AvailabilityBadge } from "@/components/shared/AvailabilityBadge";
import { formatPrice } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { publicProductsQuery } from "@/lib/data";

export const Route = createFileRoute("/catalogo/producto/$slug")({
  loader: async ({ params, context }) => {
    const products = await context.queryClient.ensureQueryData(publicProductsQuery);
    const product = products.find((p) => p.slug === params.slug);
    if (!product) throw notFound();
    return { product };
  },
  head: ({ loaderData }) => {
    const title = loaderData ? `${loaderData.product.name} — Festiva` : "Producto no disponible";
    const desc = loaderData?.product.description || "Producto no disponible.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        ...(loaderData ? [] : [{ name: "robots", content: "noindex" }]),
      ],
    };
  },
  notFoundComponent: () => (
    <CatalogLayout>
      <p className="text-center text-muted-foreground">Este producto no está disponible. <Link to="/catalogo/productos" className="text-primary">Ver productos</Link></p>
    </CatalogLayout>
  ),
  errorComponent: ({ error }) => (
    <CatalogLayout>
      <p role="alert" className="text-center text-muted-foreground">No pudimos cargar el producto. {error instanceof Error ? error.message : ""}</p>
    </CatalogLayout>
  ),
  component: Detalle,
});

function Detalle() {
  const { product } = Route.useLoaderData();
  const { add } = useCart();
  const out = product.availability === "sin_stock";
  return (
    <CatalogLayout>
      <Link to="/catalogo/productos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Volver a productos</Link>
      <div className="mt-4 grid gap-8 md:grid-cols-2">
        <img src={product.image} alt={product.name} width={816} height={816} className="aspect-square w-full rounded-2xl border object-cover" />
        <div className="flex flex-col gap-4">
          <span className="text-sm text-muted-foreground">{product.categoryName}</span>
          <h1 className="text-3xl font-bold">{product.name}</h1>
          <AvailabilityBadge value={product.availability} />
          <div className="font-display text-3xl font-extrabold">{formatPrice(product.price)}</div>
          <p className="text-muted-foreground">{product.description}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button size="lg" disabled={out} onClick={() => { add(product.slug); toast.success("Agregado al carrito"); }}><ShoppingCart /> Agregar al carrito</Button>
            <Button size="lg" variant="outline" asChild><Link to="/catalogo/carrito">Ir al carrito</Link></Button>
          </div>
        </div>
      </div>
    </CatalogLayout>
  );
}
