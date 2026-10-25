import { createFileRoute } from "@tanstack/react-router";
import { Check, Inbox, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/admin/DataTable";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { orderTotal, productName } from "@/lib/domain/catalog";
import { orders } from "@/lib/domain/mock-data";
import type { Order, OrderStatus } from "@/lib/domain/types";
import { formatDate, formatPrice, orderStatusLabel } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/ventas")({
  head: () => ({
    meta: [
      { title: "Ventas — Panel administrativo" },
      { name: "description", content: "Pedidos pendientes y ventas confirmadas." },
      { property: "og:title", content: "Ventas — Panel administrativo" },
      { property: "og:description", content: "Pedidos pendientes y ventas confirmadas." },
    ],
  }),
  component: Ventas,
});

const tone: Record<OrderStatus, "warning" | "success" | "neutral"> = { pendiente: "warning", confirmado: "success", cancelado: "neutral" };

function OrdersTable({ rows, actions }: { rows: Order[]; actions?: boolean }) {
  return (
    <DataTable
      rows={rows}
      getKey={(o) => o.id}
      empty={<EmptyState icon={Inbox} title="No hay registros" />}
      columns={[
        { header: "Pedido", cell: (o) => <div><div className="font-medium">{o.customerName}</div><div className="text-xs text-muted-foreground">#{o.number} · {o.channel === "whatsapp" ? "WhatsApp" : "Local"}</div></div> },
        { header: "Detalle", cell: (o) => o.items.map((i) => `${i.quantity} x ${productName(i.productId)}`).join(", "), hideOnMobile: true },
        { header: "Fecha", cell: (o) => formatDate(o.date), hideOnMobile: true },
        { header: "Total", cell: (o) => formatPrice(orderTotal(o)), className: "text-right whitespace-nowrap" },
        { header: "Estado", cell: (o) => <StatusBadge tone={tone[o.status]}>{orderStatusLabel[o.status]}</StatusBadge> },
        ...(actions
          ? [{ header: "Acciones", cell: () => (
              <div className="flex gap-1">
                <Button size="sm" onClick={() => toast.info("Confirmar registrará la venta y descontará stock (próxima etapa).")}><Check /> Confirmar</Button>
                <Button size="sm" variant="ghost" aria-label="Cancelar pedido" onClick={() => toast.info("Disponible al conectar la base de datos.")}><X /></Button>
              </div>
            ) }]
          : []),
      ]}
    />
  );
}

function Ventas() {
  const by = (s: OrderStatus) => orders.filter((o) => o.status === s);
  return (
    <>
      <PageHeader title="Ventas" description="Los pedidos de WhatsApp llegan como pendientes. Solo al confirmarlos se convierten en venta y descuentan stock." />
      <Tabs defaultValue="pendiente">
        <TabsList>
          <TabsTrigger value="pendiente">Pendientes ({by("pendiente").length})</TabsTrigger>
          <TabsTrigger value="confirmado">Confirmadas</TabsTrigger>
          <TabsTrigger value="cancelado">Canceladas</TabsTrigger>
        </TabsList>
        <TabsContent value="pendiente" className="mt-4"><OrdersTable rows={by("pendiente")} actions /></TabsContent>
        <TabsContent value="confirmado" className="mt-4"><OrdersTable rows={by("confirmado")} /></TabsContent>
        <TabsContent value="cancelado" className="mt-4"><OrdersTable rows={by("cancelado")} /></TabsContent>
      </Tabs>
    </>
  );
}
