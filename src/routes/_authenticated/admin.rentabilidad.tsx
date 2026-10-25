import { createFileRoute } from "@tanstack/react-router";
import { DollarSign, Percent, TrendingUp, Wallet } from "lucide-react";
import { DataTable } from "@/components/admin/DataTable";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { marginPct, orderTotal } from "@/lib/domain/catalog";
import { expenses, orders, products } from "@/lib/domain/mock-data";
import { formatPrice } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/rentabilidad")({
  head: () => ({
    meta: [
      { title: "Rentabilidad — Panel administrativo" },
      { name: "description", content: "Márgenes y resultado del período." },
      { property: "og:title", content: "Rentabilidad — Panel administrativo" },
      { property: "og:description", content: "Márgenes y resultado del período." },
    ],
  }),
  component: Rentabilidad,
});

function Rentabilidad() {
  // Solo ventas confirmadas cuentan como ingreso.
  const confirmed = orders.filter((o) => o.status === "confirmado");
  const revenue = confirmed.reduce((s, o) => s + orderTotal(o), 0);
  const cogs = confirmed.reduce((s, o) => s + o.items.reduce((a, i) => a + i.quantity * (products.find((p) => p.id === i.productId)?.cost ?? 0), 0), 0);
  const exp = expenses.reduce((s, e) => s + e.amount, 0);
  const sorted = [...products].sort((a, b) => marginPct(b.price, b.cost) - marginPct(a.price, a.cost));
  return (
    <>
      <PageHeader title="Rentabilidad" description="Calculada solo con ventas confirmadas." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Ingresos" value={formatPrice(revenue)} icon={DollarSign} />
        <StatCard label="Ganancia bruta" value={formatPrice(revenue - cogs)} icon={TrendingUp} />
        <StatCard label="Gastos" value={formatPrice(exp)} icon={Wallet} />
        <StatCard label="Margen bruto" value={`${revenue ? Math.round(((revenue - cogs) / revenue) * 100) : 0}%`} icon={Percent} />
      </div>
      <h2 className="mb-3 mt-8 text-lg font-semibold">Margen por producto</h2>
      <DataTable
        rows={sorted}
        getKey={(p) => p.id}
        columns={[
          { header: "Producto", cell: (p) => <span className="font-medium">{p.name}</span> },
          { header: "Precio", cell: (p) => formatPrice(p.price), className: "text-right whitespace-nowrap", hideOnMobile: true },
          { header: "Costo", cell: (p) => formatPrice(p.cost), className: "text-right whitespace-nowrap", hideOnMobile: true },
          { header: "Margen", cell: (p) => (
            <div className="flex items-center justify-end gap-2">
              <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-muted sm:block"><div className="h-full bg-primary" style={{ width: `${marginPct(p.price, p.cost)}%` }} /></div>
              <span className="w-10 text-right font-medium">{marginPct(p.price, p.cost)}%</span>
            </div>
          ), className: "text-right" },
        ]}
      />
    </>
  );
}
