import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, CalendarDays, Clock, DollarSign, Package } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { getAvailability } from "@/lib/domain/catalog";
import { todayAR, usePanelOrders, usePanelProducts } from "@/lib/data";
import { ReportPanel } from "@/components/admin/ReportPanel";
import { formatDate, formatPrice } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Inicio — Panel Festiva" },
      { name: "description", content: "Resumen del negocio: ventas, pedidos pendientes y stock." },
      { property: "og:title", content: "Inicio — Panel Festiva" },
      { property: "og:description", content: "Resumen del negocio." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const orders = usePanelOrders().data;
  const { data: products, isAdmin } = usePanelProducts();
  const confirmed = orders.filter((o) => o.status === "confirmado");
  const pending = orders.filter((o) => o.status === "pendiente");
  const today = todayAR();
  const throughNextWeek = todayAR(7);
  const upcomingEvents = isAdmin
    ? orders
        .filter((order) =>
          (order.status === "pendiente" || order.status === "confirmado") &&
          order.event_date !== null &&
          order.event_date >= today &&
          order.event_date <= throughNextWeek,
        )
        .sort((a, b) => (a.event_date ?? "").localeCompare(b.event_date ?? ""))
    : [];
  const low = products.filter(
    (p) => p.active && getAvailability(p.stock_disponible, p.min_stock) !== "disponible",
  );
  return (
    <>
      <PageHeader title="Hola 👋" description="Así viene tu negocio." />
      {isAdmin ? (
        <div className="mb-6">
          <ReportPanel defaultPeriod="hoy" />
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {!isAdmin && (
          <StatCard
            label="Ventas confirmadas"
            value={formatPrice(confirmed.reduce((s, o) => s + o.total, 0))}
            hint={`${confirmed.length} ventas`}
            icon={DollarSign}
          />
        )}
        <StatCard
          label="Pedidos pendientes"
          value={String(pending.length)}
          hint="Esperan tu confirmación"
          icon={Clock}
        />
        <StatCard
          label="Productos activos"
          value={String(products.filter((p) => p.active).length)}
          icon={Package}
        />
        <StatCard
          label="Stock bajo o agotado"
          value={String(low.length)}
          hint="Revisá reposición"
          icon={AlertTriangle}
        />
      </div>
      {isAdmin && (
        <section className="mt-6 rounded-xl border bg-card p-5 shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold"><CalendarDays className="size-4" />Eventos de los próximos 7 días</h2>
            <Link to="/admin/ventas" className="text-sm text-primary">Ver ventas</Link>
          </div>
          {upcomingEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay eventos próximos.</p>
          ) : (
            <ul className="divide-y">
              {upcomingEvents.map((order) => (
                <li key={order.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <div>
                    <div className="font-medium">{order.customer_name || "Cliente"} · Pedido #{order.number}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(order.event_date!)} · {order.delivery_method === "envio" ? "Envío" : "Retiro"}</div>
                  </div>
                  <StatusBadge tone={order.status === "confirmado" ? "success" : "warning"}>{order.status === "confirmado" ? "Confirmado" : "Pendiente"}</StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border bg-card p-5 shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Pedidos por confirmar</h2>
            <Link to="/admin/ventas" className="text-sm text-primary">
              Ver ventas
            </Link>
          </div>
          {pending.length === 0 && (
            <p className="text-sm text-muted-foreground">No hay pedidos pendientes.</p>
          )}
          <ul className="divide-y">
            {pending.slice(0, 8).map((o) => (
              <li key={o.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <div className="font-medium">{o.customer_name || "Cliente"}</div>
                  <div className="text-xs text-muted-foreground">
                    Pedido #{o.number} · {formatDate(o.created_at)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{formatPrice(o.total)}</div>
                  <StatusBadge tone="warning">Pendiente</StatusBadge>
                </div>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-xl border bg-card p-5 shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Alertas de stock</h2>
            <Link to="/admin/stock" className="text-sm text-primary">
              Ver stock
            </Link>
          </div>
          {low.length === 0 && <p className="text-sm text-muted-foreground">Todo en orden.</p>}
          <ul className="divide-y">
            {low.slice(0, 8).map((p) => (
              <li key={p.id} className="flex items-center justify-between py-3 text-sm">
                <span className="font-medium">{p.name}</span>
                <StatusBadge tone={p.stock_disponible <= 0 ? "danger" : "warning"}>
                  {p.stock_disponible <= 0 ? "Agotado" : `Quedan ${p.stock_disponible}`}
                </StatusBadge>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
