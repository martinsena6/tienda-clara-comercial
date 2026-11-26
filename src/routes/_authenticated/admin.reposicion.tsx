import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Clock,
  MessageCircle,
  PackageCheck,
  Phone,
  RefreshCw,
  Send,
  Trash2,
  X,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { DataTable } from "@/components/admin/DataTable";
import { PageHeader } from "@/components/admin/PageHeader";
import { RequireAdmin } from "@/components/admin/RequireAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  adminProductsQuery,
  errorMessage,
  registerPurchase,
  replenishmentQuery,
  saveSupplier,
  suppliersQuery,
  todayAR,
} from "@/lib/data";
import { formatPrice } from "@/lib/format";
import { requireAdminRoute } from "@/lib/auth";
import { arWhatsAppPhone, buildWhatsAppUrl } from "@/lib/whatsapp";

export const Route = createFileRoute("/_authenticated/admin/reposicion")({
  beforeLoad: requireAdminRoute,
  head: () => ({
    meta: [{ title: "Reposición — Panel Festiva" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <RequireAdmin>
      <Reposicion />
    </RequireAdmin>
  ),
});

interface ReplenishmentItem {
  product_id: string;
  name: string;
  quantity: number;
  unit_cost: number;
}

interface ReplenishmentOrder {
  id: string;
  number: number;
  supplier: string;
  supplier_id: string | null;
  phone: string;
  created_at: string;
  status: "en_camino" | "recibido" | "cancelado";
  items: ReplenishmentItem[];
  total_estimated: number;
  received_at?: string;
}

const STORAGE_KEY = "festiva_replenishment_orders";

function loadReplenishmentOrders(): ReplenishmentOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveReplenishmentOrders(orders: ReplenishmentOrder[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  window.dispatchEvent(new Event("festiva_replenishments_updated"));
}

function Reposicion() {
  const qc = useQueryClient();
  const { data: suggestions = [], isLoading, error } = useQuery(replenishmentQuery);
  const suppliersResult = useQuery(suppliersQuery);
  const productsResult = useQuery(adminProductsQuery);

  const suppliers = suppliersResult.data ?? [];
  const products = productsResult.data ?? [];

  const productMap = useMemo(() => {
    return new Map(products.map((p) => [p.id, p]));
  }, [products]);

  const [activeTab, setActiveTab] = useState<"sugerencias" | "en_camino" | "historial">("sugerencias");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [supplierPhones, setSupplierPhones] = useState<Record<string, string>>({});
  const [editingPhone, setEditingPhone] = useState<Record<string, boolean>>({});
  const [busyOrders, setBusyOrders] = useState<Record<string, boolean>>({});
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

  const [orders, setOrders] = useState<ReplenishmentOrder[]>(() => loadReplenishmentOrders());

  useEffect(() => {
    const handleUpdate = () => setOrders(loadReplenishmentOrders());
    window.addEventListener("festiva_replenishments_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("festiva_replenishments_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  useEffect(() => {
    setQuantities((prev) => {
      const next = { ...prev };
      for (const row of suggestions) {
        if (next[row.product_id] === undefined) {
          next[row.product_id] = String(row.sugerido);
        }
      }
      return next;
    });
  }, [suggestions]);

  const groups = useMemo(() => {
    const grouped = new Map<string, typeof suggestions>();
    for (const row of suggestions) {
      const supplier = row.supplier?.trim() || "Sin proveedor";
      grouped.set(supplier, [...(grouped.get(supplier) ?? []), row]);
    }
    return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b, "es"));
  }, [suggestions]);

  const pendingOrders = useMemo(
    () => orders.filter((o) => o.status === "en_camino").sort((a, b) => b.number - a.number),
    [orders],
  );

  const historyOrders = useMemo(
    () => orders.filter((o) => o.status !== "en_camino").sort((a, b) => b.number - a.number),
    [orders],
  );

  const handleSavePhone = async (supplierName: string, phone: string) => {
    const cleaned = phone.trim();
    if (!cleaned) {
      toast.error("Ingresá un número de teléfono");
      return;
    }
    const supplierRecord = suppliers.find(
      (s) => s.name.trim().toLowerCase() === supplierName.trim().toLowerCase(),
    );
    try {
      if (supplierRecord) {
        await saveSupplier({
          id: supplierRecord.id,
          name: supplierRecord.name,
          phone: cleaned,
          notes: supplierRecord.notes ?? "",
        });
        toast.success(`Teléfono guardado en la ficha de ${supplierName}`);
      } else {
        await saveSupplier({
          name: supplierName,
          phone: cleaned,
          notes: "Creado desde reposición",
        });
        toast.success(`Proveedor ${supplierName} registrado con su teléfono`);
      }
      await qc.invalidateQueries({ queryKey: ["suppliers"] });
      setEditingPhone((prev) => ({ ...prev, [supplierName]: false }));
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const handleCreateOrder = (supplierName: string, rows: typeof suggestions) => {
    const supplierRecord = suppliers.find(
      (s) => s.name.trim().toLowerCase() === supplierName.trim().toLowerCase(),
    );
    const activePhone = supplierPhones[supplierName] || supplierRecord?.phone || "";

    const items: ReplenishmentItem[] = rows
      .map((row) => {
        const qty = Number(quantities[row.product_id] ?? 0);
        const prod = productMap.get(row.product_id);
        const cost = prod?.cost ?? 0;
        return {
          product_id: row.product_id,
          name: row.name,
          quantity: qty,
          unit_cost: cost,
        };
      })
      .filter((it) => Number.isInteger(it.quantity) && it.quantity > 0);

    if (items.length === 0) {
      toast.error("Seleccioná al menos un producto con cantidad mayor a 0");
      return;
    }

    const totalEstimated = items.reduce((acc, it) => acc + it.quantity * it.unit_cost, 0);
    const nextNumber = orders.length > 0 ? Math.max(...orders.map((o) => o.number)) + 1 : 1;

    const newOrder: ReplenishmentOrder = {
      id: `rep_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      number: nextNumber,
      supplier: supplierName,
      supplier_id: supplierRecord?.id ?? null,
      phone: activePhone,
      created_at: new Date().toISOString(),
      status: "en_camino",
      items,
      total_estimated: totalEstimated,
    };

    const nextOrders = [newOrder, ...orders];
    saveReplenishmentOrders(nextOrders);
    setOrders(nextOrders);

    toast.success(
      `Orden #${nextNumber} guardada en "Pedidos en camino". La mercadería aún no figura en stock hasta su ingreso.`,
    );
    setActiveTab("en_camino");
  };

  const handleConfirmArrival = async (order: ReplenishmentOrder) => {
    setBusyOrders((prev) => ({ ...prev, [order.id]: true }));
    try {
      await registerPurchase({
        date: todayAR(),
        supplier_id: order.supplier_id,
        notes: `Ingreso reposición orden #${order.number} (${order.supplier})`,
        items: order.items.map((it) => ({
          product_id: it.product_id,
          quantity: it.quantity,
          unit_cost: it.unit_cost,
        })),
        update_cost: true,
      });

      const nextOrders = orders.map((o) =>
        o.id === order.id
          ? {
              ...o,
              status: "recibido" as const,
              received_at: new Date().toISOString(),
            }
          : o,
      );
      saveReplenishmentOrders(nextOrders);
      setOrders(nextOrders);

      await Promise.all([
        qc.invalidateQueries({ queryKey: ["purchases"] }),
        qc.invalidateQueries({ queryKey: ["admin-products"] }),
        qc.invalidateQueries({ queryKey: ["products"] }),
        qc.invalidateQueries({ queryKey: ["staff-products"] }),
        qc.invalidateQueries({ queryKey: ["public-products"] }),
        qc.invalidateQueries({ queryKey: ["replenishment-suggestions"] }),
        qc.invalidateQueries({ queryKey: ["movements"] }),
      ]);

      toast.success("¡Ingreso confirmado! Compra registrada y unidades sumadas al stock físico.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyOrders((prev) => ({ ...prev, [order.id]: false }));
    }
  };

  const handleCancelOrder = (orderId: string) => {
    if (!confirm("¿Cancelar este pedido de reposición?")) return;
    const nextOrders = orders.map((o) =>
      o.id === orderId ? { ...o, status: "cancelado" as const } : o,
    );
    saveReplenishmentOrders(nextOrders);
    setOrders(nextOrders);
    toast.info("Pedido de reposición cancelado");
  };

  const handleDeleteOrder = (orderId: string) => {
    if (!confirm("¿Eliminar este registro del historial?")) return;
    const nextOrders = orders.filter((o) => o.id !== orderId);
    saveReplenishmentOrders(nextOrders);
    setOrders(nextOrders);
    toast.info("Registro eliminado");
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Calculando sugerencias…</p>;

  return (
    <>
      <PageHeader
        title="Reposición de Mercadería"
        description="Generá pedidos para tus proveedores por WhatsApp, guardalos como órdenes en camino y confirmá su ingreso al local con un solo clic."
      />

      {error && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {errorMessage(error)}
        </p>
      )}

      {/* Pestañas */}
      <div className="mb-6 flex flex-wrap gap-2 border-b pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("sugerencias")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "sugerencias"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
          }`}
        >
          <span>1. Sugerencias a pedir</span>
          {suggestions.length > 0 && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                activeTab === "sugerencias"
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-background text-foreground"
              }`}
            >
              {suggestions.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("en_camino")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "en_camino"
              ? "bg-amber-600 text-white shadow-sm"
              : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>2. Pedidos en camino</span>
          {pendingOrders.length > 0 && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                activeTab === "en_camino"
                  ? "bg-white text-amber-700"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
              }`}
            >
              {pendingOrders.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("historial")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "historial"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
          }`}
        >
          <PackageCheck className="h-4 w-4" />
          <span>Historial de ingresos</span>
          {historyOrders.length > 0 && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                activeTab === "historial"
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-background text-foreground"
              }`}
            >
              {historyOrders.length}
            </span>
          )}
        </button>
      </div>

      {/* VISTA 1: SUGERENCIAS */}
      {activeTab === "sugerencias" && (
        <div className="space-y-6">
          {groups.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
              <Check className="mx-auto mb-2 h-8 w-8 text-green-600" />
              <p className="font-medium text-foreground">Todo el stock está al día</p>
              <p className="text-sm">Ningún producto está por debajo de su stock mínimo configurado.</p>
            </div>
          ) : (
            groups.map(([supplier, rows]) => {
              const supplierRecord = suppliers.find(
                (entry) => entry.name.trim().toLowerCase() === supplier.toLowerCase(),
              );

              const currentPhone = supplierPhones[supplier] ?? supplierRecord?.phone ?? "";
              const isEditing = editingPhone[supplier] ?? false;

              const purchaseRows = rows
                .map((row) => ({
                  product_id: row.product_id,
                  quantity: Number(quantities[row.product_id] ?? 0),
                  unit_cost: productMap.get(row.product_id)?.cost ?? 0,
                  name: row.name,
                }))
                .filter((row) => Number.isInteger(row.quantity) && row.quantity > 0);

              const estimatedTotal = purchaseRows.reduce(
                (acc, it) => acc + it.quantity * it.unit_cost,
                0,
              );

              const whatsappLines = purchaseRows.map((row) => `• ${row.quantity} x ${row.name}`);
              const whatsappMessage = [
                `Hola ${supplier !== "Sin proveedor" ? supplier : ""}, te paso el pedido de reposición para Festiva:`,
                "",
                ...whatsappLines,
                "",
                "Por favor confirmame disponibilidad y fecha estimada de entrega. ¡Muchas gracias!",
              ].join("\n");

              const whatsappCandidate = currentPhone ? arWhatsAppPhone(currentPhone) : "";
              const whatsappPhone = /^\d{11,15}$/.test(whatsappCandidate) ? whatsappCandidate : "";

              return (
                <section key={supplier} className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold tracking-tight">{supplier}</h2>
                        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                          {rows.length} {rows.length === 1 ? "producto" : "productos"} a reponer
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-1 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        {isEditing || !supplierRecord?.phone ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="tel"
                              placeholder="Celular (ej: 3624556677)"
                              value={currentPhone}
                              onChange={(e) =>
                                setSupplierPhones((prev) => ({
                                  ...prev,
                                  [supplier]: e.target.value,
                                }))
                              }
                              className="h-8 w-52 text-sm"
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void handleSavePhone(supplier, currentPhone)}
                            >
                              Guardar
                            </Button>
                            {supplierRecord?.phone && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  setEditingPhone((prev) => ({ ...prev, [supplier]: false }))
                                }
                              >
                                Cancelar
                              </Button>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{supplierRecord.phone}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                              onClick={() =>
                                setEditingPhone((prev) => ({ ...prev, [supplier]: true }))
                              }
                            >
                              Modificar
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {whatsappPhone && purchaseRows.length > 0 && (
                        <Button asChild className="bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm">
                          <a
                            href={buildWhatsAppUrl(whatsappPhone, whatsappMessage)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <MessageCircle className="h-4 w-4" />
                            Pedir por WhatsApp
                          </a>
                        </Button>
                      )}

                      <Button
                        onClick={() => handleCreateOrder(supplier, rows)}
                        disabled={purchaseRows.length === 0}
                        className="bg-amber-600 text-white hover:bg-amber-700 shadow-sm"
                      >
                        <Send className="h-4 w-4" />
                        Guardar orden (En camino)
                      </Button>
                    </div>
                  </div>

                  <DataTable
                    rows={rows}
                    getKey={(row) => row.product_id}
                    columns={[
                      {
                        header: "Producto",
                        cell: (row) => <span className="font-medium">{row.name}</span>,
                      },
                      {
                        header: "Stock actual",
                        cell: (row) => (
                          <span
                            className={
                              row.stock === 0 ? "font-bold text-destructive" : "text-muted-foreground"
                            }
                          >
                            {row.stock} un.
                          </span>
                        ),
                        className: "text-right",
                      },
                      {
                        header: "Mínimo",
                        cell: (row) => `${row.min_stock} un.`,
                        className: "text-right",
                      },
                      {
                        header: "Costo unit.",
                        cell: (row) => {
                          const cost = productMap.get(row.product_id)?.cost ?? 0;
                          return cost > 0 ? formatPrice(cost) : "Sin costo";
                        },
                        className: "text-right",
                      },
                      {
                        header: "Cantidad a pedir",
                        cell: (row) => (
                          <Input
                            aria-label={`Cantidad a pedir de ${row.name}`}
                            type="number"
                            min={0}
                            step={1}
                            value={quantities[row.product_id] ?? String(row.sugerido)}
                            onChange={(event) =>
                              setQuantities((current) => ({
                                ...current,
                                [row.product_id]: event.target.value,
                              }))
                            }
                            className="ml-auto w-24 text-right font-semibold"
                          />
                        ),
                        className: "text-right",
                      },
                    ]}
                  />

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm">
                    <span className="text-muted-foreground">
                      {purchaseRows.length} productos con cantidades seleccionadas
                    </span>
                    <div className="flex items-center gap-4">
                      {estimatedTotal > 0 && (
                        <span className="text-base font-semibold">
                          Total estimado:{" "}
                          <span className="text-primary font-bold">
                            {formatPrice(estimatedTotal)}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                </section>
              );
            })
          )}
        </div>
      )}

      {/* VISTA 2: PEDIDOS EN CAMINO */}
      {activeTab === "en_camino" && (
        <div className="space-y-4">
          <div className="rounded-lg bg-amber-500/10 p-4 border border-amber-500/20 text-sm">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-amber-900 dark:text-amber-200">
                  Mercadería pedida y en camino
                </p>
                <p className="text-amber-800 dark:text-amber-300">
                  Estas órdenes representan pedidos ya enviados a los proveedores.{" "}
                  <strong>No suman stock ni computan gastos</strong> hasta que el pedido llegue físicamente al local y toques <strong>"Confirmar ingreso al local"</strong>.
                </p>
              </div>
            </div>
          </div>

          {pendingOrders.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
              <Clock className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
              <p className="font-medium text-foreground">No hay pedidos en camino</p>
              <p className="text-sm">
                Cuando armes un pedido en la pestaña de sugerencias y toques "Guardar orden", aparecerá acá esperando su recepción física.
              </p>
            </div>
          ) : (
            pendingOrders.map((order) => {
              const isBusy = busyOrders[order.id] ?? false;
              const isExpanded = expandedOrders[order.id] ?? true;
              const createdDate = new Date(order.created_at).toLocaleString("es-AR", {
                dateStyle: "medium",
                timeStyle: "short",
              });

              const whatsappLines = order.items.map((row) => `• ${row.quantity} x ${row.name}`);
              const whatsappMessage = [
                `Hola ${order.supplier !== "Sin proveedor" ? order.supplier : ""}, te consulto por la orden #${order.number} para Festiva:`,
                "",
                ...whatsappLines,
              ].join("\n");
              const whatsappCandidate = order.phone ? arWhatsAppPhone(order.phone) : "";
              const whatsappPhone = /^\d{11,15}$/.test(whatsappCandidate) ? whatsappCandidate : "";

              return (
                <div
                  key={order.id}
                  className="rounded-xl border bg-card p-5 shadow-sm space-y-4 border-amber-200 dark:border-amber-900/40"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold">Orden #{order.number}</span>
                        <span className="rounded-full bg-amber-500/10 px-3 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                          <Clock className="h-3 w-3" /> En camino
                        </span>
                      </div>
                      <p className="text-base font-semibold text-foreground">
                        Proveedor: {order.supplier}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Pedido enviado el {createdDate}
                        {order.phone ? ` · Celular: ${order.phone}` : ""}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {whatsappPhone && (
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                        >
                          <a
                            href={buildWhatsAppUrl(whatsappPhone, whatsappMessage)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <MessageCircle className="h-4 w-4" />
                            WhatsApp
                          </a>
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => handleCancelOrder(order.id)}
                      >
                        <X className="h-4 w-4" />
                        Cancelar
                      </Button>

                      <Button
                        size="sm"
                        disabled={isBusy}
                        onClick={() => void handleConfirmArrival(order)}
                        className="bg-emerald-600 text-white hover:bg-emerald-700 font-semibold shadow-sm px-4"
                      >
                        {isBusy ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <PackageCheck className="h-4 w-4" />
                        )}
                        {isBusy ? "Registrando ingreso…" : "Confirmar ingreso al local"}
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-lg bg-muted/40 p-3">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedOrders((prev) => ({
                          ...prev,
                          [order.id]: !isExpanded,
                        }))
                      }
                      className="flex w-full items-center justify-between text-sm font-medium text-muted-foreground hover:text-foreground"
                    >
                      <span>
                        {order.items.length}{" "}
                        {order.items.length === 1 ? "producto pedido" : "productos pedidos"}
                      </span>
                      <span className="flex items-center gap-1 text-xs">
                        {isExpanded ? "Ocultar lista" : "Ver lista"}
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </span>
                    </button>

                    {isExpanded && (
                      <ul className="mt-3 divide-y divide-border/60 text-sm">
                        {order.items.map((it) => (
                          <li key={it.product_id} className="flex items-center justify-between py-2">
                            <span className="font-medium text-foreground">{it.name}</span>
                            <div className="flex items-center gap-4 text-muted-foreground">
                              <span>
                                {it.quantity} un. × {formatPrice(it.unit_cost)}
                              </span>
                              <span className="font-semibold text-foreground">
                                {formatPrice(it.quantity * it.unit_cost)}
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="mt-2 flex justify-between border-t border-border/80 pt-2 text-sm font-bold">
                      <span>Total estimado de la orden:</span>
                      <span className="text-primary">{formatPrice(order.total_estimated)}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* VISTA 3: HISTORIAL */}
      {activeTab === "historial" && (
        <div className="space-y-4">
          {historyOrders.length === 0 ? (
            <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              Aún no hay órdenes de reposición finalizadas en el historial.
            </p>
          ) : (
            historyOrders.map((order) => {
              const dateStr = order.received_at
                ? new Date(order.received_at).toLocaleString("es-AR", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : new Date(order.created_at).toLocaleString("es-AR", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  });

              return (
                <div
                  key={order.id}
                  className="rounded-xl border bg-card p-4 text-sm flex flex-wrap items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold">Orden #{order.number}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          order.status === "recibido"
                            ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                            : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                        }`}
                      >
                        {order.status === "recibido" ? "Ingresado al local" : "Cancelado"}
                      </span>
                    </div>
                    <p className="font-medium text-foreground">Proveedor: {order.supplier}</p>
                    <p className="text-xs text-muted-foreground">
                      {order.status === "recibido" ? `Ingresó el: ${dateStr}` : `Creado el: ${dateStr}`} ·{" "}
                      {order.items.length} productos
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="font-bold text-foreground">
                      {formatPrice(order.total_estimated)}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDeleteOrder(order.id)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Eliminar registro"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </>
  );
}
