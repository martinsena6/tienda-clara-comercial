import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Boxes,
  DollarSign,
  PackageSearch,
  ShoppingBag,
  Store,
  TrendingUp,
} from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { ReportPanel } from "@/components/admin/ReportPanel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { replenishmentQuery, usePanelOrders } from "@/lib/data";
import { formatPrice } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Panel Principal — Festiva" },
      { name: "description", content: "Métricas de ventas, canales y reposición." },
      { property: "og:title", content: "Panel Principal — Festiva" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data: orders, isLoading: loadingOrders } = usePanelOrders();
  const { data: replenishment = [], isLoading: loadingRep } = useQuery(replenishmentQuery);
  const [tab, setTab] = useState<"general" | "rentabilidad">("general");

  // Métricas de ventas presenciales vs online
  const metrics = useMemo(() => {
    let presencialesCount = 0;
    let presencialesTotal = 0;
    let onlineCount = 0;
    let onlineTotal = 0;
    let onlinePendientesCount = 0;

    const productSalesMap = new Map<
      string,
      { name: string; quantity: number; revenue: number }
    >();

    for (const order of orders) {
      const isPresencial = order.channel !== "whatsapp";

      if (isPresencial) {
        // En mostrador no hay estado pendiente, son ventas directas
        if (order.status !== "cancelado") {
          presencialesCount += 1;
          presencialesTotal += order.total;
        }
      } else {
        // Venta online
        if (order.status === "pendiente") {
          onlinePendientesCount += 1;
        } else if (order.status === "confirmado") {
          onlineCount += 1;
          onlineTotal += order.total;
        }
      }

      // Solo computamos productos de ventas efectivas (no canceladas ni pendientes)
      const isCompleted = isPresencial
        ? order.status !== "cancelado"
        : order.status === "confirmado";

      if (isCompleted && Array.isArray(order.items)) {
        for (const item of order.items) {
          const key = item.name || item.product_id || "Sin nombre";
          const current = productSalesMap.get(key) ?? {
            name: item.name || "Producto",
            quantity: 0,
            revenue: 0,
          };
          const qty = Number(item.quantity) || 0;
          const price = Number(item.unit_price) || 0;
          current.quantity += qty;
          current.revenue += qty * price;
          productSalesMap.set(key, current);
        }
      }
    }

    const allProducts = Array.from(productSalesMap.values());

    const topByQuantity = [...allProducts]
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    const topByRevenue = [...allProducts]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    return {
      presencialesCount,
      presencialesTotal,
      onlineCount,
      onlineTotal,
      onlinePendientesCount,
      facturacionTotal: presencialesTotal + onlineTotal,
      topByQuantity,
      topByRevenue,
    };
  }, [orders]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Panel Principal"
        description="Resumen de actividad comercial, canales de venta y control de stock."
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="general">Métricas Comerciales</TabsTrigger>
          <TabsTrigger value="rentabilidad">Rentabilidad y Costos</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6 space-y-6">
          {/* AVISO RÁPIDO DE PEDIDOS ONLINE PENDIENTES */}
          {metrics.onlinePendientesCount > 0 && (
            <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-warning/50 bg-warning/10 p-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-lg bg-warning text-warning-foreground">
                  <AlertCircle className="size-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">
                    {metrics.onlinePendientesCount}{" "}
                    {metrics.onlinePendientesCount === 1
                      ? "pedido online pendiente"
                      : "pedidos online pendientes"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Tenés pedidos esperando confirmación para descontar stock y coordinar entrega.
                  </p>
                </div>
              </div>
              <Button asChild size="sm" className="shrink-0 gap-2">
                <Link to="/admin/ventas">
                  Ver pedidos en espera <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          )}

          {/* TARJETAS DE CANALES Y FACTURACIÓN */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Venta Presencial</CardTitle>
                <Store className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatPrice(metrics.presencialesTotal)}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {metrics.presencialesCount}{" "}
                  {metrics.presencialesCount === 1 ? "venta registrada" : "ventas registradas"} en mostrador
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Venta Online</CardTitle>
                <ShoppingBag className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatPrice(metrics.onlineTotal)}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {metrics.onlineCount}{" "}
                  {metrics.onlineCount === 1 ? "pedido confirmado" : "pedidos confirmados"}
                </p>
              </CardContent>
            </Card>

            <Card className="border-primary/30 bg-primary/5">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Facturación Unificada</CardTitle>
                <DollarSign className="size-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">
                  {formatPrice(metrics.facturacionTotal)}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Total acumulado en ambos canales
                </p>
              </CardContent>
            </Card>
          </div>

          {/* TABLAS DE TOP 10 */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* TOP 10 MÁS VENDIDOS */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <TrendingUp className="size-4 text-primary" />
                  <CardTitle className="text-base">Top 10 Más Vendidos (Unidades)</CardTitle>
                </div>
                <CardDescription>
                  Productos con mayor rotación física en ambos canales
                </CardDescription>
              </CardHeader>
              <CardContent>
                {metrics.topByQuantity.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    {loadingOrders
                      ? "Cargando datos..."
                      : "Aún no hay ventas confirmadas para calcular el ranking."}
                  </p>
                ) : (
                  <div className="divide-y">
                    {metrics.topByQuantity.map((p, idx) => (
                      <div
                        key={p.name}
                        className="flex items-center justify-between py-2.5 text-sm"
                      >
                        <div className="flex items-center gap-2 truncate pr-2">
                          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold">
                            {idx + 1}
                          </span>
                          <span className="truncate font-medium">{p.name}</span>
                        </div>
                        <Badge variant="secondary" className="shrink-0 font-semibold">
                          {p.quantity} un.
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* TOP 10 MAYOR FACTURACIÓN */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <DollarSign className="size-4 text-primary" />
                  <CardTitle className="text-base">Top 10 Mayor Facturación (Dinero)</CardTitle>
                </div>
                <CardDescription>
                  Productos que aportaron más ingresos totales
                </CardDescription>
              </CardHeader>
              <CardContent>
                {metrics.topByRevenue.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    {loadingOrders
                      ? "Cargando datos..."
                      : "Aún no hay ventas confirmadas para calcular el ranking."}
                  </p>
                ) : (
                  <div className="divide-y">
                    {metrics.topByRevenue.map((p, idx) => (
                      <div
                        key={p.name}
                        className="flex items-center justify-between py-2.5 text-sm"
                      >
                        <div className="flex items-center gap-2 truncate pr-2">
                          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold">
                            {idx + 1}
                          </span>
                          <span className="truncate font-medium">{p.name}</span>
                        </div>
                        <span className="shrink-0 font-semibold text-primary">
                          {formatPrice(p.revenue)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* CUADRO DE PRODUCTOS A REPONER */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <PackageSearch className="size-4 text-destructive" />
                  <CardTitle className="text-base">Productos a Reponer (Stock Bajo)</CardTitle>
                </div>
                <CardDescription>
                  Artículos activos cuyo stock disponible igualó o cayó por debajo del mínimo
                </CardDescription>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to="/admin/reposicion">
                  Ver reposición completa <ArrowRight className="ml-1 size-3.5" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {loadingRep ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Consultando stock...
                </p>
              ) : replenishment.length === 0 ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <Boxes className="size-4 text-success" />
                  <span>Todos los artículos cuentan con stock por encima de su mínimo.</span>
                </div>
              ) : (
                <div className="divide-y">
                  {replenishment.slice(0, 10).map((item) => (
                    <div
                      key={item.product_id}
                      className="grid grid-cols-[1fr_auto_auto] items-center gap-4 py-2.5 text-sm"
                    >
                      <div className="truncate">
                        <p className="truncate font-medium">{item.name}</p>
                        {item.supplier && (
                          <p className="text-xs text-muted-foreground">
                            Proveedor: {item.supplier}
                          </p>
                        )}
                      </div>
                      <div className="text-right text-xs">
                        <span className="text-muted-foreground">Stock actual: </span>
                        <span className="font-semibold text-destructive">{item.stock}</span>
                        <span className="text-muted-foreground"> (Mín: {item.min_stock})</span>
                      </div>
                      <Badge variant="outline" className="border-warning text-warning">
                        Pedir {item.sugerido} un.
                      </Badge>
                    </div>
                  ))}
                  {replenishment.length > 10 && (
                    <p className="pt-3 text-center text-xs text-muted-foreground">
                      Hay {replenishment.length - 10} artículos más para reponer. Podés verlos en Reposición.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rentabilidad" className="mt-6">
          <ReportPanel compact />
        </TabsContent>
      </Tabs>
    </div>
  );
}
