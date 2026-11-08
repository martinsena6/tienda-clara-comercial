import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, DollarSign, Receipt, TrendingUp, Wallet } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/admin/StatCard";
import { argentinaRange, businessReportQuery, todayAR } from "@/lib/data";
import { formatPrice } from "@/lib/format";

type Period = "hoy" | "7d" | "mes" | "anterior" | "personalizado";
function range(p: Exclude<Period, "personalizado">) {
  const t = todayAR();
  const [y, m] = t.split("-").map(Number) as [number, number];
  if (p === "hoy") return argentinaRange(t, t);
  if (p === "7d") return argentinaRange(todayAR(-6), t);
  if (p === "mes") return argentinaRange(`${t.slice(0, 7)}-01`, t);
  const py = m === 1 ? y - 1 : y,
    pm = m === 1 ? 12 : m - 1;
  const last = new Date(Date.UTC(py, pm, 0)).getUTCDate();
  const mm = String(pm).padStart(2, "0");
  return argentinaRange(`${py}-${mm}-01`, `${py}-${mm}-${last}`);
}

export function ReportPanel({
  defaultPeriod = "mes",
  compact = false,
}: {
  defaultPeriod?: "hoy" | "mes";
  compact?: boolean;
}) {
  const [p, setP] = useState<Period>(defaultPeriod);
  const [customFrom, setCustomFrom] = useState(todayAR());
  const [customTo, setCustomTo] = useState(todayAR());
  const r =
    p === "personalizado"
      ? customFrom && customTo && customFrom <= customTo
        ? argentinaRange(customFrom, customTo)
        : null
      : range(p);
  const query = businessReportQuery(r?.from ?? "", r?.to ?? "");
  const { data, isLoading, isError, error } = useQuery({ ...query, enabled: !!r });
  const labels: Record<Period, string> = {
    hoy: "Hoy",
    "7d": "Últimos 7 días",
    mes: "Este mes",
    anterior: "Mes anterior",
    personalizado: "Personalizado",
  };
  const visiblePeriods: Period[] = compact
    ? ["mes", "anterior", "7d", "hoy"]
    : (Object.keys(labels) as Period[]);
  const bruta = (data?.ventas ?? 0) - (data?.costo_mercaderia ?? 0);
  const salesLabel =
    p === "mes"
      ? "Total vendido en el mes"
      : p === "anterior"
        ? "Total vendido el mes anterior"
        : p === "7d"
          ? "Total vendido en los últimos 7 días"
          : p === "hoy"
            ? "Total vendido hoy"
            : "Total vendido en el período";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {visiblePeriods.map((k) => (
          <button
            key={k}
            onClick={() => setP(k)}
            className={`rounded-full border px-3 py-1 text-sm ${p === k ? "bg-primary text-primary-foreground" : "bg-card"}`}
          >
            {labels[k]}
          </button>
        ))}
      </div>
      {p === "personalizado" && (
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm">
            Desde
            <Input
              aria-label="Fecha desde"
              type="date"
              value={customFrom}
              max={customTo || undefined}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
          </label>
          <label className="grid gap-1 text-sm">
            Hasta
            <Input
              aria-label="Fecha hasta"
              type="date"
              value={customTo}
              min={customFrom || undefined}
              onChange={(e) => setCustomTo(e.target.value)}
            />
          </label>
        </div>
      )}
      {!r ? (
        <p role="alert" className="text-sm text-destructive">
          Elegí un rango de fechas válido.
        </p>
      ) : isError ? (
        <p role="alert" className="text-sm text-destructive">
          {error instanceof Error ? error.message : "No se pudo cargar el reporte."}
        </p>
      ) : isLoading || !data ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <>
          {(data.productos_sin_costo > 0 || data.pedidos_sin_costo > 0) && (
            <div className="flex items-center gap-2 rounded-lg border border-warning bg-warning/10 p-3 text-sm">
              <AlertTriangle className="size-4" /> La ganancia no es confiable: faltan costos.
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
            <StatCard
              label={salesLabel}
              value={formatPrice(data.ventas)}
              hint={`${data.pedidos} pedidos · ticket ${formatPrice(data.ticket_promedio)}`}
              icon={DollarSign}
            />
            <StatCard
              label="Costo de mercadería"
              value={formatPrice(data.costo_mercaderia)}
              icon={Receipt}
            />
            <StatCard label="Ganancia bruta" value={formatPrice(bruta)} icon={TrendingUp} />
            <StatCard label="Gastos registrados" value={formatPrice(data.gastos)} icon={Wallet} />
            <StatCard
              label="Ganancia neta real"
              value={formatPrice(bruta - data.gastos)}
              icon={Receipt}
            />
          </div>
          {data.pendientes > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-warning bg-warning/10 p-3 text-sm">
              <AlertTriangle className="size-4" />
              Hay {data.pendientes} pedido{data.pendientes === 1 ? "" : "s"} pendiente
              {data.pendientes === 1 ? "" : "s"} de confirmación.
            </div>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border bg-card p-5 text-sm">
              <h2 className="mb-2 font-semibold">Los 5 productos más vendidos</h2>
              <ul className="divide-y">
                {data.top_unidades.slice(0, 5).map((t) => (
                  <li key={t.name} className="flex justify-between py-1.5">
                    <span>{t.name}</span>
                    <span>{t.unidades} u.</span>
                  </li>
                ))}
              </ul>
            </section>
            {!compact && (
              <>
                <section className="rounded-xl border bg-card p-5 text-sm">
                  <h2 className="mb-2 font-semibold">Top 10 por ganancia</h2>
                  <ul className="divide-y">
                    {data.top_ganancia.map((t) => (
                      <li key={t.name} className="flex justify-between py-1.5">
                        <span>{t.name}</span>
                        <span>{formatPrice(t.ganancia)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
                <section className="rounded-xl border bg-card p-5 text-sm">
                  <h2 className="mb-2 font-semibold">Gastos por categoría</h2>
                  <ul className="divide-y">
                    {data.gastos_por_categoria.map((g) => (
                      <li key={g.category} className="flex justify-between py-1.5">
                        <span>{g.category}</span>
                        <span>{formatPrice(g.total)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
                <section className="rounded-xl border bg-card p-5 text-sm lg:col-span-2">
                  <h2 className="mb-3 font-semibold">Ventas por día</h2>
                  {data.por_dia.length === 0 ? (
                    <p className="text-muted-foreground">
                      No hay ventas confirmadas en este período.
                    </p>
                  ) : (
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={data.por_dia}
                          margin={{ top: 8, right: 12, bottom: 4, left: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis
                            dataKey="dia"
                            tickFormatter={(value: string) => value.slice(5)}
                            tick={{ fontSize: 12 }}
                          />
                          <YAxis
                            tick={{ fontSize: 12 }}
                            tickFormatter={(value: number) => formatPrice(value)}
                            width={88}
                          />
                          <Tooltip
                            formatter={(value) => formatPrice(Number(value ?? 0))}
                            labelFormatter={(value) => `Día ${String(value)}`}
                          />
                          <Bar
                            dataKey="ventas"
                            name="Ventas"
                            fill="hsl(var(--primary))"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </section>
                <section className="rounded-xl border bg-card p-5 text-sm">
                  <h2 className="mb-2 font-semibold">Inventario</h2>
                  <p>A costo: {formatPrice(data.inventario_costo)}</p>
                  <p>A precio: {formatPrice(data.inventario_precio)}</p>
                  <p>Sin movimiento en 60 días: {data.sin_movimiento_60d}</p>
                  <p>Productos sin costo: {data.productos_sin_costo}</p>
                </section>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
