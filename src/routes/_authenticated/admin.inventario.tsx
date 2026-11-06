import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/admin/DataTable";
import { PageHeader } from "@/components/admin/PageHeader";
import { RequireAdmin } from "@/components/admin/RequireAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  adminProductsQuery,
  applyStockCount,
  categoriesQuery,
  errorMessage,
  normalizeName,
  todayAR,
  type AdminProduct,
} from "@/lib/data";
import { requireAdminRoute } from "@/lib/auth";

const EMPTY_PRODUCTS: AdminProduct[] = [];

export const Route = createFileRoute("/_authenticated/admin/inventario")({
  beforeLoad: requireAdminRoute,
  head: () => ({
    meta: [{ title: "Conteo físico — Panel Festiva" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <RequireAdmin>
      <Inventario />
    </RequireAdmin>
  ),
});

function Inventario() {
  const queryClient = useQueryClient();
  const productsQuery = useQuery(adminProductsQuery);
  const categoriesQueryResult = useQuery(categoriesQuery);
  const products = productsQuery.data ?? EMPTY_PRODUCTS;
  const categories = categoriesQueryResult.data ?? [];
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setCounts(Object.fromEntries(products.map((product) => [product.id, String(product.stock)])));
  }, [products]);

  const filtered = useMemo(() => {
    const term = normalizeName(query);
    return products.filter(
      (product) =>
        (!category || product.category_id === category) &&
        (!term || normalizeName(product.name).includes(term)),
    );
  }, [products, category, query]);
  const changes = products.flatMap((product) => {
    const raw = counts[product.id] ?? String(product.stock);
    if (!/^\d+$/.test(raw)) return [{ product_id: product.id, counted: -1, name: product.name }];
    const counted = Number(raw);
    return counted === product.stock
      ? []
      : [{ product_id: product.id, counted, name: product.name }];
  });
  const invalid = changes.some((change) => change.counted < 0);

  const apply = async () => {
    if (!changes.length || invalid) return;
    setBusy(true);
    try {
      const date = todayAR().split("-").reverse().join("/");
      const adjusted = await applyStockCount(
        changes.map(({ product_id, counted }) => ({ product_id, counted })),
        `Conteo físico ${date}`,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-products"] }),
        queryClient.invalidateQueries({ queryKey: ["movements"] }),
        queryClient.invalidateQueries({ queryKey: ["staff-products"] }),
        queryClient.invalidateQueries({ queryKey: ["public-products"] }),
      ]);
      toast.success(`${adjusted} productos ajustados`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Conteo físico"
        description="Solo se envían los productos cuya cantidad contada difiere del stock registrado."
      />
      {productsQuery.error && (
        <p role="alert" className="mb-3 text-sm text-destructive">
          {errorMessage(productsQuery.error)}
        </p>
      )}
      {categoriesQueryResult.error && (
        <p role="alert" className="mb-3 text-sm text-destructive">
          {errorMessage(categoriesQueryResult.error)}
        </p>
      )}
      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          placeholder="Buscar producto…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="max-w-xs"
        />
        <select
          aria-label="Categoría"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="h-9 rounded-md border bg-background px-3 text-sm"
        >
          <option value="">Todas las categorías</option>
          {categories.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <span className="self-center text-sm text-muted-foreground">
          {changes.filter((change) => change.counted >= 0).length} cambios
        </span>
      </div>
      {invalid && (
        <p role="alert" className="mb-3 text-sm text-destructive">
          Ingresá cantidades enteras iguales o mayores a cero.
        </p>
      )}
      <DataTable
        rows={filtered}
        getKey={(product) => product.id}
        columns={[
          { header: "Producto", cell: (product) => product.name },
          { header: "Stock actual", cell: (product) => product.stock, className: "text-right" },
          {
            header: "Contado",
            cell: (product) => (
              <Input
                aria-label={`Contado: ${product.name}`}
                type="number"
                min={0}
                step={1}
                value={counts[product.id] ?? String(product.stock)}
                onChange={(event) =>
                  setCounts((current) => ({ ...current, [product.id]: event.target.value }))
                }
                className="ml-auto w-28 text-right"
              />
            ),
            className: "text-right",
          },
        ]}
      />
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Se registrará el motivo «Conteo físico {todayAR().split("-").reverse().join("/")}».
        </p>
        <Button onClick={apply} disabled={busy || invalid || changes.length === 0}>
          {busy ? "Aplicando…" : `Aplicar ${changes.length} cambios`}
        </Button>
      </div>
    </>
  );
}
