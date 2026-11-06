import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/admin/DataTable";
import { PageHeader } from "@/components/admin/PageHeader";
import { RequireAdmin } from "@/components/admin/RequireAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errorMessage, replenishmentQuery } from "@/lib/data";
import { requireAdminRoute } from "@/lib/auth";
import { formatPrice } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/reposicion")({
  beforeLoad: requireAdminRoute,
  head: () => ({
    meta: [{ title: "Reposición — Panel Festiva" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <RequireAdmin>
      <Reposicion />
    </RequireAdmin>
  ),
});

function Reposicion() {
  const { data: suggestions = [], isLoading, error } = useQuery(replenishmentQuery);
  const [quantities, setQuantities] = useState<Record<string, string>>({});

  useEffect(() => {
    setQuantities(
      Object.fromEntries(suggestions.map((row) => [row.product_id, String(row.sugerido)])),
    );
  }, [suggestions]);

  const groups = useMemo(() => {
    const grouped = new Map<string, typeof suggestions>();
    for (const row of suggestions) {
      const supplier = row.supplier?.trim() || "Sin proveedor";
      grouped.set(supplier, [...(grouped.get(supplier) ?? []), row]);
    }
    return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b, "es"));
  }, [suggestions]);

  const copyOrder = async (supplier: string, rows: typeof suggestions) => {
    const lines = rows
      .map((row) => ({ name: row.name, quantity: Number(quantities[row.product_id] ?? 0) }))
      .filter((row) => Number.isInteger(row.quantity) && row.quantity > 0);
    if (!lines.length) {
      toast.error("Indicá una cantidad mayor a cero para copiar el pedido");
      return;
    }
    try {
      await navigator.clipboard.writeText(
        `Hola, te encargo: ${lines.map((row) => `${row.quantity} x ${row.name}`).join(", ")}`,
      );
      toast.success(`Pedido para ${supplier} copiado`);
    } catch (clipboardError) {
      toast.error(`No se pudo copiar el pedido: ${errorMessage(clipboardError)}`);
    }
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Calculando sugerencias…</p>;

  return (
    <>
      <PageHeader
        title="Reposición"
        description="Sugerencias basadas en ventas confirmadas de los últimos 30 días y cobertura objetivo de 21 días."
      />
      <p className="mb-5 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-muted-foreground">
        Con pocos días de ventas registradas, estos datos son limitados y las sugerencias pueden no
        reflejar todavía la demanda habitual.
      </p>
      {error && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {errorMessage(error)}
        </p>
      )}
      {groups.length === 0 ? (
        <p className="rounded-lg border p-5 text-sm text-muted-foreground">
          No hay sugerencias de reposición.
        </p>
      ) : (
        groups.map(([supplier, rows]) => {
          const purchaseRows = rows
            .map((row) => ({
              product_id: row.product_id,
              quantity: Number(quantities[row.product_id] ?? 0),
            }))
            .filter((row) => Number.isInteger(row.quantity) && row.quantity > 0);
          const purchaseSearch = {
            ...(supplier !== "Sin proveedor" ? { proveedor: supplier } : {}),
            items: JSON.stringify(purchaseRows),
          };
          return (
            <section key={supplier} className="mb-6 space-y-3 rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{supplier}</h2>
                  <p className="text-sm text-muted-foreground">{rows.length} productos sugeridos</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => void copyOrder(supplier, rows)}>
                    Copiar pedido para WhatsApp
                  </Button>
                  <Button asChild disabled={!purchaseRows.length}>
                    <Link to="/admin/compras" search={purchaseSearch}>
                      Registrar compra
                    </Link>
                  </Button>
                </div>
              </div>
              <DataTable
                rows={rows}
                getKey={(row) => row.product_id}
                columns={[
                  { header: "Producto", cell: (row) => row.name },
                  { header: "Stock", cell: (row) => row.stock, className: "text-right" },
                  {
                    header: "Vendidas",
                    cell: (row) => row.unidades_vendidas,
                    className: "text-right",
                    hideOnMobile: true,
                  },
                  {
                    header: "Cobertura",
                    cell: (row) => {
                      if (row.unidades_vendidas === 0 || row.dias_cobertura === null)
                        return (
                          <span className="rounded-full bg-muted px-2 py-1 text-xs">
                            Sin ventas
                          </span>
                        );
                      const tone =
                        row.dias_cobertura < 7
                          ? "bg-destructive/15 text-destructive"
                          : row.dias_cobertura <= 15
                            ? "bg-warning/20 text-warning"
                            : "bg-success/15 text-success";
                      return (
                        <span className={`rounded-full px-2 py-1 text-xs ${tone}`}>
                          {row.dias_cobertura} días
                        </span>
                      );
                    },
                  },
                  {
                    header: "Costo unitario",
                    cell: (row) => formatPrice(row.cost),
                    className: "text-right whitespace-nowrap",
                    hideOnMobile: true,
                  },
                  {
                    header: "Sugerido",
                    cell: (row) => (
                      <Input
                        aria-label={`Cantidad sugerida: ${row.name}`}
                        type="number"
                        min={0}
                        step={1}
                        value={quantities[row.product_id] ?? String(row.sugerido)}
                        onChange={(event) =>
                          setQuantities((current) => ({
                            ...current,
                            [row.product_id]: event.target.value,
                          }))
                        }
                        className="ml-auto w-24 text-right"
                      />
                    ),
                    className: "text-right",
                  },
                ]}
              />
            </section>
          );
        })
      )}
    </>
  );
}
