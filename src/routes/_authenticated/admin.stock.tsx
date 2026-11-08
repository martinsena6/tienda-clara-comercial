import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/admin/DataTable";
import { FormField } from "@/components/admin/FormField";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { AvailabilityBadge } from "@/components/shared/AvailabilityBadge";
import { getAvailability } from "@/lib/domain/catalog";
import {
  adjustStock,
  errorMessage,
  movementsQuery,
  suppliersQuery,
  todayAR,
  updateProductInternals,
  useMyRole,
  usePanelProducts,
  type PanelProduct,
} from "@/lib/data";
import { formatDate, movementLabel } from "@/lib/format";
import { stockMovementSchema } from "@/lib/validation";
import type { Column } from "@/components/admin/DataTable";

export const Route = createFileRoute("/_authenticated/admin/stock")({
  head: () => ({
    meta: [
      { title: "Stock — Panel Festiva" },
      { name: "description", content: "Existencias y registro de movimientos de stock." },
      { property: "og:title", content: "Stock — Panel Festiva" },
      { property: "og:description", content: "Existencias y movimientos." },
    ],
  }),
  component: Stock,
});

const tone = { entrada: "success", salida: "info", ajuste: "warning" } as const;

function Stock() {
  const qc = useQueryClient();
  const products = usePanelProducts().data;
  const { isAdmin } = useMyRole();
  const suppliersQueryState = useQuery({ ...suppliersQuery, enabled: isAdmin });
  const suppliers = suppliersQueryState.data ?? [];
  const movements = useQuery(movementsQuery).data ?? [];
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const setSupplier = async (product: PanelProduct, supplier: string) => {
    try {
      await updateProductInternals(product.id, { supplier });
      await qc.invalidateQueries({ queryKey: ["admin-products"] });
      await qc.invalidateQueries({ queryKey: ["staff-products"] });
      toast.success("Proveedor del producto actualizado");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const r = stockMovementSchema.safeParse(Object.fromEntries(new FormData(form)));
    if (!r.success) {
      setErrors(Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await adjustStock(r.data.product_id, r.data.type, r.data.quantity, r.data.reason ?? "");
      await qc.invalidateQueries();
      form.reset();
      toast.success("Movimiento registrado");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Stock y Vencimientos"
        description="El stock solo cambia mediante movimientos registrados. Revisá también las fechas de vencimiento."
      />
      <form
        onSubmit={submit}
        className="mb-6 grid gap-3 rounded-xl border bg-card p-4 shadow-soft sm:grid-cols-5 sm:items-end"
      >
        <FormField label="Producto" htmlFor="product_id" error={errors["product_id"]}>
          <select
            id="product_id"
            name="product_id"
            defaultValue=""
            className="h-9 w-full rounded-md border bg-card px-3 text-sm"
          >
            <option value="" disabled>
              Elegir…
            </option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Tipo" htmlFor="type">
          <select
            id="type"
            name="type"
            defaultValue="entrada"
            className="h-9 w-full rounded-md border bg-card px-3 text-sm"
          >
            <option value="entrada">Entrada (suma)</option>
            <option value="salida">Salida (resta)</option>
            <option value="ajuste">Corrección (+ o −)</option>
          </select>
        </FormField>
        <FormField label="Cantidad" htmlFor="quantity" error={errors["quantity"]}>
          <Input id="quantity" name="quantity" type="number" />
        </FormField>
        <FormField label="Motivo" htmlFor="reason">
          <Input id="reason" name="reason" placeholder="Ej: compra al proveedor" />
        </FormField>
        <Button type="submit" disabled={busy}>
          Registrar
        </Button>
      </form>
      <DataTable
        rows={products}
        getKey={(p) => p.id}
        columns={[
          { header: "Producto", cell: (p) => <span className="font-medium">{p.name}</span> },
          { header: "Unidades", cell: (p) => p.stock_disponible, className: "text-right" },
          {
            header: "Mínimo",
            cell: () => 7,
            className: "text-right",
            hideOnMobile: true,
          },
          ...(isAdmin
            ? [
                {
                  header: "Proveedor",
                  cell: (p: PanelProduct) => (
                    <select
                      aria-label={`Proveedor de ${p.name}`}
                      value={p.supplier ?? ""}
                      onChange={(event) => void setSupplier(p, event.target.value)}
                      className="h-9 min-w-40 rounded-md border bg-card px-2 text-sm"
                    >
                      <option value="">Sin proveedor</option>
                      {p.supplier &&
                        !suppliers.some((supplier) => supplier.name === p.supplier) && (
                          <option value={p.supplier}>{p.supplier} (actual)</option>
                        )}
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.name}>
                          {supplier.name}
                        </option>
                      ))}
                    </select>
                  ),
                  hideOnMobile: true,
                } satisfies Column<PanelProduct>,
              ]
            : []),
          {
            header: "Vencimiento",
            cell: (p) =>
              p.expiration_date ? (
                <span
                  className={p.expiration_date < todayAR() ? "font-medium text-destructive" : ""}
                >
                  {formatDate(p.expiration_date)}
                  {p.expiration_date < todayAR() ? " · Vencido" : ""}
                </span>
              ) : (
                <span className="text-muted-foreground">Sin fecha</span>
              ),
          },
          {
            header: "Estado",
            cell: (p) => (
              <AvailabilityBadge value={getAvailability(p.stock_disponible, p.min_stock)} />
            ),
          },
        ]}
      />
      {isAdmin && (
        <div className="mt-3 text-sm">
          {suppliersQueryState.error && (
            <p role="alert" className="mb-2 text-destructive">
              No se pudieron cargar los proveedores: {errorMessage(suppliersQueryState.error)}
            </p>
          )}
          <a href="/admin/compras" className="font-medium text-primary underline">
            Agregar proveedores y teléfonos de WhatsApp en Compras
          </a>
        </div>
      )}
      <h2 className="mb-3 mt-8 text-lg font-semibold">Movimientos recientes</h2>
      <DataTable
        rows={movements}
        getKey={(m) => m.id}
        columns={[
          {
            header: "Fecha",
            cell: (m) => formatDate(m.created_at),
            className: "whitespace-nowrap",
          },
          { header: "Producto", cell: (m) => m.productName },
          {
            header: "Tipo",
            cell: (m) => <StatusBadge tone={tone[m.type]}>{movementLabel[m.type]}</StatusBadge>,
          },
          {
            header: "Cantidad",
            cell: (m) =>
              m.type === "salida"
                ? `-${Math.abs(m.quantity)}`
                : m.quantity > 0
                  ? `+${m.quantity}`
                  : m.quantity,
            className: "text-right",
          },
          { header: "Motivo", cell: (m) => m.reason, hideOnMobile: true },
        ]}
      />
    </>
  );
}
