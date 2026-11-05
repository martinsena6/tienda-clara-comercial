import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/admin/DataTable";
import { PageHeader } from "@/components/admin/PageHeader";
import { RequireAdmin } from "@/components/admin/RequireAdmin";
import {
  adminProductsQuery,
  applyCosts,
  errorMessage,
  normalizeName,
  parseArNumber,
} from "@/lib/data";
import { formatPrice } from "@/lib/format";
import { requireAdminRoute } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/admin/costos")({
  beforeLoad: requireAdminRoute,
  head: () => ({
    meta: [
      { title: "Costos — Panel Festiva" },
      { name: "description", content: "Importar costos y proveedores desde la planilla." },
      { property: "og:title", content: "Costos — Panel Festiva" },
      { property: "og:description", content: "Importar costos desde Excel." },
    ],
  }),
  component: () => (
    <RequireAdmin>
      <Costos />
    </RequireAdmin>
  ),
});

interface Row {
  key: string;
  name: string;
  productId: string | null;
  cost: number | null;
  supplier: string | null;
  problem: string;
  warning: string;
  skipped: boolean;
  invalidCost: boolean;
}

function pick(r: Record<string, unknown>, starts: string) {
  const k = Object.keys(r).find((x) => normalizeName(x).startsWith(starts));
  return k ? r[k] : undefined;
}

function Costos() {
  const qc = useQueryClient();
  const products = useQuery(adminProductsQuery).data ?? [];
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const wb = XLSX.read(await f.arrayBuffer());
      const sh = wb.Sheets["Costos"] ?? wb.Sheets[wb.SheetNames[0]!];
      if (!sh) throw new Error("La planilla está vacía");
      const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sh, { defval: "" });
      const byExactName = new Map(products.map((p) => [p.name.trim(), p]));
      const byNormalizedName = new Map(products.map((p) => [normalizeName(p.name), p]));
      setRows(
        data
          .map((r, i) => {
            const name = String(pick(r, "producto") ?? "").trim();
            const costRaw = pick(r, "costo");
            const supRaw = String(pick(r, "proveedor") ?? "").trim();
            const emptyCost = String(costRaw ?? "").trim() === "";
            const cost = emptyCost ? null : parseArNumber(costRaw);
            const product = byExactName.get(name) ?? byNormalizedName.get(normalizeName(name));
            let problem = "";
            let warning = "";
            const skipped = emptyCost;
            const invalidCost = !emptyCost && (cost === null || !Number.isFinite(cost) || cost < 0);
            if (!product) problem = "Producto no encontrado";
            else if (invalidCost) problem = "Costo negativo o no numérico";
            else if (cost !== null && cost > product.price)
              warning = "El costo supera el precio de venta";
            return {
              key: `${i}`,
              name,
              productId: product?.id ?? null,
              cost,
              supplier: supRaw || null,
              problem,
              warning,
              skipped,
              invalidCost,
            };
          })
          .filter((r) => r.name),
      );
    } catch (err) {
      toast.error(errorMessage(err));
    }
    e.target.value = "";
  };

  const valid = rows.filter((r) => !r.problem && !r.skipped && r.productId && r.cost !== null);
  const unmatched = rows.filter((r) => !r.productId).length;
  const invalid = rows.filter((r) => r.invalidCost).length;
  const abovePrice = rows.filter((r) => !!r.warning).length;
  const matched = rows.filter((r) => !!r.productId).length;
  const apply = async () => {
    setBusy(true);
    try {
      const n = await applyCosts(
        valid.map((r) => ({ product_id: r.productId!, cost: r.cost, supplier: r.supplier })),
      );
      toast.success(`Se actualizaron ${n} productos`);
      setRows([]);
      await qc.invalidateQueries({ queryKey: ["admin-products"] });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const sinCosto = products.filter((p) => p.active && p.cost <= 0).length;
  return (
    <>
      <PageHeader
        title="Costos"
        description={`Subí la planilla festiva-costos.xlsx (hoja «Costos»). Productos activos sin costo: ${sinCosto}.`}
      />
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
        <input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} className="text-sm" />
        {rows.length > 0 && (
          <>
            <span className="text-sm text-muted-foreground">
              {matched} coincidencias · {unmatched} no encontrados · {invalid} valores inválidos ·{" "}
              {abovePrice} costos mayores al precio · {valid.length} listos para importar
            </span>
            <Button className="ml-auto" disabled={busy || valid.length === 0} onClick={apply}>
              Aplicar {valid.length} costos
            </Button>
          </>
        )}
      </div>
      {rows.length > 0 && (
        <DataTable
          rows={rows}
          getKey={(r) => r.key}
          columns={[
            { header: "Producto", cell: (r) => r.name },
            {
              header: "Costo",
              cell: (r) => (r.cost === null || Number.isNaN(r.cost) ? "—" : formatPrice(r.cost)),
              className: "text-right",
            },
            { header: "Proveedor", cell: (r) => r.supplier ?? "—", hideOnMobile: true },
            {
              header: "Estado",
              cell: (r) =>
                r.problem ? (
                  <span className="text-destructive">
                    {[
                      !r.productId ? r.problem : "",
                      r.invalidCost ? "Costo negativo o no numérico" : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                ) : r.skipped ? (
                  <span className="text-muted-foreground">Sin costo: no se importa</span>
                ) : r.warning ? (
                  <span className="text-warning">{r.warning}</span>
                ) : (
                  <span className="text-success">OK</span>
                ),
            },
          ]}
        />
      )}
    </>
  );
}
