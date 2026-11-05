import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Ban, Check, Inbox, Pencil, PackageCheck, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/admin/DataTable";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { cancelOrder, confirmOrder, errorMessage, expirePendingOrders, markOrderDelivered, normalizeName, todayAR, updateOrderItems, usePanelOrders, usePanelProducts, voidConfirmedOrder, type PanelOrder } from "@/lib/data";
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
  const [edit, setEdit] = useState<PanelOrder | null>(null);
  const deliver = async (o: PanelOrder) => {
    try { await markOrderDelivered(o.id); await done("Marcado como entregado"); } catch (e) { toast.error(errorMessage(e)); }
  };
  const voidIt = async (o: PanelOrder) => {
    const reason = prompt(`¿Anular la venta #${o.number}? El stock vuelve al inventario. Escribí el motivo:`);
    if (reason === null) return;
    try { await voidConfirmedOrder(o.id, reason); await done("Venta anulada"); } catch (e) { toast.error(errorMessage(e)); }
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
      {edit && <EditOrder order={edit} onClose={() => setEdit(null)} />}
      <DataTable
        rows={rows}
        getKey={(o) => o.id}
        empty={<EmptyState icon={Inbox} title="No hay registros" />}
        columns={[
          { header: "Pedido", cell: (o) => <div><div className="font-medium">{o.customer_name || "Cliente"}</div><div className="text-xs text-muted-foreground">#{o.number} · {o.channel === "whatsapp" ? "WhatsApp" : "Local"}</div></div> },
          { header: "Contacto", cell: (o) => <ContactCell o={o} />, hideOnMobile: true },
          { header: "Detalle", cell: (o) => o.items.map((i) => `${i.quantity} x ${i.name}`).join(", "), hideOnMobile: true },
          { header: "Fecha", cell: (o) => <span className={isStale(o) ? "font-semibold text-destructive" : ""}>{formatDateTime(o.created_at)}{isStale(o) && " · +48 h"}</span>, hideOnMobile: true },
          { header: "Total", cell: (o) => formatPrice(o.total), className: "text-right whitespace-nowrap" },
          { header: "Estado", cell: (o) => <StatusBadge tone={tone[o.status]}>{orderStatusLabel[o.status]}</StatusBadge> },
          ...(actions
            ? [{ header: "Acciones", cell: (o: PanelOrder) => (
                <div className="flex gap-1">
                  <Button size="sm" disabled={busy} onClick={() => confirmIt(o)}><Check /> Confirmar</Button>
                  <Button size="sm" variant="outline" aria-label="Editar pedido" onClick={() => setEdit(o)}><Pencil /></Button>
                  <Button size="sm" variant="ghost" aria-label="Cancelar pedido" onClick={() => cancelIt(o)}><X /></Button>
                </div>
              ) }]
            : [{ header: "Acciones", cell: (o: PanelOrder) => o.status !== "confirmado" ? null : (
                <div className="flex gap-1">
                  {o.delivered_at ? <span className="text-xs text-success">Entregado</span> : <Button size="sm" variant="outline" onClick={() => deliver(o)}><PackageCheck /> Marcar entregado</Button>}
                  {isAdmin && <Button size="sm" variant="ghost" onClick={() => voidIt(o)}><Ban /> Anular venta</Button>}
                </div>
              ) }]),
        ]}
      />
    </>
  );
}

function isStale(o: PanelOrder) {
  return o.status === "pendiente" && Date.now() - new Date(o.created_at).getTime() > 48 * 3600_000;
}
function daysTo(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const [ty, tm, td] = todayAR().split("-").map(Number);
  return Math.round((Date.UTC(y!, m! - 1, d!) - Date.UTC(ty!, tm! - 1, td!)) / 86400_000);
}
function ContactCell({ o }: { o: PanelOrder }) {
  const a = (o.delivery_address ?? {}) as { street?: string; city?: string; province?: string; postal_code?: string };
  const phone = o.customer_phone.replace(/\D/g, "");
  const wa = phone ? `https://wa.me/${phone.startsWith("54") ? phone : `549${phone}`}` : "";
  const n = o.event_date ? daysTo(o.event_date) : null;
  return (
    <div className="space-y-0.5 text-xs">
      {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="text-primary underline">{o.customer_phone}</a>}
      <div>{o.delivery_method === "envio" ? `Envío: ${[a.street, a.city, a.province, a.postal_code].filter(Boolean).join(", ")}` : o.channel === "local" ? "Mostrador" : "Retiro en el local"}</div>
      {n !== null && <div className={n <= 3 ? "font-semibold text-destructive" : "text-muted-foreground"}>{n === 0 ? "Evento hoy" : n < 0 ? `Evento hace ${-n} días` : `Evento en ${n} días`}</div>}
      {o.notes && <div className="text-muted-foreground">“{o.notes}”</div>}
    </div>
  );
}

function EditOrder({ order, onClose }: { order: PanelOrder; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: products } = usePanelProducts();
  const [lines, setLines] = useState(order.items.map((i) => ({ product_id: i.product_id ?? "", name: i.name, quantity: String(i.quantity) })));
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const matches = normalizeName(q).length < 2 ? [] : products.filter((p) => p.active && normalizeName(p.name).includes(normalizeName(q)) && !lines.some((l) => l.product_id === p.id)).slice(0, 6);
  const save = async () => {
    setBusy(true);
    try {
      await updateOrderItems(order.id, lines.map((l) => ({ product_id: l.product_id, quantity: Math.max(0, Math.trunc(Number(l.quantity) || 0)) })));
      await qc.invalidateQueries(); toast.success("Pedido actualizado"); onClose();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar pedido #{order.number}</DialogTitle><DialogDescription>Cantidad 0 quita el producto.</DialogDescription></DialogHeader>
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={l.product_id} className="flex items-center gap-2 text-sm">
              <span className="flex-1 truncate">{l.name}</span>
              <Input className="w-20" inputMode="numeric" aria-label="Cantidad" value={l.quantity} onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} />
            </div>
          ))}
          <Input placeholder="Agregar producto…" value={q} onChange={(e) => setQ(e.target.value)} />
          {matches.map((p) => <button key={p.id} type="button" className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-muted" onClick={() => { setLines((ls) => [...ls, { product_id: p.id, name: p.name, quantity: "1" }]); setQ(""); }}>{p.name}</button>)}
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cerrar</Button><Button disabled={busy} onClick={save}>Guardar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Ventas() {
  const qc = useQueryClient();
  const { data: orders, isAdmin } = usePanelOrders();
  const by = (s: OrderStatus) => {
    const r = orders.filter((o) => o.status === s);
    return s === "pendiente" ? [...r].sort((a, b) => (a.event_date ?? "9999").localeCompare(b.event_date ?? "9999")) : r;
  };
  const stale = orders.filter(isStale).length;
  const expire = async () => {
    if (!confirm(`¿Cancelar ${stale} pedidos pendientes de más de 48 horas?`)) return;
    try { const n = await expirePendingOrders(48); await qc.invalidateQueries(); toast.success(`${n} pedidos cancelados`); } catch (e) { toast.error(errorMessage(e)); }
  };
  return (
    <>
      <PageHeader title="Ventas" description="Los pedidos de WhatsApp llegan como pendientes. Solo al confirmarlos se convierten en venta y descuentan stock." />
      {stale > 0 && <Button variant="outline" className="mb-4" onClick={expire}>Cancelar vencidos ({stale})</Button>}
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
