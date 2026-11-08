import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Inbox, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/admin/DataTable";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  cancelOrder,
  confirmOrder,
  errorMessage,
  expirePendingOrders,
  markOrderDelivered,
  normalizeName,
  todayAR,
  updateOrderItems,
  usePanelOrders,
  usePanelProducts,
  voidConfirmedOrder,
  type PanelOrder,
} from "@/lib/data";
import type { OrderStatus } from "@/lib/domain/types";
import { formatDate, formatDateTime, formatPrice, orderStatusLabel } from "@/lib/format";
import { arWhatsAppPhone, buildWhatsAppUrl } from "@/lib/whatsapp";

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

const tone: Record<OrderStatus, "warning" | "success" | "neutral"> = {
  pendiente: "warning",
  confirmado: "success",
  cancelado: "neutral",
};

interface EditLine {
  product_id: string;
  name: string;
  quantity: string;
}

function daysUntil(date: string): number {
  const [y, m, d] = todayAR().split("-").map(Number);
  const [ey, em, ed] = date.split("-").map(Number);
  return Math.round((Date.UTC(ey!, em! - 1, ed!) - Date.UTC(y!, m! - 1, d!)) / 86_400_000);
}

function deliveryAddress(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const address = value as Record<string, unknown>;
  return ["street", "city", "province", "postal_code"]
    .map((key) => address[key])
    .filter((part): part is string => typeof part === "string" && part.trim() !== "")
    .join(", ");
}

function isExpired(order: PanelOrder): boolean {
  return (
    order.status === "pendiente" &&
    Date.now() - new Date(order.created_at).getTime() > 48 * 60 * 60 * 1000
  );
}

