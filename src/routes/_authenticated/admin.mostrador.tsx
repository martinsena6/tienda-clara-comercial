import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  Download,
  Minus,
  Plus,
  QrCode,
  Search,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  createCounterSale,
  errorMessage,
  normalizeName,
  usePanelOrders,
  usePanelProducts,
} from "@/lib/data";
import { formatDate, formatPrice } from "@/lib/format";

type PaymentMethod = "efectivo" | "transferencia" | "debito" | "credito";

interface CartItem {
  product_id: string;
  name: string;
  price: number;
  stock: number;
  quantity: number;
}

export const Route = createFileRoute("/_authenticated/admin/mostrador")({
  head: () => ({
    meta: [
      { title: "Venta Presencial — Festiva" },
      { name: "description", content: "Registro ágil de ventas en el local." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VentaPresencialSimple,
});

function VentaPresencialSimple() {
  const queryClient = useQueryClient();
  const { data: products } = usePanelProducts();
  const { data: orders } = usePanelOrders();

  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("efectivo");
  const [allowNegative, setAllowNegative] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastSale, setLastSale] = useState<{ number: number; total: number } | null>(null);

  // Lista de productos activos ordenados alfabéticamente de la A a la Z
  const sortedProducts = useMemo(() => {
    return (products ?? [])
      .filter((p) => p.active)
      .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
  }, [products]);

  // Filtrado por buscador
  const filteredProducts = useMemo(() => {
    const q = normalizeName(search);
    if (!q) return sortedProducts.slice(0, 25);
    return sortedProducts.filter((p) => normalizeName(p.name).includes(q)).slice(0, 30);
  }, [search, sortedProducts]);

  // Total a cobrar
  const total = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity * item.price, 0);
  }, [cart]);

  // Agregar producto al ticket
  const addItem = (product: { id: string; name: string; price: number; stock_disponible: number }) => {
    setCart((curr) => {
      const idx = curr.findIndex((i) => i.product_id === product.id);
      if (idx >= 0) {
        return curr.map((it, i) => (i === idx ? { ...it, quantity: it.quantity + 1 } : it));
      }
      return [
        ...curr,
        {
          product_id: product.id,
          name: product.name,
          price: product.price,
          stock: product.stock_disponible,
          quantity: 1,
        },
      ];
    });
    setLastSale(null);
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((curr) =>
      curr
        .map((it) => (it.product_id === productId ? { ...it, quantity: it.quantity + delta } : it))
        .filter((it) => it.quantity > 0)
    );
  };

  const removeItem = (productId: string) => {
    setCart((curr) => curr.filter((it) => it.product_id !== productId));
  };

  // Registrar venta
  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error("Seleccioná al menos un producto");
      return;
    }

    const items = cart.map((it) => ({
      product_id: it.product_id,
      quantity: it.quantity,
    }));

    const methodLabel =
      paymentMethod === "efectivo"
        ? "Efectivo"
        : paymentMethod === "transferencia"
        ? "Transferencia / QR"
        : paymentMethod === "debito"
        ? "Débito"
        : "Crédito";

    setBusy(true);
    try {
      const res = await createCounterSale(items, `[Pago: ${methodLabel}]`, allowNegative);

      // Sincronizar stock y métricas al instante
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
        queryClient.invalidateQueries({ queryKey: ["staff-orders"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-products"] }),
        queryClient.invalidateQueries({ queryKey: ["staff-products"] }),
        queryClient.invalidateQueries({ queryKey: ["public-products"] }),
      ]);

      setLastSale({ number: res.number, total: res.total });
      setCart([]);
      setSearch("");
      toast.success(`¡Venta #${res.number} cobrada exitosamente!`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  // Exportar todas las ventas a Excel con canal diferenciado
  const exportToExcel = () => {
    if (!orders || orders.length === 0) {
      toast.error("No hay ventas registradas para exportar");
      return;
    }

    const rows = orders.map((o) => {
      const isPresencial = o.channel !== "whatsapp";
      const canal = isPresencial ? "Presencial (Local)" : "Online (WhatsApp)";
      const productosDetalle = (o.items ?? []).map((it) => `${it.quantity}x ${it.name}`).join(" | ");

      return {
        "N° Pedido/Venta": `#${o.number}`,
        Fecha: formatDate(o.created_at),
        Canal: canal,
        Estado: o.status === "confirmado" ? "Confirmado / Cobrado" : o.status === "pendiente" ? "Pendiente" : "Cancelado",
        Cliente: o.customer_name || (isPresencial ? "Venta en mostrador" : "Cliente web"),
        Teléfono: o.customer_phone || "-",
        Productos: productosDetalle || "-",
        Detalle_Pago: o.notes || "-",
        "Total ($)": o.total,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Ventas");
    const hoy = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `festiva-ventas-${hoy}.xlsx`);
    toast.success("Planilla de ventas descargada con éxito");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* CABECERA CON BOTÓN EXCEL */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Venta Presencial"
          description="Elegí los productos, seleccioná el medio de pago y registrá la venta en segundos."
        />
        <Button variant="outline" size="sm" onClick={exportToExcel} className="self-start sm:self-auto gap-2">
          <Download className="h-4 w-4" />
          Descargar Ventas en Excel
        </Button>
      </div>

      {/* CARTEL DE VENTA EXITOSA */}
      {lastSale && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/40">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            <div>
              <p className="font-bold text-emerald-900 dark:text-emerald-200">
                ¡Venta #{lastSale.number} cobrada!
              </p>
              <p className="text-xs text-emerald-800 dark:text-emerald-300">
                Total: {formatPrice(lastSale.total)} · Stock descontado
              </p>
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setLastSale(null)}>
            Cerrar
          </Button>
        </div>
      )}

      {/* TICKET ACTUAL (SOLO APARECE CUANDO AGREGÁS PRODUCTOS) */}
      {cart.length > 0 && (
        <div className="rounded-xl border border-primary/30 bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h2 className="font-bold text-base flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              Ticket a Cobrar ({cart.length} {cart.length === 1 ? "artículo" : "artículos"})
            </h2>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-destructive h-7"
              onClick={() => setCart([])}
            >
              Vaciar
            </Button>
          </div>

          <div className="divide-y max-h-60 overflow-y-auto pr-1">
            {cart.map((item) => (
              <div key={item.product_id} className="py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatPrice(item.price)} c/u · Subtotal: <span className="font-bold text-foreground">{formatPrice(item.price * item.quantity)}</span>
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => updateQuantity(item.product_id, -1)}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => updateQuantity(item.product_id, 1)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive ml-1"
                    onClick={() => removeItem(item.product_id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* FORMA DE PAGO */}
          <div className="space-y-2 pt-2 border-t">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Forma de Pago
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Button
                type="button"
                variant={paymentMethod === "efectivo" ? "default" : "outline"}
                size="sm"
                className="gap-1.5 text-xs font-medium"
                onClick={() => setPaymentMethod("efectivo")}
              >
                <Banknote className="h-4 w-4" /> Efectivo
              </Button>
              <Button
                type="button"
                variant={paymentMethod === "transferencia" ? "default" : "outline"}
                size="sm"
                className="gap-1.5 text-xs font-medium"
                onClick={() => setPaymentMethod("transferencia")}
              >
                <QrCode className="h-4 w-4" /> Transf. / QR
              </Button>
              <Button
                type="button"
                variant={paymentMethod === "debito" ? "default" : "outline"}
                size="sm"
                className="gap-1.5 text-xs font-medium"
                onClick={() => setPaymentMethod("debito")}
              >
                <CreditCard className="h-4 w-4" /> Débito
              </Button>
              <Button
                type="button"
                variant={paymentMethod === "credito" ? "default" : "outline"}
                size="sm"
                className="gap-1.5 text-xs font-medium"
                onClick={() => setPaymentMethod("credito")}
              >
                <CreditCard className="h-4 w-4" /> Crédito
              </Button>
            </div>
          </div>

          {/* BOTÓN COBRAR */}
          <div className="pt-3 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch checked={allowNegative} onCheckedChange={setAllowNegative} />
              Permitir stock negativo
            </label>

            <div className="flex items-center justify-between sm:justify-end gap-4">
              <div className="text-right">
                <span className="text-xs text-muted-foreground block">Total a Cobrar</span>
                <span className="text-2xl font-black text-primary">{formatPrice(total)}</span>
              </div>
              <Button
                size="lg"
                className="font-bold text-base px-6 py-6 shadow-sm"
                disabled={busy}
                onClick={handleCheckout}
              >
                {busy ? "Cobrando…" : `Cobrar ${formatPrice(total)}`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* BUSCADOR Y LISTA ALFABÉTICA DE PRODUCTOS */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div>
          <h2 className="font-semibold text-base mb-1">Buscar y Seleccionar Producto</h2>
          <p className="text-xs text-muted-foreground">
            Escribí el nombre del producto o seleccionalo de la lista ordenada alfabéticamente (A-Z).
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar golosina o artículo por nombre…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="absolute right-3 top-2.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setSearch("")}
            >
              Limpiar
            </button>
          )}
        </div>

        {/* LISTADO DE PRODUCTOS */}
        <div className="divide-y border rounded-lg max-h-[480px] overflow-y-auto">
          {filteredProducts.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No se encontraron productos con ese nombre.
            </p>
          ) : (
            filteredProducts.map((p) => {
              const inCart = cart.find((it) => it.product_id === p.id);
              return (
                <div
                  key={p.id}
                  className="p-3 flex items-center justify-between gap-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Stock:{" "}
                      <span className={p.stock_disponible <= 5 ? "font-bold text-destructive" : "font-medium"}>
                        {p.stock_disponible} un.
                      </span>{" "}
                      · Precio: <span className="font-semibold text-primary">{formatPrice(p.price)}</span>
                    </p>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant={inCart ? "secondary" : "outline"}
                    className="gap-1.5 shrink-0"
                    onClick={() => addItem(p)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {inCart ? `Agregado (${inCart.quantity})` : "Agregar"}
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
