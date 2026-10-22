import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, Clock, DollarSign, Package } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { getAvailability, orderTotal } from "@/lib/domain/catalog";
import { orders, products } from "@/lib/domain/mock-data";
import { formatDate, formatPrice } from "@/lib/format";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Inicio — Panel administrativo" },
      { name: "description", content: "Resumen del negocio: ventas, pedidos pendientes y stock." },
      { property: "og:title", content: "Inicio — Panel administrativo" },
      { property: "og:description", content: "Resumen del negocio." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const confirmed = orders.filter((o) => o.status === "confirmado");
  const pending = orders.filter((o) => o.status === "pendiente");
  const low = products.filter((p) => getAvailability(p.stock, p.minStock) !== "disponible");
  return (
    <>
      <PageHeader title="Hola 👋" description="Así viene tu negocio esta semana." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Ventas confirmadas" value={formatPrice(confirmed.reduce((s, o) => s + orderTotal(o), 0))} hint={`${confirmed.length} ventas`} icon={DollarSign} />
        <StatCard label="Pedidos pendientes" value={String(pending.length)} hint="Esperan tu confirmación" icon={Clock} />
        <StatCard label="Productos activos" value={String(products.filter((p) => p.active).length)} icon={Package} />
        <StatCard label="Stock bajo o agotado" value={String(low.length)} hint="Revisá reposición" icon={AlertTriangle} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border bg-card p-5 shadow-soft">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Pedidos por confirmar</h2><Link to="/admin/ventas" className="text-sm text-primary">Ver ventas</Link></div>
          <ul className="divide-y">
            {pending.map((o) => (
              <li key={o.id} className="flex items-center justify-between py-3 text-sm">
                <div><div className="font-medium">{o.customerName}</div><div className="text-xs text-muted-foreground">Pedido #{o.number} · {formatDate(o.date)}</div></div>
                <div className="text-right"><div className="font-semibold">{formatPrice(orderTotal(o))}</div><StatusBadge tone="warning">Pendiente</StatusBadge></div>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-xl border bg-card p-5 shadow-soft">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Alertas de stock</h2><Link to="/admin/stock" className="text-sm text-primary">Ver stock</Link></div>
          <ul className="divide-y">
            {low.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-3 text-sm">
                <span className="font-medium">{p.name}</span>
                <StatusBadge tone={p.stock <= 0 ? "danger" : "warning"}>{p.stock <= 0 ? "Agotado" : `Quedan ${p.stock}`}</StatusBadge>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
