import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, MessageCircle, ShieldCheck, Truck } from "lucide-react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { CatalogLayout } from "@/components/catalog/CatalogLayout";
import { ProductCard } from "@/components/catalog/ProductCard";
import { categoriesQuery, publicProductsQuery } from "@/lib/data";
import heroImg from "@/assets/festiva-portada.jpg.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Festiva — Golosinas y cotillón" },
      { name: "description", content: "Golosinas, chocolates, gomitas, combos y cotillón para tus fiestas. Pedí por WhatsApp." },
      { property: "og:title", content: "Festiva — Golosinas y cotillón" },
      { property: "og:description", content: "Todo para festejar: golosinas, combos y cotillón." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(publicProductsQuery),
  errorComponent: ({ error }) => (
    <CatalogLayout>
      <p role="alert" className="text-center text-muted-foreground">No pudimos cargar el catálogo. {error instanceof Error ? error.message : ""}</p>
    </CatalogLayout>
  ),
  component: Home,
});

function Home() {
  const { data: products } = useSuspenseQuery(publicProductsQuery);
  const { data: categories } = useQuery(categoriesQuery);
  const featured = products.slice(0, 4);
  return (
    <CatalogLayout>
      <section className="grid items-center gap-8 overflow-hidden rounded-3xl bg-secondary p-6 sm:p-10 md:grid-cols-2">
        <div>
          <span className="inline-block rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">Todo para festejar</span>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight sm:text-5xl">Golosinas, combos y cotillón para tu fiesta.</h1>
          <p className="mt-4 max-w-md text-muted-foreground">Elegí tus productos, armá el carrito y envianos el pedido por WhatsApp. Te confirmamos disponibilidad al instante.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg"><Link to="/catalogo/productos">Ver productos <ArrowRight /></Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/catalogo/categorias">Categorías</Link></Button>
          </div>
        </div>
        <img src={heroImg.url} alt="Festiva, todo para festejar" width={816} height={816} className="mx-auto aspect-square w-full max-w-sm rounded-2xl object-cover shadow-lift" />
      </section>

      <section className="mt-8 grid gap-3 sm:grid-cols-3">
        {[
          { icon: MessageCircle, t: "Pedido por WhatsApp", d: "Sin registros ni pagos online." },
          { icon: ShieldCheck, t: "Confirmación personal", d: "Revisamos stock antes de confirmar." },
          { icon: Truck, t: "Retiro o envío", d: "Coordinamos la entrega con vos." },
        ].map((f) => (
          <div key={f.t} className="flex items-start gap-3 rounded-xl border bg-card p-4">
            <f.icon className="mt-0.5 size-5 text-primary" />
            <div><div className="font-medium">{f.t}</div><div className="text-sm text-muted-foreground">{f.d}</div></div>
          </div>
        ))}
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-bold">Categorías</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {(categories ?? []).map((c) => (
            <Link key={c.id} to="/catalogo/productos" search={{ categoria: c.slug }} className="rounded-full border bg-card px-4 py-1.5 text-sm hover:bg-muted">{c.name}</Link>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <div className="flex items-end justify-between">
          <h2 className="text-xl font-bold">Destacados</h2>
          <Link to="/catalogo/productos" className="text-sm font-medium text-primary">Ver todo</Link>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {featured.map((p) => <ProductCard key={p.slug} product={p} />)}
        </div>
      </section>
    </CatalogLayout>
  );
}
