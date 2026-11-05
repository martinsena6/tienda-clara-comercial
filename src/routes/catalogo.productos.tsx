import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SearchX } from "lucide-react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { CatalogLayout, SearchBar } from "@/components/catalog/CatalogLayout";
import { CategoryChip, ProductCard } from "@/components/catalog/ProductCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { filterPublicProducts, searchPublicProducts, type CatalogFilters } from "@/lib/domain/catalog";
import { categoriesQuery, publicProductsQuery } from "@/lib/data";

type Search = {
  q?: string | undefined;
  categoria?: string | undefined;
  min?: number | undefined;
  max?: number | undefined;
  disponibles?: boolean | undefined;
  orden?: CatalogFilters["order"] | undefined;
};

export const Route = createFileRoute("/catalogo/productos")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    q: typeof s["q"] === "string" && s["q"] ? s["q"] : undefined,
    categoria: typeof s["categoria"] === "string" && s["categoria"] ? s["categoria"] : undefined,
    min: typeof s["min"] === "number" && Number.isFinite(s["min"]) ? s["min"] : undefined,
    max: typeof s["max"] === "number" && Number.isFinite(s["max"]) ? s["max"] : undefined,
    disponibles: s["disponibles"] === true ? true : undefined,
    orden: s["orden"] === "price-asc" || s["orden"] === "price-desc" || s["orden"] === "name" ? s["orden"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Productos — Catálogo Festiva" },
      { name: "description", content: "Todos nuestros productos con precio y disponibilidad." },
      { property: "og:title", content: "Productos — Catálogo Festiva" },
      { property: "og:description", content: "Todos nuestros productos con precio y disponibilidad." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(publicProductsQuery),
  errorComponent: ({ error }) => (
    <CatalogLayout>
      <p role="alert" className="text-center text-muted-foreground">No pudimos cargar los productos. {error instanceof Error ? error.message : ""}</p>
    </CatalogLayout>
  ),
  component: Productos,
});

function Productos() {
  const { q, categoria, min, max, disponibles, orden } = Route.useSearch();
  const navigate = useNavigate({ from: "/catalogo/productos" });
  const { data: products } = useSuspenseQuery(publicProductsQuery);
  const { data: categories } = useSuspenseQuery(categoriesQuery);
  const searched = searchPublicProducts(products, q, categoria);
  const results = filterPublicProducts(searched, {
    ...(min !== undefined ? { minPrice: min } : {}),
    ...(max !== undefined ? { maxPrice: max } : {}),
    ...(disponibles ? { availableOnly: true } : {}),
    ...(orden ? { order: orden } : {}),
  });
  const setSearch = (patch: Partial<Search>) =>
    navigate({ search: (previous) => ({ ...previous, ...patch }) });
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
        <CategoryChip label="Todas" active={!categoria} onClick={() => setSearch({ categoria: undefined })} />
        {categories.map((c) => (
          <CategoryChip key={c.id} label={c.name} active={categoria === c.slug} onClick={() => setSearch({ categoria: c.slug })} />
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border bg-card p-3">
        <label className="grid gap-1 text-xs text-muted-foreground">Precio mínimo
          <input type="number" min={0} value={min ?? ""} onChange={(e) => setSearch({ min: e.target.value === "" ? undefined : Number(e.target.value) })} className="h-9 w-32 rounded-md border bg-background px-2 text-sm text-foreground" />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">Precio máximo
          <input type="number" min={0} value={max ?? ""} onChange={(e) => setSearch({ max: e.target.value === "" ? undefined : Number(e.target.value) })} className="h-9 w-32 rounded-md border bg-background px-2 text-sm text-foreground" />
        </label>
        <label className="flex h-9 items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(disponibles)} onChange={(e) => setSearch({ disponibles: e.target.checked ? true : undefined })} /> Solo disponibles</label>
        <label className="grid gap-1 text-xs text-muted-foreground">Ordenar
          <select value={orden ?? ""} onChange={(e) => setSearch({ orden: (e.target.value || undefined) as CatalogFilters["order"] })} className="h-9 rounded-md border bg-background px-2 text-sm text-foreground">
            <option value="">Recomendados</option><option value="price-asc">Más barato</option><option value="price-desc">Más caro</option><option value="name">Nombre</option>
          </select>
        </label>
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
