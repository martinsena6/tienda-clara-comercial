import { createFileRoute } from "@tanstack/react-router";
import { DataTable } from "@/components/admin/DataTable";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { AvailabilityBadge } from "@/components/shared/AvailabilityBadge";
import { getAvailability, productName } from "@/lib/domain/catalog";
import { products, stockMovements } from "@/lib/domain/mock-data";
import { formatDate, movementLabel } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/stock")({
  head: () => ({
    meta: [
      { title: "Stock — Panel administrativo" },
      { name: "description", content: "Existencias y registro de movimientos de stock." },
      { property: "og:title", content: "Stock — Panel administrativo" },
      { property: "og:description", content: "Existencias y movimientos." },
    ],
  }),
  component: Stock,
});

const tone = { entrada: "success", salida: "info", ajuste: "warning" } as const;

function Stock() {
  return (
    <>
      <PageHeader title="Stock" description="El stock solo cambia mediante movimientos registrados. Los pedidos pendientes no lo descuentan." />
      <DataTable
        rows={products}
        getKey={(p) => p.id}
        columns={[
          { header: "Producto", cell: (p) => <span className="font-medium">{p.name}</span> },
          { header: "Unidades", cell: (p) => p.stock, className: "text-right" },
          { header: "Mínimo", cell: (p) => p.minStock, className: "text-right", hideOnMobile: true },
          { header: "Estado", cell: (p) => <AvailabilityBadge value={getAvailability(p.stock, p.minStock)} /> },
        ]}
      />
      <h2 className="mb-3 mt-8 text-lg font-semibold">Movimientos recientes</h2>
      <DataTable
        rows={stockMovements}
        getKey={(m) => m.id}
        columns={[
          { header: "Fecha", cell: (m) => formatDate(m.date), className: "whitespace-nowrap" },
          { header: "Producto", cell: (m) => productName(m.productId) },
          { header: "Tipo", cell: (m) => <StatusBadge tone={tone[m.type]}>{movementLabel[m.type]}</StatusBadge> },
          { header: "Cantidad", cell: (m) => (m.quantity > 0 && m.type !== "salida" ? `+${m.quantity}` : m.type === "salida" ? `-${m.quantity}` : m.quantity), className: "text-right" },
          { header: "Motivo", cell: (m) => m.reason, hideOnMobile: true },
          { header: "Usuario", cell: (m) => m.user, hideOnMobile: true },
        ]}
      />
    </>
  );
}
