import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/admin/DataTable";
import { PageHeader } from "@/components/admin/PageHeader";
import { RequireAdmin } from "@/components/admin/RequireAdmin";
import { purchasesQuery } from "@/lib/data";
import { formatDate, formatPrice } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/compras")({
  head: () => ({
    meta: [
      { title: "Compras — Panel Festiva" },
      { name: "description", content: "Compras a proveedores." },
      { property: "og:title", content: "Compras — Panel Festiva" },
      { property: "og:description", content: "Compras a proveedores." },
    ],
  }),
  component: () => <RequireAdmin><Compras /></RequireAdmin>,
});

function Compras() {
  const rows = useQuery(purchasesQuery).data ?? [];
  return (
    <>
      <PageHeader title="Compras" description="Compras registradas a proveedores." />
      <DataTable rows={rows} getKey={(p) => p.id} empty={<p className="text-sm text-muted-foreground">Todavía no hay compras registradas.</p>} columns={[
        { header: "Compra", cell: (p) => `#${p.number}` },
        { header: "Fecha", cell: (p) => formatDate(p.date) },
        { header: "Proveedor", cell: (p) => p.supplierName },
        { header: "Total", cell: (p) => formatPrice(p.total), className: "text-right" },
      ]} />
    </>
  );
}
