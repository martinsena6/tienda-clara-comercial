import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, DollarSign, Receipt, TrendingUp, Wallet } from "lucide-react";
import { StatCard } from "@/components/admin/StatCard";
import { argentinaRange, businessReportQuery, todayAR } from "@/lib/data";
import { formatPrice } from "@/lib/format";

type Period = "hoy" | "7d" | "mes" | "anterior";
function range(p: Period) {
  const t = todayAR();
  const [y, m] = t.split("-").map(Number) as [number, number];
  if (p === "hoy") return argentinaRange(t, t);
  if (p === "7d") return argentinaRange(todayAR(-6), t);
  if (p === "mes") return argentinaRange(`${t.slice(0, 7)}-01`, t);
  const py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1;
  const last = new Date(Date.UTC(py, pm, 0)).getUTCDate();
  const mm = String(pm).padStart(2, "0");
  return argentinaRange(`${py}-${mm}-01`, `${py}-${mm}-${last}`);
}

export function ReportPanel({ compact }: { compact?: boolean }) {
  const [p, setP] = useState<Period>(compact ? "hoy" : "mes");
  const r = range(p);
  const { data, isLoading } = useQuery(businessReportQuery(r.from, r.to));
  const labels: Record<Period, string> = { hoy: "Hoy", "7d": "7 días", mes: "Este mes", anterior: "Mes anterior" };
  const bruta = (data?.ventas ?? 0) - (data?.costo_mercaderia ?? 0);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(labels) as Period[]).map((k) => (
          <button key={k} onClick={() => setP(k)} className={`rounded-full border px-3 py-1 text-sm ${p === k ? "bg-primary text-primary-foreground" : "bg-card"}`}>{labels[k]}</button>
        ))}
      </div>
      {isLoading || !data ? <p className="text-sm text-muted-foreground">Cargando…</p> : (
        <>
          {(data.productos_sin_costo > 0 || data.pedidos_sin_costo > 0) && (
            <div className="flex items-center gap-2 rounded-lg border border-warning bg-warning/10 p-3 text-sm"><AlertTriangle className="size-4" /> La ganancia no es confiable: faltan costos.</div>
          )}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Ventas" value={formatPrice(data.ventas)} hint={`${data.pedidos} pedidos · ticket ${formatPrice(data.ticket_promedio)}`} icon={DollarSign} />
            <StatCard label="Ganancia bruta" value={formatPrice(bruta)} hint={`Costo mercadería ${formatPrice(data.costo_mercaderia)}`} icon={TrendingUp} />
            <StatCard label="Gastos" value={formatPrice(data.gastos)} icon={Wallet} />
            <StatCard label="Resultado neto" value={formatPrice(bruta - data.gastos)} hint={`${data.pendientes} pedidos pendientes`} icon={Receipt} />
          </div>
          {!compact && (
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-xl border bg-card p-5 text-sm"><h2 className="mb-2 font-semibold">Top 10 por unidades</h2>
                <ul className="divide-y">{data.top_unidades.map((t) => <li key={t.name} className="flex justify-between py-1.5"><span>{t.name}</span><span>{t.unidades} u.</span></li>)}</ul></section>
              <section className="rounded-xl border bg-card p-5 text-sm"><h2 className="mb-2 font-semibold">Top 10 por ganancia</h2>
                <ul className="divide-y">{data.top_ganancia.map((t) => <li key={t.name} className="flex justify-between py-1.5"><span>{t.name}</span><span>{formatPrice(t.ganancia)}</span></li>)}</ul></section>
              <section className="rounded-xl border bg-card p-5 text-sm"><h2 className="mb-2 font-semibold">Gastos por categoría</h2>
                <ul className="divide-y">{data.gastos_por_categoria.map((g) => <li key={g.category} className="flex justify-between py-1.5"><span>{g.category}</span><span>{formatPrice(g.total)}</span></li>)}</ul></section>
              <section className="rounded-xl border bg-card p-5 text-sm"><h2 className="mb-2 font-semibold">Inventario</h2>
                <p>A costo: {formatPrice(data.inventario_costo)}</p><p>A precio: {formatPrice(data.inventario_precio)}</p>
                <p>Sin movimiento en 60 días: {data.sin_movimiento_60d}</p><p>Productos sin costo: {data.productos_sin_costo}</p></section>
            </div>
          )}
        </>
      )}
    </div>
  );
}