function OrdersTable({
  rows,
  actions = false,
  isAdmin,
}: {
  rows: PanelOrder[];
  actions?: boolean;
  isAdmin: boolean;
}) {
  const qc = useQueryClient();
  const { data: products, isLoading: productsLoading } = usePanelProducts();
  const [short, setShort] = useState<{ order: PanelOrder; message: string } | null>(null);
  const [editing, setEditing] = useState<PanelOrder | null>(null);
  const [editLines, setEditLines] = useState<EditLine[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [voiding, setVoiding] = useState<PanelOrder | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [busy, setBusy] = useState(false);

  const productMatches = useMemo(() => {
    const q = normalizeName(productSearch);
    if (q.length < 2) return [];
    return products
      .filter(
        (p) =>
          p.active &&
          normalizeName(p.name).includes(q) &&
          !editLines.some((line) => line.product_id === p.id),
      )
      .slice(0, 8);
  }, [productSearch, products, editLines]);

  const refresh = async (message: string) => {
    await qc.invalidateQueries();
    toast.success(message);
  };

  const confirmIt = async (order: PanelOrder) => {
    if (isAdmin && productsLoading) {
      toast.error("Esperá a que terminen de cargar los costos antes de confirmar");
      return;
    }
    const withoutCost = isAdmin
      ? order.items.filter((item) => {
          const currentCost = products.find((product) => product.id === item.product_id)?.cost;
          return (currentCost ?? item.unit_cost ?? 0) <= 0;
        })
      : [];
    if (
      withoutCost.length &&
      !confirm(
        `Estos productos no tienen costo cargado y la ganancia no será confiable: ${withoutCost.map((item) => item.name).join(", ")}. ¿Confirmar igual?`,
      )
    )
      return;
    setBusy(true);
    try {
      await confirmOrder(order.id, false);
      await refresh("Venta confirmada y stock descontado");
    } catch (error) {
      const message = errorMessage(error);
      if (/stock insuficiente/i.test(message)) setShort({ order, message });
      else toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const forceConfirm = async () => {
    if (!short) return;
    setBusy(true);
    try {
      await confirmOrder(short.order.id, true);
      setShort(null);
      await refresh("Venta confirmada (stock en negativo)");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const cancelIt = async (order: PanelOrder) => {
    if (!confirm("¿Cancelar este pedido?")) return;
    try {
      await cancelOrder(order.id);
      await refresh("Pedido cancelado");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const beginEdit = (order: PanelOrder) => {
    setEditing(order);
    setEditLines(
      order.items.map((item) => ({
        product_id: item.product_id ?? "",
        name: item.name,
        quantity: String(item.quantity),
      })),
    );
    setProductSearch("");
  };

  const saveEdit = async () => {
    if (!editing) return;
    const items = editLines
      .filter((line) => line.product_id)
      .map((line) => ({ product_id: line.product_id, quantity: Number(line.quantity) }));
    if (
      editLines.some(
        (line) =>
          !Number.isInteger(Number(line.quantity)) ||
          Number(line.quantity) < 0 ||
          Number(line.quantity) > 999,
      )
    ) {
      toast.error("Revisá las cantidades: deben ser números entre 0 y 999");
      return;
    }
    if (editLines.some((line) => !line.product_id && Number(line.quantity) > 0)) {
      toast.error("No se pudo identificar un producto del pedido");
      return;
    }
    setBusy(true);
    try {
      await updateOrderItems(editing.id, items);
      setEditing(null);
      await refresh("Pedido actualizado");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const markDelivered = async (order: PanelOrder) => {
    try {
      await markOrderDelivered(order.id);
      await refresh("Pedido marcado como entregado");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const voidSale = async () => {
    if (!voiding) return;
    setBusy(true);
    try {
      await voidConfirmedOrder(voiding.id, voidReason);
      setVoiding(null);
      setVoidReason("");
      await refresh("Venta anulada y stock restituido");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Dialog open={!!short} onOpenChange={(open) => !open && setShort(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>No alcanza el stock</DialogTitle>
            <DialogDescription>
              Pedido #{short?.order.number}. Si confirmás igual, el stock de esos productos queda en
              negativo.
            </DialogDescription>
          </DialogHeader>
          <p className="rounded-md bg-muted p-3 text-sm">{short?.message}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShort(null)}>
              Cancelar
            </Button>
            <Button onClick={forceConfirm} disabled={busy}>
              Confirmar igual (queda en negativo)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Editar pedido #{editing?.number}</DialogTitle>
            <DialogDescription>
              Usá cantidad 0 para quitar un producto. Los cambios conservan los precios ya
              acordados.
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Input
              placeholder="Buscar producto para agregar…"
              value={productSearch}
              onChange={(event) => setProductSearch(event.target.value)}
            />
            {productMatches.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-lift">
                {productMatches.map((product) => (
                  <li key={product.id}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => {
                        setEditLines((current) => [
                          ...current,
                          { product_id: product.id, name: product.name, quantity: "1" },
                        ]);
                        setProductSearch("");
                      }}
                    >
                      {product.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <ul className="divide-y">
            {editLines.map((line, index) => (
              <li
                key={`${line.product_id}-${index}`}
                className="grid grid-cols-[1fr_6rem_auto] items-center gap-2 py-2"
              >
                <span className="truncate text-sm">{line.name}</span>
                <Input
                  aria-label={`Cantidad de ${line.name}`}
                  inputMode="numeric"
                  value={line.quantity}
                  onChange={(event) =>
                    setEditLines((current) =>
                      current.map((item, i) =>
                        i === index ? { ...item, quantity: event.target.value } : item,
                      ),
                    )
                  }
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label={`Quitar ${line.name}`}
                  onClick={() => setEditLines((current) => current.filter((_, i) => i !== index))}
                >
                  <X />
                </Button>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={saveEdit} disabled={busy}>
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!voiding} onOpenChange={(open) => !open && setVoiding(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anular venta #{voiding?.number}</DialogTitle>
            <DialogDescription>
              La anulación cancela la venta y registra la devolución de las unidades al stock.
            </DialogDescription>
          </DialogHeader>
          <Input
            maxLength={150}
            placeholder="Motivo de la anulación"
            value={voidReason}
            onChange={(event) => setVoidReason(event.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoiding(null)}>
              Volver
            </Button>
            <Button variant="destructive" onClick={voidSale} disabled={busy}>
              Anular venta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <DataTable
        rows={rows}
        getKey={(order) => order.id}
        empty={<EmptyState icon={Inbox} title="No hay registros" />}
        columns={[
          {
            header: "Pedido",
            cell: (order) => (
              <div>
                <div className="font-medium">{order.customer_name || "Cliente"}</div>
                <div className="text-xs text-muted-foreground">
                  #{order.number} · {order.channel === "whatsapp" ? "WhatsApp" : "Local"}
                </div>
                {isExpired(order) && (
                  <span className="mt-1 inline-block rounded bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                    Pendiente hace más de 48 h
                  </span>
                )}
              </div>
            ),
          },
          {
            header: "Contacto",
            cell: (order) =>
              order.customer_phone ? (
                <a
                  className="text-primary underline-offset-2 hover:underline"
                  href={buildWhatsAppUrl(
                    arWhatsAppPhone(order.customer_phone),
                    `Hola ${order.customer_name}, te escribo por el pedido #${order.number}.`,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {order.customer_phone}
                </a>
              ) : (
                "—"
              ),
          },
          {
            header: "Detalle",
            cell: (order) =>
              order.items.map((item) => `${item.quantity} × ${item.name}`).join(", "),
            hideOnMobile: true,
          },
          {
            header: "Entrega / evento",
            cell: (order) => {
              const address = deliveryAddress(order.delivery_address);
              const days = order.event_date ? daysUntil(order.event_date) : null;
              return (
                <div className="space-y-1">
                  <div>{order.delivery_method === "envio" ? "Envío" : "Retiro"}</div>
                  {address && (
                    <div className="max-w-48 text-xs text-muted-foreground">{address}</div>
                  )}
                  {order.event_date && (
                    <div
                      className={`text-xs font-medium ${days !== null && days <= 3 ? "text-destructive" : "text-muted-foreground"}`}
                    >
                      {formatDate(order.event_date)} ·{" "}
                      {days === 0
                        ? "Evento hoy"
                        : days! < 0
                          ? `Evento vencido hace ${Math.abs(days!)} días`
                          : `Evento en ${days} días`}
                    </div>
                  )}
                  {order.delivered_at && (
                    <div className="text-xs text-success">
                      Entregado {formatDate(order.delivered_at)}
                    </div>
                  )}
                </div>
              );
            },
            hideOnMobile: true,
          },
          {
            header: "Fecha",
            cell: (order) => formatDateTime(order.created_at),
            hideOnMobile: true,
          },
          {
            header: "Total",
            cell: (order) => formatPrice(order.total),
            className: "whitespace-nowrap text-right",
          },
          {
            header: "Costo",
            cell: (order) => (order.cost_total > 0 ? formatPrice(order.cost_total) : "—"),
            className: "whitespace-nowrap text-right",
            hideOnMobile: true,
          },
          {
            header: "Ganancia",
            cell: (order) =>
              order.cost_total > 0 ? formatPrice(order.total - order.cost_total) : "—",
            className: "whitespace-nowrap text-right",
            hideOnMobile: true,
          },
          {
            header: "Estado",
            cell: (order) => (
              <StatusBadge tone={tone[order.status]}>{orderStatusLabel[order.status]}</StatusBadge>
            ),
          },
          ...(actions
            ? [
                {
                  header: "Acciones",
                  cell: (order: PanelOrder) => (
                    <div className="flex flex-wrap gap-1">
                      <Button size="sm" disabled={busy} onClick={() => confirmIt(order)}>
                        <Check /> Confirmar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => beginEdit(order)}
                        aria-label={`Editar pedido ${order.number}`}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        aria-label="Cancelar pedido"
                        onClick={() => cancelIt(order)}
                      >
                        <X />
                      </Button>
                    </div>
                  ),
                },
              ]
            : []),
          ...(!actions && rows.some((order) => order.status === "confirmado")
            ? [
                {
                  header: "Acciones",
                  cell: (order: PanelOrder) =>
                    order.status !== "confirmado" ? null : (
                      <div className="flex flex-wrap gap-1">
                        {!order.delivered_at && (
                          <Button size="sm" variant="outline" onClick={() => markDelivered(order)}>
                            Marcar entregado
                          </Button>
                        )}
                        {isAdmin && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setVoiding(order);
                              setVoidReason("");
                            }}
                          >
                            Anular venta
                          </Button>
                        )}
                      </div>
                    ),
                },
              ]
            : []),
        ]}
      />
    </>
  );
}

function Ventas() {
  const qc = useQueryClient();
  const { data: orders, isAdmin } = usePanelOrders();
  const by = (status: OrderStatus) => orders.filter((order) => order.status === status);
  const pending = by("pendiente").sort((a, b) => {
    if (a.event_date && b.event_date) return a.event_date.localeCompare(b.event_date);
    if (a.event_date) return -1;
    if (b.event_date) return 1;
    return a.created_at.localeCompare(b.created_at);
  });
  const expiredCount = pending.filter(isExpired).length;
  const [expiring, setExpiring] = useState(false);

  const cancelExpired = async () => {
    setExpiring(true);
    try {
      const count = await expirePendingOrders(48);
      await qc.invalidateQueries();
      toast.success(`${count} pedidos vencidos cancelados`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setExpiring(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Ventas"
        description="Los pedidos de WhatsApp llegan como pendientes. Solo al confirmarlos se convierten en venta y descuentan stock."
        actions={
          expiredCount > 0 ? (
            <Button variant="outline" onClick={cancelExpired} disabled={expiring}>
              {expiring ? "Cancelando…" : `Cancelar vencidos (${expiredCount})`}
            </Button>
          ) : undefined
        }
      />
      <Tabs defaultValue="pendiente">
        <TabsList>
          <TabsTrigger value="pendiente">Pendientes ({pending.length})</TabsTrigger>
          <TabsTrigger value="confirmado">Confirmadas</TabsTrigger>
          <TabsTrigger value="cancelado">Canceladas</TabsTrigger>
        </TabsList>
        <TabsContent value="pendiente" className="mt-4">
          <OrdersTable rows={pending} actions isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="confirmado" className="mt-4">
          <OrdersTable rows={by("confirmado")} isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="cancelado" className="mt-4">
          <OrdersTable rows={by("cancelado")} isAdmin={isAdmin} />
        </TabsContent>
      </Tabs>
    </>
  );
}
