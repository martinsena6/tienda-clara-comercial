import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { DataTable } from "@/components/admin/DataTable";
import { PageHeader } from "@/components/admin/PageHeader";
import { RequireAdmin } from "@/components/admin/RequireAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  adminProductsQuery,
  applyCosts,
  applyPriceChanges,
  categoriesQuery,
  errorMessage,
  normalizeName,
  parseArNumber,
  priceHistoryQuery,
  undoPriceBatch,
  type AdminProduct,
} from "@/lib/data";
import { requireAdminRoute } from "@/lib/auth";
import { formatDateTime, formatPrice } from "@/lib/format";
import { marginPct } from "@/lib/domain/catalog";

const EMPTY_PRODUCTS: AdminProduct[] = [];

type Mode = "increase" | "decrease" | "margin" | "round";

interface ImportRow {
  key: string;
  name: string;
  product: AdminProduct | null;
  cost: number | null;
  problem: string;
}

export const Route = createFileRoute("/_authenticated/admin/precios")({
  beforeLoad: requireAdminRoute,
  head: () => ({
    meta: [{ title: "Precios — Panel Festiva" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <RequireAdmin>
      <Precios />
    </RequireAdmin>
  ),
});

function roundToStep(value: number, step: number) {
  return step <= 0 ? Math.round(value * 100) / 100 : Math.round(value / step) * step;
}

function field(row: Record<string, unknown>, key: string) {
  const normalized = normalizeName(key);
  const matched = Object.keys(row).find((header) => normalizeName(header) === normalized);
  return matched ? row[matched] : undefined;
}

function Precios() {
  const queryClient = useQueryClient();
  const productsQuery = useQuery(adminProductsQuery);
  const categoriesResult = useQuery(categoriesQuery);
  const products = productsQuery.data ?? EMPTY_PRODUCTS;
  const categories = categoriesResult.data ?? [];
  const historyQuery = useQuery(priceHistoryQuery);
  const [category, setCategory] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [mode, setMode] = useState<Mode>("increase");
  const [amount, setAmount] = useState("10");
  const [step, setStep] = useState("50");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [keepMargin, setKeepMargin] = useState(true);

  const visibleProducts = useMemo(
    () => products.filter((product) => !category || product.category_id === category),
    [products, category],
  );
  const selectedProducts = products.filter((product) => selected.includes(product.id));
  const parsedStep = parseArNumber(step);
  const stepValue = parsedStep ?? 50;
  const validStep = parsedStep !== null && Number.isFinite(parsedStep) && parsedStep >= 0;
  const parsedPercentage = parseArNumber(amount);
  const percentage = parsedPercentage ?? 0;
  const validPercentage =
    mode === "round" ||
    (parsedPercentage !== null &&
      Number.isFinite(parsedPercentage) &&
      parsedPercentage >= 0 &&
      (mode !== "decrease" || parsedPercentage <= 100));

  const preview = useMemo(
    () =>
      selectedProducts.flatMap((product) => {
        if (mode === "margin" && product.cost <= 0) return [];
        const raw =
          mode === "increase"
            ? product.price * (1 + percentage / 100)
            : mode === "decrease"
              ? product.price * (1 - percentage / 100)
              : mode === "margin"
                ? product.cost * (1 + percentage / 100)
                : product.price;
        const newPrice = roundToStep(raw, stepValue);
        return [
          {
            product,
            newPrice,
            variation:
              product.price === 0 ? null : ((newPrice - product.price) / product.price) * 100,
            margin: product.cost > 0 ? marginPct(newPrice, product.cost) : null,
          },
        ];
      }),
    [selectedProducts, mode, percentage, stepValue],
  );

  const groupedHistory = useMemo(() => {
    const groups = new Map<
      string,
      { batchId: string; changedAt: string; reason: string; count: number }
    >();
    for (const row of historyQuery.data ?? []) {
      if (!row.batch_id) continue;
      const current = groups.get(row.batch_id);
      if (current) current.count += 1;
      else
        groups.set(row.batch_id, {
          batchId: row.batch_id,
          changedAt: row.changed_at,
          reason: row.reason,
          count: 1,
        });
    }
    return [...groups.values()].sort((a, b) => b.changedAt.localeCompare(a.changedAt));
  }, [historyQuery.data]);

  const toggleProduct = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );

  const apply = async () => {
    const changes = preview
      .filter(({ product, newPrice }) => product.price !== newPrice)
      .map(({ product, newPrice }) => ({ product_id: product.id, new_price: newPrice }));
    if (!changes.length) {
      toast.error("No hay cambios para aplicar");
      return;
    }
    setBusy(true);
    try {
      const batches = await applyPriceChanges(changes, reason.trim());
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-products"] }),
        queryClient.invalidateQueries({ queryKey: ["price-history"] }),
        queryClient.invalidateQueries({ queryKey: ["public-products"] }),
      ]);
      setSelected([]);
      toast.success(
        `${changes.length} precios actualizados en ${batches.length} lote${batches.length === 1 ? "" : "s"}`,
      );
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const undoLatest = async () => {
    const latest = groupedHistory[0];
    if (!latest) return;
    setBusy(true);
    try {
      const count = await undoPriceBatch(latest.batchId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-products"] }),
        queryClient.invalidateQueries({ queryKey: ["price-history"] }),
        queryClient.invalidateQueries({ queryKey: ["public-products"] }),
      ]);
      toast.success(`Se deshicieron ${count} precios del último ajuste`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const workbook = XLSX.read(await file.arrayBuffer());
      const sheet = workbook.Sheets[workbook.SheetNames[0] ?? ""];
      if (!sheet) throw new Error("El archivo está vacío");
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const seenProducts = new Set<string>();
      setImportRows(
        rows
          .map((row, index) => {
            const name = String(field(row, "nombre") ?? "").trim();
            const cost = parseArNumber(field(row, "costo nuevo"));
            const product =
              products.find((candidate) => normalizeName(candidate.name) === normalizeName(name)) ??
              null;
            const duplicate = Boolean(product && seenProducts.has(product.id));
            if (product) seenProducts.add(product.id);
            const problem = !name
              ? "Falta el nombre"
              : !product
                ? "Producto no encontrado"
                : duplicate
                  ? "Producto repetido en el archivo"
                  : cost === null || !Number.isFinite(cost) || cost < 0
                    ? "Costo nuevo inválido"
                    : "";
            return { key: String(index), name, product, cost, problem };
          })
          .filter((row) => row.name),
      );
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      event.target.value = "";
    }
  };

  const validImport = importRows.filter((row) => !row.problem && row.product && row.cost !== null);
  const importPrice = (row: ImportRow): number | null =>
    keepMargin && row.product && row.cost !== null && row.product.cost > 0
      ? roundToStep(row.cost * (row.product.price / row.product.cost), stepValue)
      : null;
  const applyImport = async () => {
    setBusy(true);
    let updatedCostCount = 0;
    try {
      for (let offset = 0; offset < validImport.length; offset += 500) {
        const chunk = validImport.slice(offset, offset + 500);
        updatedCostCount += await applyCosts(
          chunk.map((row) => ({
            product_id: row.product!.id,
            cost: row.cost,
            supplier: null,
          })),
        );
      }
      const changes = validImport
        .map((row) => ({ row, newPrice: importPrice(row) }))
        .filter(({ row, newPrice }) => newPrice !== null && row.product!.price !== newPrice)
        .map(({ row, newPrice }) => ({ product_id: row.product!.id, new_price: newPrice! }));
      if (changes.length) {
        try {
          await applyPriceChanges(changes, "Importación de costo con margen mantenido");
        } catch (error) {
          await queryClient.invalidateQueries();
          toast.error(
            `Se actualizaron ${updatedCostCount} costos, pero no se pudieron ajustar todos los precios: ${errorMessage(error)}`,
          );
          return;
        }
      }
      await queryClient.invalidateQueries();
      toast.success(
        `Costos actualizados: ${updatedCostCount}${changes.length ? ` · precios ajustados: ${changes.length}` : ""}`,
      );
      setImportRows([]);
    } catch (error) {
      await queryClient.invalidateQueries();
      toast.error(
        updatedCostCount
          ? `Se actualizaron ${updatedCostCount} costos antes del error: ${errorMessage(error)}`
          : errorMessage(error),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Precios"
        description="Ajustes por categoría o producto, con vista previa y registro de cambios."
      />
      {productsQuery.error && (
        <p role="alert" className="mb-3 text-sm text-destructive">
          {errorMessage(productsQuery.error)}
        </p>
      )}
      {categoriesResult.error && (
        <p role="alert" className="mb-3 text-sm text-destructive">
          {errorMessage(categoriesResult.error)}
        </p>
      )}
      <section className="space-y-4 rounded-xl border bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="grid gap-1 text-sm">
            Categoría
            <select
              className="h-9 rounded-md border bg-background px-2"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option value="">Todas</option>
              {categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Modo
            <select
              className="h-9 rounded-md border bg-background px-2"
              value={mode}
              onChange={(event) => setMode(event.target.value as Mode)}
            >
              <option value="increase">Subir porcentaje</option>
              <option value="decrease">Bajar porcentaje</option>
              <option value="margin">Margen objetivo sobre costo</option>
              <option value="round">Redondear precios seleccionados</option>
            </select>
          </label>
          {mode !== "round" && (
            <label className="grid gap-1 text-sm">
              {mode === "margin" ? "Margen objetivo (%)" : "Porcentaje (%)"}
              <Input
                type="number"
                min={0}
                max={mode === "decrease" ? 100 : undefined}
                step="0.1"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </label>
          )}
          <label className="grid gap-1 text-sm">
            Múltiplo de redondeo
            <Input
              type="number"
              min={0}
              step="1"
              value={step}
              onChange={(event) => setStep(event.target.value)}
            />
          </label>
        </div>
        {!validStep && (
          <p role="alert" className="text-sm text-destructive">
            El múltiplo de redondeo debe ser un número mayor o igual a cero.
          </p>
        )}
        {!validPercentage && (
          <p role="alert" className="text-sm text-destructive">
            {mode === "decrease"
              ? "El porcentaje de baja debe estar entre 0 y 100."
              : "Ingresá un porcentaje válido, mayor o igual a cero."}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              setSelected((current) => [
                ...new Set([...current, ...visibleProducts.map((product) => product.id)]),
              ])
            }
          >
            Seleccionar visibles
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setSelected([])}>
            Limpiar selección
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setSelected(products.map((product) => product.id));
              setMode("round");
              setStep("50");
            }}
          >
            Redondear todos los precios actuales a múltiplos de 50
          </Button>
          <span className="self-center text-sm text-muted-foreground">
            {selected.length} seleccionados · {preview.length} en vista previa
          </span>
        </div>
        <div className="max-h-56 overflow-auto rounded-md border">
          {visibleProducts.map((product) => (
            <label
              key={product.id}
              className="flex items-center gap-2 border-b px-3 py-2 text-sm last:border-0"
            >
              <input
                type="checkbox"
                checked={selected.includes(product.id)}
                onChange={() => toggleProduct(product.id)}
              />
              <span className="min-w-0 flex-1 truncate">{product.name}</span>
              <span className="text-muted-foreground">{formatPrice(product.price)}</span>
            </label>
          ))}
        </div>
        {mode === "margin" && selectedProducts.some((product) => product.cost <= 0) && (
          <p className="text-sm text-warning">Se omiten los productos sin costo cargado.</p>
        )}
        <label className="grid gap-1 text-sm">
          Motivo del ajuste
          <Input
            maxLength={200}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ej. Actualización semanal de precios"
          />
        </label>
        <DataTable
          rows={preview}
          getKey={(row) => row.product.id}
          empty={
            <p className="p-3 text-sm text-muted-foreground">
              Elegí productos para ver los cambios antes de aplicarlos.
            </p>
          }
          columns={[
            { header: "Producto", cell: (row) => row.product.name },
            {
              header: "Actual",
              cell: (row) => formatPrice(row.product.price),
              className: "text-right whitespace-nowrap",
            },
            {
              header: "Nuevo",
              cell: (row) => (
                <span
                  className={
                    row.newPrice < row.product.cost && row.product.cost > 0
                      ? "text-destructive"
                      : ""
                  }
                >
                  {formatPrice(row.newPrice)}
                  {row.newPrice < row.product.cost && row.product.cost > 0 ? " · bajo costo" : ""}
                </span>
              ),
              className: "text-right whitespace-nowrap",
            },
            {
              header: "Variación",
              cell: (row) =>
                row.variation === null ? (
                  "—"
                ) : (
                  <span className={Math.abs(row.variation) > 30 ? "text-warning" : ""}>
                    {row.variation.toFixed(1)}%{Math.abs(row.variation) > 30 ? " · supera 30%" : ""}
                  </span>
                ),
              className: "text-right whitespace-nowrap",
            },
            {
              header: "Margen nuevo",
              cell: (row) => (row.margin === null ? "" : `${row.margin}%`),
              className: "text-right",
            },
          ]}
        />
        <Button
          onClick={apply}
          disabled={busy || !validStep || !validPercentage || preview.length === 0}
        >
          {busy
            ? "Aplicando…"
            : `Aplicar ${preview.filter((row) => row.product.price !== row.newPrice).length} cambios`}
        </Button>
      </section>

      <section className="mt-8 space-y-4 rounded-xl border bg-card p-4">
        <div>
          <h2 className="font-semibold">Importar lista del proveedor</h2>
          <p className="text-sm text-muted-foreground">
            Excel o CSV con columnas «Nombre» y «Costo nuevo». Se reconocen números argentinos.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Input type="file" accept=".xlsx,.xls,.csv" onChange={importFile} className="max-w-sm" />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={keepMargin}
              onChange={(event) => setKeepMargin(event.target.checked)}
            />{" "}
            Mantener mi margen
          </label>
          <span className="text-sm text-muted-foreground">{validImport.length} filas listas</span>
          <Button
            disabled={busy || validImport.length === 0 || (keepMargin && !validStep)}
            onClick={applyImport}
          >
            Actualizar costos y precios
          </Button>
        </div>
        {importRows.length > 0 && (
          <DataTable
            rows={importRows}
            getKey={(row) => row.key}
            columns={[
              { header: "Producto", cell: (row) => row.name },
              {
                header: "Costo nuevo",
                cell: (row) => (row.cost === null ? "—" : formatPrice(row.cost)),
                className: "text-right",
              },
              {
                header: "Precio actual",
                cell: (row) => (row.product ? formatPrice(row.product.price) : "—"),
                className: "text-right",
              },
              {
                header: "Precio con margen",
                cell: (row) => {
                  const nextPrice = importPrice(row);
                  return nextPrice === null ? "No se cambia" : formatPrice(nextPrice);
                },
                className: "text-right",
              },
              {
                header: "Estado",
                cell: (row) =>
                  row.problem ||
                  (keepMargin && row.product?.cost === 0
                    ? "Sin costo anterior: solo se actualizará el costo"
                    : "Listo"),
              },
            ]}
          />
        )}
      </section>

      <section className="mt-8 space-y-3 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Historial de ajustes</h2>
            <p className="text-sm text-muted-foreground">
              Lotes recientes registrados por el sistema.
            </p>
          </div>
          <Button variant="outline" disabled={busy || !groupedHistory.length} onClick={undoLatest}>
            Deshacer último ajuste
          </Button>
        </div>
        {historyQuery.error && (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage(historyQuery.error)}
          </p>
        )}
        <DataTable
          rows={groupedHistory}
          getKey={(row) => row.batchId}
          empty={
            <p className="p-3 text-sm text-muted-foreground">Todavía no hay lotes de ajuste.</p>
          }
          columns={[
            { header: "Fecha", cell: (row) => formatDateTime(row.changedAt) },
            { header: "Motivo", cell: (row) => row.reason || "—" },
            { header: "Productos", cell: (row) => row.count, className: "text-right" },
          ]}
        />
      </section>
    </>
  );
}
