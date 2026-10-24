import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SearchX } from "lucide-react";
import { CatalogLayout, SearchBar } from "@/components/catalog/CatalogLayout";
import { CategoryChip, ProductCard } from "@/components/catalog/ProductCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { searchPublicProducts } from "@/lib/domain/catalog";
import { categories } from "@/lib/domain/mock-data";

type Search = { q?: string | undefined; categoria?: string | undefined };

export const Route = createFileRoute("/catalogo/productos")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    q: typeof s["q"] === "string" && s["q"] ? s["q"] : undefined,
    categoria: typeof s["categoria"] === "string" && s["categoria"] ? s["categoria"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Productos — Catálogo" },
      { name: "description", content: "Todos nuestros productos con precio y disponibilidad." },
      { property: "og:title", content: "Productos — Catálogo" },
      { property: "og:description", content: "Todos nuestros productos con precio y disponibilidad." },
    ],
  }),
  component: Productos,
});

function Productos() {
  const { q, categoria } = Route.useSearch();
  const navigate = useNavigate({ from: "/catalogo/productos" });
  const results = searchPublicProducts(q, categoria);
  return (
    <CatalogLayout>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Productos</h1>
          <p className="mt-1 text-sm text-muted-foreground">{results.length} resultados{q ? ` para “${q}”` : ""}</p>
        </div>
        <SearchBar key={q} defaultValue={q} className="w-full sm:max-w-xs" />
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <CategoryChip label="Todas" active={!categoria} onClick={() => navigate({ search: (p) => ({ ...p, categoria: undefined }) })} />
        {categories.map((c) => (
          <CategoryChip key={c.id} label={c.name} active={categoria === c.slug} onClick={() => navigate({ search: (p) => ({ ...p, categoria: c.slug }) })} />
        ))}
      </div>
      <div className="mt-6">
        {results.length === 0 ? (
          <EmptyState icon={SearchX} title="No encontramos productos" description="Probá con otra palabra o elegí otra categoría." />
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {results.map((p) => <ProductCard key={p.slug} product={p} />)}
          </div>
        )}
      </div>
    </CatalogLayout>
  );
}
