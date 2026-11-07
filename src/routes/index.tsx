import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, MessageCircle, ShieldCheck, Truck } from "lucide-react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { CatalogLayout } from "@/components/catalog/CatalogLayout";
import { ProductCard } from "@/components/catalog/ProductCard";
import { ProductImage } from "@/components/catalog/ProductImage";
import { bannersQuery, bestsellersQuery, categoriesQuery, publicProductsQuery } from "@/lib/data";
import heroImg from "@/assets/festiva-portada.jpg.asset.json";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Festiva — Golosinas y cotillón" },
      {
        name: "description",
        content:
          "Golosinas, chocolates, gomitas, combos y cotillón para tus fiestas. Pedí por WhatsApp.",
      },
      { property: "og:title", content: "Festiva — Golosinas y cotillón" },
      { property: "og:description", content: "Todo para festejar: golosinas, combos y cotillón." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(publicProductsQuery),
  errorComponent: ({ error }) => (
    <CatalogLayout>
      <p role="alert" className="text-center text-muted-foreground">
        No pudimos cargar el catálogo. {error instanceof Error ? error.message : ""}
      </p>
    </CatalogLayout>
  ),
  component: Home,
});

function Home() {
  const { data: products } = useSuspenseQuery(publicProductsQuery);
  const { data: categories } = useQuery(categoriesQuery);
  const { data: banners = [] } = useQuery(bannersQuery);
  const { data: bestsellers = [], error: bestsellersError } = useQuery(bestsellersQuery);
  const [bannerIndex, setBannerIndex] = useState(0);
  const featured = products.filter((product) => product.featured).slice(0, 4);
  const combos = products
    .filter((product) => product.categorySlug === "combos")
    .sort((a, b) => Number(b.featured) - Number(a.featured))
    .slice(0, 8);
  const productBySlug = new Map(products.map((product) => [product.slug, product]));
  const popularSweets = bestsellers
    .map((item) => productBySlug.get(item.slug))
    .filter((product): product is (typeof products)[number] => Boolean(product))
    .slice(0, 8);
  const banner = banners.length ? banners[bannerIndex % banners.length] : null;
  useEffect(() => {
    if (banners.length < 2) return;
    const timer = window.setInterval(
      () => setBannerIndex((index) => (index + 1) % banners.length),
      5000,
    );
    return () => window.clearInterval(timer);
  }, [banners.length]);
  return (
    <CatalogLayout>
      <section className="grid items-center gap-8 overflow-hidden rounded-3xl bg-secondary p-6 sm:p-10 md:grid-cols-2">
        <div>
          <span className="inline-block rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
            Todo para festejar
          </span>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight sm:text-5xl">
            Golosinas, combos y cotillón para tu fiesta.
          </h1>
          <p className="mt-4 max-w-md text-muted-foreground">
            Elegí tus productos, armá el carrito y envianos el pedido por WhatsApp. Te confirmamos
            disponibilidad al instante.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/catalogo/productos">
                Ver productos <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/catalogo/categorias">Categorías</Link>
            </Button>
          </div>
        </div>
        <img
          src={heroImg.url}
          alt="Festiva, todo para festejar"
          width={816}
          height={816}
          className="mx-auto aspect-square w-full max-w-sm rounded-2xl object-cover shadow-lift"
        />
      </section>

      {banner && (
        <section className="relative mt-8 overflow-hidden rounded-2xl border bg-secondary">
          <div className="grid items-center sm:grid-cols-2">
            <div className="p-6 sm:p-8">
              <p className="text-sm font-semibold text-primary">Novedades</p>
              <h2 className="mt-2 text-2xl font-bold">{banner.title}</h2>
              {banner.subtitle && <p className="mt-2 text-muted-foreground">{banner.subtitle}</p>}
              {banner.link && (
                <Button asChild className="mt-4">
                  <a href={banner.link}>Ver más</a>
                </Button>
              )}
            </div>
            <ProductImage
              src={banner.image_url}
              alt={banner.title}
              className="aspect-video w-full"
              imgClassName="size-full object-cover"
            />
          </div>
          {banners.length > 1 && (
            <div className="absolute bottom-3 right-3 flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                aria-label="Banner anterior"
                onClick={() =>
                  setBannerIndex((index) => (index - 1 + banners.length) % banners.length)
                }
              >
                ‹
              </Button>
              <Button
                size="sm"
                variant="secondary"
                aria-label="Banner siguiente"
                onClick={() => setBannerIndex((index) => (index + 1) % banners.length)}
              >
                ›
              </Button>
            </div>
          )}
        </section>
      )}

      <section className="mt-8 grid gap-3 sm:grid-cols-3">
        {[
          { icon: MessageCircle, t: "Pedido por WhatsApp", d: "Sin registros ni pagos online." },
          {
            icon: ShieldCheck,
            t: "Confirmación personal",
            d: "Revisamos stock antes de confirmar.",
          },
          { icon: Truck, t: "Retiro o envío", d: "Coordinamos la entrega con vos." },
        ].map((f) => (
          <div key={f.t} className="flex items-start gap-3 rounded-xl border bg-card p-4">
            <f.icon className="mt-0.5 size-5 text-primary" />
            <div>
              <div className="font-medium">{f.t}</div>
              <div className="text-sm text-muted-foreground">{f.d}</div>
            </div>
          </div>
        ))}
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-bold">Categorías</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {(categories ?? []).map((c) => (
            <Link
              key={c.id}
              to="/catalogo/productos"
              search={{ categoria: c.slug }}
              className="rounded-full border bg-card px-4 py-1.5 text-sm hover:bg-muted"
            >
              {c.name}
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <div className="flex items-end justify-between">
          <h2 className="text-xl font-bold">Destacados</h2>
          <Link to="/catalogo/productos" className="text-sm font-medium text-primary">
            Ver todo
          </Link>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {featured.length ? (
            featured.map((p) => <ProductCard key={p.slug} product={p} />)
          ) : (
            <p className="col-span-full text-sm text-muted-foreground">
              Próximamente habrá productos destacados.
            </p>
          )}
        </div>
      </section>

      <section className="mt-12">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Combos destacados para cumpleaños y eventos</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Opciones listas para compartir y festejar.
            </p>
          </div>
          <Link
            to="/catalogo/productos"
            search={{ categoria: "combos" }}
            className="shrink-0 text-sm font-medium text-primary"
          >
            Ver combos
          </Link>
        </div>
        {combos.length ? (
          <div className="mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-3">
            {combos.map((product) => (
              <div key={product.slug} className="w-[72vw] max-w-60 shrink-0 snap-start sm:w-60">
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            Próximamente habrá combos para tus eventos.
          </p>
        )}
      </section>

      <section className="mt-12">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Golosinas más pedidas</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Las favoritas según los pedidos confirmados.
            </p>
          </div>
          <Link
            to="/catalogo/productos"
            search={{ categoria: "golosinas" }}
            className="shrink-0 text-sm font-medium text-primary"
          >
            Ver golosinas
          </Link>
        </div>
        {bestsellersError ? (
          <p role="alert" className="mt-4 text-sm text-destructive">
            No pudimos cargar el ranking de golosinas.
          </p>
        ) : popularSweets.length ? (
          <div className="mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-3">
            {popularSweets.map((product) => (
              <div key={product.slug} className="w-[72vw] max-w-60 shrink-0 snap-start sm:w-60">
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            Todavía no hay suficientes ventas confirmadas para armar este ranking.
          </p>
        )}
      </section>
    </CatalogLayout>
  );
}
