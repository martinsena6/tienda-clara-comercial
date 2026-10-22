import { createFileRoute } from "@tanstack/react-router";
import { Plus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/admin/DataTable";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { expenses } from "@/lib/domain/mock-data";
import { formatDate, formatPrice } from "@/lib/format";

export const Route = createFileRoute("/admin/gastos")({
  head: () => ({
    meta: [
      { title: "Gastos — Panel administrativo" },
      { name: "description", content: "Gastos operativos del negocio." },
      { property: "og:title", content: "Gastos — Panel administrativo" },
      { property: "og:description", content: "Gastos operativos del negocio." },
    ],
  }),
  component: () => (
    <>
      <PageHeader title="Gastos" description="Alquiler, servicios y otros costos operativos." actions={<Button disabled><Plus /> Nuevo gasto</Button>} />
      <div className="mb-6 max-w-xs"><StatCard label="Total del mes" value={formatPrice(expenses.reduce((s, e) => s + e.amount, 0))} icon={Wallet} /></div>
      <DataTable
        rows={expenses}
        getKey={(e) => e.id}
        columns={[
          { header: "Fecha", cell: (e) => formatDate(e.date), className: "whitespace-nowrap" },
          { header: "Categoría", cell: (e) => <span className="font-medium">{e.category}</span> },
          { header: "Detalle", cell: (e) => e.description, hideOnMobile: true },
          { header: "Monto", cell: (e) => formatPrice(e.amount), className: "text-right whitespace-nowrap" },
        ]}
      />
    </>
  ),
});
