import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  History,
  Minus,
  Plus,
  QrCode,
  RotateCcw,
  Search,
  ShoppingBag,
  Store,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createCounterSale,
  errorMessage,
  normalizeName,
  parseArNumber,
  usePanelOrders,
  usePanelProducts,
  type PanelOrder,
} from "@/lib/data";
import { formatDate, formatPrice } from "@/lib/format";

type PaymentMethod = "efectivo" | "transferencia" | "debito" | "credito";

interface Line {
  product_id: string;
  name: string;
  stock: number;
  defaultPrice: number;
  quantity: string;
  unit_price: string;
}

export const Route = createFileRoute("/_authenticated/admin/mostrador")({
  head: () => ({
    meta: [
      { title: "Venta Presencial — Panel Festiva" },
      { name: "description", content: "Punto de venta y caja de mostrador en vivo." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Mostrador,
});

function getArgentinaDateKey(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function getArgentinaTime(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

function parsePaymentInfo(notes: string | undefined): {
  method: PaymentMethod;
  label: string;
  badgeClass: string;
} {
  const text = (notes ?? "").toLowerCase();
  if (
    text.includes("transferencia") ||
    text.includes("mp") ||
    text.includes("mercado pago") ||
    text.includes("qr")
  ) {
    return {
      method: "transferencia",
      label: "Transferencia / QR",
      badgeClass: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200",
    };
  }
  if (text.includes("débito") || text.includes("debito")) {
    return {
      method: "debito",
      label: "Débito",
      badgeClass: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200",
    };
  }
  if (text.includes("crédito") || text.includes("credito")) {
    return {
      method: "credito",
      label: "Crédito",
      badgeClass: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 border-indigo-200",
    };
  }
  return {
    method: "efectivo",
    label: "Efectivo",
    badgeClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200",
  };
}

export default function Mostrador() {
  const queryClient = useQueryClient();
  const { data: products } = usePanelProducts();
  const { data: orders } = usePanelOrders();

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("todas");
  const [lines, setLines] = useState<Line[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("efectivo");
  const [cashGiven, setCashGiven] = useState<string>("");
  const [note, setNote] = useState("");
  const [allowNegative, setAllowNegative] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ number: number; total: number; change?: number } | null>(null);

  // Categorías de productos activos
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products ?? []) {
      if (p.active && p.categories?.name) {
        set.add(p.categories.name);
      }
    }
    return Array.from(set).sort();
  }, [products]);

  // Búsqueda y filtrado rápido
  const matches = useMemo(() => {
    const q = normalizeName(search);
    return (products ?? [])
      .filter((p) => {
        if (!p.active) return false;
        if (selectedCategory !== "todas" && p.categories?.name !== selectedCategory) {
          return false;
        }
        if (q.length > 0) {
          return normalizeName(p.name).includes(q);
        }
        return true;
      })
      .slice(0, 12);
  }, [search, selectedCategory, products]);

  // Total de la venta actual
  const total = useMemo(() => {
    return lines.reduce((sum, line) => {
      const price = line.unit_price.trim()
        ? (parseArNumber(line.unit_price) ?? 0)
        : line.defaultPrice;
      return sum + (Number(line.quantity) || 0) * price;
    }, 0);
  }, [lines]);

  // Vuelto en efectivo
  const cashGivenNum = parseArNumber(cashGiven) ?? 0;
  const change = paymentMethod === "efectivo" && cashGivenNum > total ? cashGivenNum - total : 0;

  // Ventas presenciales no canceladas
  const counterSales = useMemo(() => {
    return (orders ?? []).filter(
      (o) => o.channel !== "whatsapp" && o.status !== "cancelado"
    );
  }, [orders]);

  // Fecha de hoy en Argentina (YYYY-MM-DD)
  const todayKey = useMemo(() => {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Argentina/Buenos_Aires",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }, []);

  // Ventas de hoy
  const todaySales = useMemo(() => {
    return counterSales.filter((o) => getArgentinaDateKey(o.created_at) === todayKey);
  }, [counterSales, todayKey]);

  // Ventas de la semana (últimos 7 días)
  const weekSales = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    return counterSales.filter((o) => new Date(o.created_at) >= cutoff);
  }, [counterSales]);

  // Ventas del mes calendario actual
  const monthSales = useMemo(() => {
    const monthPrefix = todayKey.slice(0, 7);
    return counterSales.filter((o) => getArgentinaDateKey(o.created_at).startsWith(monthPrefix));
  }, [counterSales, todayKey]);

  // Arqueo de caja en vivo
  const cajaResumen = useMemo(() => {
    let totalCaja = 0;
    let efectivo = 0;
    let digital = 0;
    let tarjetas = 0;

    for (const sale of todaySales) {
      const t = sale.total;
      totalCaja += t;
      const { method } = parsePaymentInfo(sale.notes);
      if (method === "efectivo") efectivo += t;
      else if (method === "transferencia") digital += t;
      else tarjetas += t;
    }

    return { totalCaja, efectivo, digital, tarjetas, count: todaySales.length };
  }, [todaySales]);

  // Agregar producto (o sumar +1 si ya está en la lista)
  const addProduct = (product: { id: string; name: string; price: number; stock: number; stock_disponible: number }) => {
    setLines((curr) => {
      const existingIdx = curr.findIndex((l) => l.product_id === product.id);
      if (existingIdx >= 0) {
        return curr.map((line, idx) =>
          idx === existingIdx
            ? { ...line, quantity: String((Number(line.quantity) || 0) + 1) }
            : line
        );
      }
      return [
        ...curr,
        {
          product_id: product.id,
          name: product.name,
          stock: product.stock_disponible,
          defaultPrice: product.price,
          quantity: "1",
          unit_price: "",
        },
      ];
    });
    setResult(null);
  };

  const updateLine = (index: number, patch: Partial<Line>) => {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  const incrementQty = (index: number, delta: number) => {
    setLines((current) =>
      current.map((line, i) => {
        if (i !== index) return line;
        const currentQty = Number(line.quantity) || 0;
        const next = currentQty + delta;
        return { ...line, quantity: String(Math.max(1, next)) };
      })
    );
  };

  const resetForm = () => {
    setLines([]);
    setNote("");
    setSearch("");
    setCashGiven("");
    setResult(null);
  };

  const save = async () => {
    if (lines.length === 0) {
      toast.error("Agregá al menos un producto");
      return;
    }
    const items = lines.map((line) => ({
      product_id: line.product_id,
      quantity: Number(line.quantity),
      ...(line.unit_price.trim() ? { unit_price: parseArNumber(line.unit_price) ?? NaN } : {}),
    }));

    if (
      items.some(
        (item) =>
          !Number.isInteger(item.quantity) ||
          item.quantity < 1 ||
          item.quantity > 999 ||
          (item.unit_price !== undefined &&
            (!Number.isFinite(item.unit_price) || item.unit_price < 0)),
      )
    ) {
      toast.error("Revisá las cantidades y los precios");
      return;
    }

    const paymentLabel =
      paymentMethod === "efectivo"
        ? "Efectivo"
        : paymentMethod === "transferencia"
        ? "Transferencia / QR"
        : paymentMethod === "debito"
        ? "Débito"
        : "Crédito";

    const paymentDetails = [
      `[Pago: ${paymentLabel}]`,
      paymentMethod === "efectivo" && cashGivenNum > 0
        ? `Pagó con: ${formatPrice(cashGivenNum)} (Vuelto: ${formatPrice(change)})`
        : null,
      note.trim() ? `Nota: ${note.trim()}` : null,
    ]
      .filter(Boolean)
      .join(" - ");

    setBusy(true);
    try {
      const saved = await createCounterSale(items, paymentDetails, allowNegative);

      // Sincronización instantánea en caliente sin tocar F5
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
        queryClient.invalidateQueries({ queryKey: ["staff-orders"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-products"] }),
        queryClient.invalidateQueries({ queryKey: ["staff-products"] }),
        queryClient.invalidateQueries({ queryKey: ["public-products"] }),
        queryClient.invalidateQueries({ queryKey: ["replenishment-suggestions"] }),
        queryClient.invalidateQueries({ queryKey: ["movements"] }),
      ]);

      setResult({
        number: saved.number,
        total: saved.total,
        change: paymentMethod === "efectivo" ? change : undefined,
      });

      // Limpiar formulario para el siguiente cliente
      setLines([]);
      setNote("");
      setSearch("");
      setCashGiven("");

      toast.success(`Venta #${saved.number} registrada exitosamente`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Venta Presencial"
        description="Punto de venta y caja de mostrador en vivo. Cada venta descuenta stock real al instante."
      />

      {/* ARQUEO DE CAJA DE HOY */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <span>Caja de Hoy (Total)</span>
              <Store className="h-4 w-4 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">
              {formatPrice(cajaResumen.totalCaja)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {cajaResumen.count} {cajaResumen.count === 1 ? "venta registrada" : "ventas registradas"} hoy
            </p>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
              <span>Efectivo en Cajón</span>
              <Banknote className="h-4 w-4 text-emerald-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-emerald-900 dark:text-emerald-300">
              {formatPrice(cajaResumen.efectivo)}
            </div>
            <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
              Plata física para el arqueo
            </p>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900/40 dark:bg-blue-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-blue-800 dark:text-blue-400">
              <span>Transferencia / QR</span>
              <QrCode className="h-4 w-4 text-blue-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-blue-900 dark:text-blue-300">
              {formatPrice(cajaResumen.digital)}
            </div>
            <p className="mt-1 text-xs text-blue-700 dark:text-blue-400">
              Mercado Pago y transferencias
            </p>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-purple-50/50 dark:border-purple-900/40 dark:bg-purple-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-purple-800 dark:text-purple-400">
              <span>Tarjetas</span>
              <CreditCard className="h-4 w-4 text-purple-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-purple-900 dark:text-purple-300">
              {formatPrice(cajaResumen.tarjetas)}
            </div>
            <p className="mt-1 text-xs text-purple-700 dark:text-purple-400">
              Débito y Crédito
            </p>
          </CardContent>
        </Card>
      </div>

      {/* AVISO DE VENTA REGISTRADA Y VUELTO */}
      {result && (
        <div
          role="status"
          className="flex flex-col gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            <div>
              <h2 className="font-semibold text-emerald-950 dark:text-emerald-100">
                ¡Venta #{result.number} registrada con éxito!
              </h2>
              <p className="text-sm text-emerald-900/80 dark:text-emerald-200/80">
                Total cobrado: <strong className="font-semibold">{formatPrice(result.total)}</strong>
                {result.change !== undefined && result.change > 0 && (
                  <span className="ml-2 rounded-md bg-emerald-600/20 px-2 py-0.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                    Vuelto a entregar: {formatPrice(result.change)}
                  </span>
                )}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setResult(null)}
            className="self-start sm:self-center"
          >
            Nueva Venta
          </Button>
        </div>
      )}

      {/* REGISTRO DE VENTA Y SELECCIÓN DE PRODUCTOS */}
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* COLUMNA IZQUIERDA: CARRITO Y COBRO */}
        <div className="space-y-4 rounded-xl border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between border-b pb-3">
            <h2 className="font-semibold text-base flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-primary" />
              Detalle de la Venta
            </h2>
            {lines.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetForm}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                <RotateCcw className="mr-1 h-3.5 w-3.5" />
                Vaciar lista
              </Button>
            )}
          </div>

          {/* LISTA DE LÍNEAS DEL CARRITO */}
          {lines.length === 0 ? (
            <div className="rounded-lg border border-dashed py-10 text-center">
              <ShoppingBag className="mx-auto h-8 w-8 text-muted-foreground/40" />
              <p className="mt-2 text-sm font-medium text-muted-foreground">
                El carrito está vacío
              </p>
              <p className="text-xs text-muted-foreground/80">
                Seleccioná productos de la derecha o usá el buscador.
              </p>
            </div>
          ) : (
            <div className="divide-y max-h-[380px] overflow-y-auto pr-1">
              {lines.map((line, index) => {
                const price = line.unit_price.trim()
                  ? (parseArNumber(line.unit_price) ?? 0)
                  : line.defaultPrice;
                const subtotal = (Number(line.quantity) || 0) * price;

                return (
                  <div key={line.product_id} className="py-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-sm">{line.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Stock disp.:{" "}
                          <span className={line.stock <= 5 ? "font-bold text-destructive" : ""}>
                            {line.stock}
                          </span>{" "}
                          · Base: {formatPrice(line.defaultPrice)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">{formatPrice(subtotal)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center border rounded-md">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-r-none"
                          onClick={() => incrementQty(index, -1)}
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                        <Input
                          aria-label={`Cantidad de ${line.name}`}
                          inputMode="numeric"
                          className="h-8 w-14 border-0 text-center text-sm font-medium focus-visible:ring-0"
                          value={line.quantity}
                          onChange={(e) => updateLine(index, { quantity: e.target.value })}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-l-none"
                          onClick={() => incrementQty(index, 1)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      <div className="flex-1">
                        <Input
                          aria-label={`Precio de ${line.name}`}
                          inputMode="decimal"
                          placeholder={formatPrice(line.defaultPrice)}
                          className="h-8 text-xs"
                          value={line.unit_price}
                          onChange={(e) => updateLine(index, { unit_price: e.target.value })}
                        />
                      </div>

                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        aria-label={`Quitar ${line.name}`}
                        onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* SELECCIÓN DE MEDIO DE PAGO */}
          <div className="space-y-3 rounded-lg border bg-muted/30 p-3 pt-3">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Medio de Pago
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Button
                type="button"
                variant={paymentMethod === "efectivo" ? "default" : "outline"}
                size="sm"
                className="justify-start gap-1.5 text-xs font-medium"
                onClick={() => setPaymentMethod("efectivo")}
              >
                <Banknote className="h-4 w-4" />
                Efectivo
              </Button>
              <Button
                type="button"
                variant={paymentMethod === "transferencia" ? "default" : "outline"}
                size="sm"
                className="justify-start gap-1.5 text-xs font-medium"
                onClick={() => setPaymentMethod("transferencia")}
              >
                <QrCode className="h-4 w-4" />
                Transf. / QR
              </Button>
              <Button
                type="button"
                variant={paymentMethod === "debito" ? "default" : "outline"}
                size="sm"
                className="justify-start gap-1.5 text-xs font-medium"
                onClick={() => setPaymentMethod("debito")}
              >
                <CreditCard className="h-4 w-4" />
                Débito
              </Button>
              <Button
                type="button"
                variant={paymentMethod === "credito" ? "default" : "outline"}
                size="sm"
                className="justify-start gap-1.5 text-xs font-medium"
                onClick={() => setPaymentMethod("credito")}
              >
                <CreditCard className="h-4 w-4" />
                Crédito
              </Button>
            </div>

            {/* CALCULADORA DE VUELTO SI ES EFECTIVO */}
            {paymentMethod === "efectivo" && total > 0 && (
              <div className="space-y-2 rounded-md border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-emerald-900 dark:text-emerald-300">
                    ¿Con cuánto paga el cliente?
                  </span>
                  <button
                    type="button"
                    className="font-semibold text-emerald-700 underline hover:text-emerald-800 dark:text-emerald-400"
                    onClick={() => setCashGiven(String(total))}
                  >
                    Monto exacto
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Monto recibido (ej: 5000)"
                    inputMode="numeric"
                    className="h-8 text-sm bg-background font-semibold"
                    value={cashGiven}
                    onChange={(e) => setCashGiven(e.target.value)}
                  />
                </div>

                {/* BOTONES DE BILLETES RÁPIDOS */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[1000, 2000, 5000, 10000, 20000].map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      className="rounded border border-emerald-300 bg-background px-2 py-0.5 text-xs font-medium text-emerald-800 transition-colors hover:bg-emerald-100 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
                      onClick={() => setCashGiven(String(amount))}
                    >
                      +{formatPrice(amount)}
                    </button>
                  ))}
                </div>

                {/* VUELTO DESTACADO */}
                {cashGivenNum > 0 && (
                  <div className="flex items-center justify-between border-t border-emerald-200 pt-2 dark:border-emerald-900/40">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-900 dark:text-emerald-300">
                      {cashGivenNum >= total ? "Vuelto a entregar:" : "Falta abonar:"}
                    </span>
                    <span
                      className={`text-lg font-black ${
                        cashGivenNum >= total
                          ? "text-emerald-700 dark:text-emerald-400"
                          : "text-destructive"
                      }`}
                    >
                      {cashGivenNum >= total
                        ? formatPrice(change)
                        : formatPrice(total - cashGivenNum)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* NOTA OPCIONAL */}
            <Input
              aria-label="Nota de la venta"
              maxLength={300}
              placeholder="Nota o detalle del cliente (opcional)"
              className="h-8 text-xs bg-background"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {/* TOTAL Y BOTÓN DE REGISTRO */}
          <div className="border-t pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Switch checked={allowNegative} onCheckedChange={setAllowNegative} />
                Permitir stock negativo
              </label>
              <div className="text-right">
                <span className="text-xs uppercase text-muted-foreground block">Total a Cobrar</span>
                <span className="text-2xl font-black text-primary">{formatPrice(total)}</span>
              </div>
            </div>

            <Button
              className="w-full text-base font-bold py-6 shadow-md"
              size="lg"
              disabled={busy || lines.length === 0}
              onClick={save}
            >
              {busy ? "Registrando venta…" : `Cobrar ${formatPrice(total)}`}
            </Button>
          </div>
        </div>

        {/* COLUMNA DERECHA: SELECTOR ÁGIL DE PRODUCTOS */}
        <div className="space-y-4 rounded-xl border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between border-b pb-3">
            <h2 className="font-semibold text-base flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              Catálogo Rápido
            </h2>
            <span className="text-xs text-muted-foreground">
              {matches.length} productos
            </span>
          </div>

          {/* BUSCADOR */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              aria-label="Buscar producto"
              placeholder="Buscar por nombre (ej: Mogul, Chupetín)…"
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

          {/* CHIPS DE CATEGORÍAS */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            <button
              type="button"
              className={`rounded-full px-3 py-1 font-medium transition-colors whitespace-nowrap ${
                selectedCategory === "todas"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
              onClick={() => setSelectedCategory("todas")}
            >
              Todas
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`rounded-full px-3 py-1 font-medium transition-colors whitespace-nowrap ${
                  selectedCategory === cat
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* GRILLA DE PRODUCTOS PARA AGREGAR CON UN CLIC */}
          <div className="grid grid-cols-1 gap-2 max-h-[460px] overflow-y-auto pr-1 sm:grid-cols-2">
            {matches.map((product) => (
              <button
                key={product.id}
                type="button"
                className="group flex flex-col justify-between rounded-lg border p-3 text-left transition-all hover:border-primary/50 hover:bg-muted/40 hover:shadow-xs active:scale-[0.98]"
                onClick={() => addProduct(product)}
              >
                <div className="min-w-0">
                  <p className="line-clamp-2 text-xs font-semibold leading-tight group-hover:text-primary">
                    {product.name}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Stock:{" "}
                    <span
                      className={`font-medium ${
                        product.stock_disponible <= 5
                          ? "text-destructive font-bold"
                          : "text-foreground"
                      }`}
                    >
                      {product.stock_disponible}
                    </span>
                  </p>
                </div>
                <div className="mt-2 flex items-center justify-between border-t pt-1.5">
                  <span className="text-xs font-black text-primary">
                    {formatPrice(product.price)}
                  </span>
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary group-hover:bg-primary group-hover:text-primary-foreground">
                    + Agregar
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* HISTORIAL DE VENTAS PRESENCIALES (HOY / ESTA SEMANA / ESTE MES) */}
      <section className="space-y-4 rounded-xl border bg-card p-5 shadow-xs">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border-b pb-3">
          <div>
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Historial de Ventas Presenciales
            </h2>
            <p className="text-xs text-muted-foreground">
              Control de tickets emitidos en mostrador y auditoría de medios de pago.
            </p>
          </div>
        </div>

        <Tabs defaultValue="hoy" className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="hoy" className="text-xs">
              Hoy ({todaySales.length})
            </TabsTrigger>
            <TabsTrigger value="semana" className="text-xs">
              Esta semana ({weekSales.length})
            </TabsTrigger>
            <TabsTrigger value="mes" className="text-xs">
              Este mes ({monthSales.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="hoy" className="mt-4">
            <SalesTable orders={todaySales} showDate={false} />
          </TabsContent>

          <TabsContent value="semana" className="mt-4">
            <SalesTable orders={weekSales} showDate={true} />
          </TabsContent>

          <TabsContent value="mes" className="mt-4">
            <SalesTable orders={monthSales} showDate={true} />
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}

function SalesTable({ orders, showDate }: { orders: PanelOrder[]; showDate: boolean }) {
  if (orders.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground border border-dashed rounded-lg">
        <Wallet className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
        No hay ventas presenciales registradas en este período.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-xs">
        <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] tracking-wider border-b">
          <tr>
            <th className="p-3">Venta</th>
            <th className="p-3">Horario</th>
            <th className="p-3">Medio de Pago</th>
            <th className="p-3">Productos</th>
            <th className="p-3 text-right">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {orders.map((order) => {
            const payment = parsePaymentInfo(order.notes);
            const itemsSummary = (order.items ?? [])
              .map((it) => `${it.quantity}x ${it.name}`)
              .join(", ");

            return (
              <tr key={order.id} className="hover:bg-muted/30 transition-colors">
                <td className="p-3 font-bold text-foreground">
                  #{order.number}
                </td>
                <td className="p-3 text-muted-foreground whitespace-nowrap">
                  {showDate ? formatDate(order.created_at) + " " : ""}
                  {getArgentinaTime(order.created_at)} hs
                </td>
                <td className="p-3 whitespace-nowrap">
                  <Badge variant="outline" className={`text-[10px] font-semibold ${payment.badgeClass}`}>
                    {payment.label}
                  </Badge>
                </td>
                <td className="p-3 max-w-md">
                  <p className="line-clamp-1 font-medium">{itemsSummary || "Venta mostrador"}</p>
                  {order.notes && (
                    <p className="line-clamp-1 text-[11px] text-muted-foreground">
                      {order.notes}
                    </p>
                  )}
                </td>
                <td className="p-3 text-right font-black text-sm text-primary whitespace-nowrap">
                  {formatPrice(order.total)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
