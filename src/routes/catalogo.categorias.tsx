import { createFileRoute, Link } from "@tanstack/react-router";
import { CatalogLayout } from "@/components/catalog/CatalogLayout";
import { getPublicProducts } from "@/lib/domain/catalog";
import { categories } from "@/lib/domain/mock-data";

export const Route = createFileRoute("/catalogo/categorias")({
  head: () => ({
    meta: [
      { title: "Categorías — Catálogo" },
      { name: "description", content: "Navegá los productos por categoría." },
      { property: "og:title", content: "Categorías — Catálogo" },
      { property: "og:description", content: "Navegá los productos por categoría." },
    ],
  }),
  component: Categorias,
});

function Categorias() {
  const all = getPublicProducts();
  return (
    <CatalogLayout>
      <h1 className="text-3xl font-bold">Categorías</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {categories.map((c) => {
          const items = all.filter((p) => p.categorySlug === c.slug);
          return (
            <Link key={c.id} to="/catalogo/productos" search={{ categoria: c.slug }} className="group overflow-hidden rounded-2xl border bg-card shadow-soft hover:shadow-lift">
              <div className="aspect-[4/3] bg-muted">
                {items[0] && <img src={items[0].image} alt={c.name} loading="lazy" width={816} height={816} className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />}
              </div>
              <div className="p-4">
                <div className="font-display font-semibold">{c.name}</div>
                <div className="text-sm text-muted-foreground">{items.length} {items.length === 1 ? "producto" : "productos"}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </CatalogLayout>
  );
}
