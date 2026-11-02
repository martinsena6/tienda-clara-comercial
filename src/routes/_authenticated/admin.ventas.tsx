import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, Inbox, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/admin/DataTable";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { cancelOrder, confirmOrder, errorMessage, usePanelOrders, type PanelOrder } from "@/lib/data";
import type { OrderStatus } from "@/lib/domain/types";
import { formatDateTime, formatPrice, orderStatusLabel } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/ventas")({
  head: () => ({
    meta: [
      { title: "Ventas — Panel Festiva" },
      { name: "description", content: "Pedidos pendientes y ventas confirmadas." },
      { property: "og:title", content: "Ventas — Panel Festiva" },
      { property: "og:description", content: "Pedidos pendientes y ventas confirmadas." },
    ],
  }),
  component: Ventas,
});

const tone: Record<OrderStatus, "warning" | "success" | "neutral"> = { pendiente: "warning", confirmado: "success", cancelado: "neutral" };

function OrdersTable({ rows, actions, isAdmin }: { rows: PanelOrder[]; actions?: boolean; isAdmin: boolean }) {
  const qc = useQueryClient();
  const [short, setShort] = useState<{ order: PanelOrder; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const done = async (ok: string) => { await qc.invalidateQueries(); toast.success(ok); };

  const confirmIt = async (o: PanelOrder) => {
    const noCost = isAdmin ? o.items.filter((i) => !i.unit_cost || i.unit_cost <= 0) : [];
    if (noCost.length && !confirm(`Estos productos no tienen costo cargado y la ganancia no será confiable: ${noCost.map((i) => i.name).join(", ")}. ¿Confirmar igual?`)) return;
    setBusy(true);
    try {
      await confirmOrder(o.id, false);
      await done("Venta confirmada y stock descontado");
    } catch (e) {
      const m = errorMessage(e);
      if (/stock insuficiente/i.test(m)) setShort({ order: o, message: m });
      else toast.error(m);
    } finally { setBusy(false); }
  };
  const forceIt = async () => {
    if (!short) return;
    setBusy(true);
    try { await confirmOrder(short.order.id, true); setShort(null); await done("Venta confirmada (stock en negativo)"); }
    catch (e) { toast.error(errorMessage(e)); }
    finally { setBusy(false); }
  };
  const cancelIt = async (o: PanelOrder) => {
    if (!confirm("¿Cancelar este pedido?")) return;
    try { await cancelOrder(o.id); await done("Pedido cancelado"); } catch (e) { toast.error(errorMessage(e)); }
  };

  return (
    <>
      <Dialog open={!!short} onOpenChange={(o) => !o && setShort(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>No alcanza el stock</DialogTitle>
            <DialogDescription>Pedido #{short?.order.number}. Si confirmás igual, el stock de esos productos queda en negativo.</DialogDescription>
          </DialogHeader>
          <p className="rounded-md bg-muted p-3 text-sm">{short?.message}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShort(null)}>Cancelar</Button>
            <Button onClick={forceIt} disabled={busy}>Confirmar igual (queda en negativo)</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <DataTable
        rows={rows}
        getKey={(o) => o.id}
        empty={<EmptyState icon={Inbox} title="No hay registros" />}
        columns={[
          { header: "Pedido", cell: (o) => <div><div className="font-medium">{o.customer_name || "Cliente"}</div><div className="text-xs text-muted-foreground">#{o.number} · {o.channel === "whatsapp" ? "WhatsApp" : "Local"}</div></div> },
          { header: "Detalle", cell: (o) => o.items.map((i) => `${i.quantity} x ${i.name}`).join(", "), hideOnMobile: true },
          { header: "Fecha", cell: (o) => formatDateTime(o.created_at), hideOnMobile: true },
          { header: "Total", cell: (o) => formatPrice(o.total), className: "text-right whitespace-nowrap" },
          { header: "Estado", cell: (o) => <StatusBadge tone={tone[o.status]}>{orderStatusLabel[o.status]}</StatusBadge> },
          ...(actions
            ? [{ header: "Acciones", cell: (o: PanelOrder) => (
                <div className="flex gap-1">
                  <Button size="sm" disabled={busy} onClick={() => confirmIt(o)}><Check /> Confirmar</Button>
                  <Button size="sm" variant="ghost" aria-label="Cancelar pedido" onClick={() => cancelIt(o)}><X /></Button>
                </div>
              ) }]
            : []),
        ]}
      />
    </>
  );
}

function Ventas() {
  const { data: orders, isAdmin } = usePanelOrders();
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
        <TabsContent value="pendiente" className="mt-4"><OrdersTable rows={by("pendiente")} actions isAdmin={isAdmin} /></TabsContent>
        <TabsContent value="confirmado" className="mt-4"><OrdersTable rows={by("confirmado")} isAdmin={isAdmin} /></TabsContent>
        <TabsContent value="cancelado" className="mt-4"><OrdersTable rows={by("cancelado")} isAdmin={isAdmin} /></TabsContent>
      </Tabs>
    </>
  );
}
