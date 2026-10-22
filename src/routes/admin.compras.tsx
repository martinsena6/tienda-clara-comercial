import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/admin/DataTable";
import { PageHeader } from "@/components/admin/PageHeader";
import { purchases } from "@/lib/domain/mock-data";
import { formatDate, formatPrice } from "@/lib/format";

export const Route = createFileRoute("/admin/compras")({
  head: () => ({
    meta: [
      { title: "Compras — Panel administrativo" },
      { name: "description", content: "Compras a proveedores." },
      { property: "og:title", content: "Compras — Panel administrativo" },
      { property: "og:description", content: "Compras a proveedores." },
    ],
  }),
  component: () => (
    <>
      <PageHeader title="Compras" description="Cada compra generará una entrada de stock cuando se conecte la base de datos." actions={<Button disabled><Plus /> Nueva compra</Button>} />
      <DataTable
        rows={purchases}
        getKey={(p) => p.id}
        columns={[
          { header: "Fecha", cell: (p) => formatDate(p.date), className: "whitespace-nowrap" },
          { header: "Proveedor", cell: (p) => <span className="font-medium">{p.supplier}</span> },
          { header: "Detalle", cell: (p) => p.description, hideOnMobile: true },
          { header: "Total", cell: (p) => formatPrice(p.total), className: "text-right whitespace-nowrap" },
        ]}
      />
    </>
  ),
});
