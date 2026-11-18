import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { MessageCircle } from "lucide-react";
import { DataTable } from "@/components/admin/DataTable";
import { PageHeader } from "@/components/admin/PageHeader";
import { RequireAdmin } from "@/components/admin/RequireAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errorMessage, replenishmentQuery, suppliersQuery } from "@/lib/data";
import { requireAdminRoute } from "@/lib/auth";
import { arWhatsAppPhone, buildWhatsAppUrl } from "@/lib/whatsapp";

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
  const suppliers = useQuery(suppliersQuery);
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

  if (isLoading) return <p className="text-sm text-muted-foreground">Calculando sugerencias…</p>;

  return (
    <>
      <PageHeader
        title="Reposición"
        description="Se muestran productos cuyo stock está en o debajo de su mínimo configurado; la cantidad sugerida completa ese mínimo."
      />
      {error && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {errorMessage(error)}
        </p>
      )}
      {suppliers.error && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          No se pudieron cargar los teléfonos de proveedores: {errorMessage(suppliers.error)}
        </p>
      )}
      {groups.length === 0 ? (
        <p className="rounded-lg border p-5 text-sm text-muted-foreground">
          No hay sugerencias de reposición.
        </p>
      ) : (
        groups.map(([supplier, rows]) => {
          const supplierRecord = suppliers.data?.find(
            (entry) => entry.name.trim().toLocaleLowerCase() === supplier.toLocaleLowerCase(),
          );
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
          const whatsappLines = rows
            .map((row) => ({ name: row.name, quantity: Number(quantities[row.product_id] ?? 0) }))
            .filter((row) => Number.isInteger(row.quantity) && row.quantity > 0);
          const whatsappMessage = [
            `Hola ${supplier}, te paso el pedido de reposición para Festiva:`,
            "",
            ...whatsappLines.map((row) => `• ${row.quantity} x ${row.name}`),
          ].join("\n");
          const whatsappCandidate = supplierRecord?.phone
            ? arWhatsAppPhone(supplierRecord.phone)
            : "";
          const whatsappPhone = /^\d{11,15}$/.test(whatsappCandidate) ? whatsappCandidate : "";
          return (
            <section key={supplier} className="mb-6 space-y-3 rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{supplier}</h2>
                  <p className="text-sm text-muted-foreground">
                    Teléfono: {supplierRecord?.phone || "Sin teléfono registrado"}
                  </p>
                  <p className="text-sm text-muted-foreground">{rows.length} productos sugeridos</p>
                </div>
                <div className="flex gap-2">
                  {whatsappPhone && whatsappLines.length > 0 && (
                    <Button asChild className="bg-green-600 text-white hover:bg-green-700">
                      <a
                        href={buildWhatsAppUrl(whatsappPhone, whatsappMessage)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <MessageCircle /> Pedir por WhatsApp al proveedor
                      </a>
                    </Button>
                  )}
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
                  { header: "Stock mínimo", cell: (row) => row.min_stock, className: "text-right" },
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
