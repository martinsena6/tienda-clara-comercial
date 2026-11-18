import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { MessageCircle, Pencil, Plus, Trash2, Unlink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/admin/DataTable";
import { PageHeader } from "@/components/admin/PageHeader";
import { RequireAdmin } from "@/components/admin/RequireAdmin";
import {
  adminProductsQuery,
  deleteSupplier,
  errorMessage,
  normalizeName,
  parseArNumber,
  purchaseItemsQuery,
  purchasesQuery,
  registerPurchase,
  saveSupplier,
  suppliersQuery,
  todayAR,
  updateProductInternals,
  updateProductsSupplier,
  type AdminProduct,
} from "@/lib/data";
import { formatDate, formatPrice } from "@/lib/format";
import { requireAdminRoute } from "@/lib/auth";
import { arWhatsAppPhone, buildWhatsAppUrl } from "@/lib/whatsapp";

export const Route = createFileRoute("/_authenticated/admin/compras")({
  validateSearch: (search: Record<string, unknown>) => ({
    ...(typeof search["proveedor"] === "string" ? { proveedor: search["proveedor"] } : {}),
    ...(typeof search["items"] === "string" ? { items: search["items"] } : {}),
  }),
  beforeLoad: requireAdminRoute,
  head: () => ({
    meta: [
      { title: "Compras — Panel Festiva" },
      { name: "description", content: "Compras a proveedores." },
      { property: "og:title", content: "Compras — Panel Festiva" },
      { property: "og:description", content: "Compras a proveedores." },
    ],
  }),
  component: () => (
    <RequireAdmin>
      <Compras />
    </RequireAdmin>
  ),
});

interface Line {
  product_id: string;
  name: string;
  quantity: string;
  unit_cost: string;
}

const EMPTY_PRODUCTS: AdminProduct[] = [];
const EMPTY_SUPPLIERS: Awaited<ReturnType<typeof suppliersQuery.queryFn & {}>> = [];

function Compras() {
  const qc = useQueryClient();
  const navigate = useNavigate({ from: "/admin/compras" });
  const prefill = Route.useSearch();
  const purchasesResult = useQuery(purchasesQuery);
  const rows = purchasesResult.data ?? [];
  const suppliersResult = useQuery(suppliersQuery);
  const productsResult = useQuery(adminProductsQuery);
  const suppliers = suppliersResult.data ?? EMPTY_SUPPLIERS;
  const products = productsResult.data ?? EMPTY_PRODUCTS;
  const [open, setOpen] = useState<string | null>(null);
  const [date, setDate] = useState(todayAR());
  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [updateCost, setUpdateCost] = useState(true);
  const [supplierDraft, setSupplierDraft] = useState<{
    id?: string;
    name: string;
    phone: string;
    notes: string;
  } | null>(null);
  const [search, setSearch] = useState("");
  const [assignmentSearch, setAssignmentSearch] = useState("");
  const [orderQuantities, setOrderQuantities] = useState<Record<string, string>>({});
  const [orderCosts, setOrderCosts] = useState<Record<string, string>>({});
  const [lines, setLines] = useState<Line[]>([]);
  const [busy, setBusy] = useState(false);
  const appliedPrefill = useRef<string | null>(null);

  useEffect(() => {
    if (!prefill.items || productsResult.isLoading || suppliersResult.isLoading) return;
    if (appliedPrefill.current === prefill.items) return;
    appliedPrefill.current = prefill.items;
    try {
      const parsed: unknown = JSON.parse(prefill.items);
      if (!Array.isArray(parsed)) throw new Error("Los productos preseleccionados no son válidos");
      const nextLines = parsed.flatMap((item): Line[] => {
        if (!item || typeof item !== "object") return [];
        const row = item as Record<string, unknown>;
        if (
          typeof row["product_id"] !== "string" ||
          typeof row["quantity"] !== "number" ||
          !Number.isInteger(row["quantity"]) ||
          row["quantity"] <= 0
        )
          return [];
        const product = products.find((candidate) => candidate.id === row["product_id"]);
        return product
          ? [
              {
                product_id: product.id,
                name: product.name,
                quantity: String(row["quantity"]),
                unit_cost: product.cost > 0 ? String(product.cost) : "",
              },
            ]
          : [];
      });
      if (nextLines.length === 0)
        throw new Error("No se encontraron productos válidos para la compra");
      setLines(nextLines);
      const supplier = suppliers.find(
        (candidate) => normalizeName(candidate.name) === normalizeName(prefill.proveedor ?? ""),
      );
      setSupplierId(supplier?.id ?? "");
      setNotes("Pedido de reposición");
      toast.success(`${nextLines.length} productos cargados en Nueva compra`);
      void navigate({ search: {} });
    } catch (error) {
      toast.error(errorMessage(error));
      void navigate({ search: {} });
    }
  }, [
    prefill.items,
    prefill.proveedor,
    products,
    productsResult.isLoading,
    suppliers,
    suppliersResult.isLoading,
    navigate,
  ]);

  const selectedSupplier = suppliers.find((supplier) => supplier.id === supplierId);
  const assignedProducts = useMemo(() => {
    if (!selectedSupplier) return [];
    return products
      .filter(
        (product) => normalizeName(product.supplier ?? "") === normalizeName(selectedSupplier.name),
      )
      .sort(
        (a, b) =>
          Number(a.stock_disponible > a.min_stock) - Number(b.stock_disponible > b.min_stock) ||
          a.name.localeCompare(b.name, "es"),
      );
  }, [products, selectedSupplier]);
  const assignmentMatches = useMemo(() => {
    const query = normalizeName(assignmentSearch);
    if (query.length < 2) return [];
    return products
      .filter(
        (product) =>
          normalizeName(product.name).includes(query) &&
          normalizeName(product.supplier ?? "") !== normalizeName(selectedSupplier?.name ?? ""),
      )
      .slice(0, 8);
  }, [assignmentSearch, products, selectedSupplier]);

  const matches = useMemo(() => {
    const q = normalizeName(search);
    if (q.length < 2) return [];
    return products
      .filter((p) => normalizeName(p.name).includes(q) && !lines.some((l) => l.product_id === p.id))
      .slice(0, 8);
  }, [search, products, lines]);

  const total = lines.reduce(
    (s, l) => s + (Number(l.quantity) || 0) * (parseArNumber(l.unit_cost) || 0),
    0,
  );
  const setLine = (i: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const providerLines = assignedProducts.flatMap((product): Line[] => {
    const quantity = Number(
      orderQuantities[product.id] ?? Math.max(0, product.min_stock - product.stock_disponible),
    );
    if (!Number.isInteger(quantity) || quantity <= 0) return [];
    return [
      {
        product_id: product.id,
        name: product.name,
        quantity: String(quantity),
        unit_cost: orderCosts[product.id] ?? String(product.cost ?? 0),
      },
    ];
  });
  const providerTotal = providerLines.reduce(
    (sum, line) => sum + Number(line.quantity) * (parseArNumber(line.unit_cost) ?? 0),
    0,
  );
  const supplierPhone = selectedSupplier?.phone ? arWhatsAppPhone(selectedSupplier.phone) : "";
  const whatsappLines = providerLines.map((line) => `• ${line.quantity} x ${line.name}`);
  const whatsappMessage = [
    `Hola ${selectedSupplier?.name ?? ""}, te paso el pedido de Festiva:`,
    "",
    ...whatsappLines,
  ].join("\n");
  const validSupplierPhone = /^\d{11,15}$/.test(supplierPhone) ? supplierPhone : "";

  const assignProduct = async (product: AdminProduct) => {
    if (!selectedSupplier) return;
    try {
      await updateProductInternals(product.id, { supplier: selectedSupplier.name });
      setAssignmentSearch("");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin-products"] }),
        qc.invalidateQueries({ queryKey: ["replenishment-suggestions"] }),
      ]);
      toast.success(`${product.name} asignado a ${selectedSupplier.name}`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };
  const unlinkProduct = async (product: AdminProduct) => {
    try {
      await updateProductInternals(product.id, { supplier: "" });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin-products"] }),
        qc.invalidateQueries({ queryKey: ["replenishment-suggestions"] }),
      ]);
      toast.success(`${product.name} desvinculado del proveedor`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const save = async (
    purchaseLines = lines,
    purchaseSupplierId = supplierId,
    purchaseNotes = notes,
  ) => {
    const items = purchaseLines.map((l) => ({
      product_id: l.product_id,
      quantity: Math.trunc(Number(l.quantity)),
      unit_cost: parseArNumber(l.unit_cost) ?? NaN,
    }));
    if (items.length === 0) {
      toast.error("Agregá al menos un producto");
      return;
    }
    if (items.some((i) => !(i.quantity > 0) || !(i.unit_cost >= 0))) {
      toast.error("Revisá cantidades y costos");
      return;
    }
    setBusy(true);
    try {
      const r = await registerPurchase({
        date,
        supplier_id: purchaseSupplierId || null,
        notes: purchaseNotes,
        items,
        update_cost: updateCost,
      });
      toast.success(`Compra #${r?.purchase_number ?? ""} registrada; el stock se sumó.`);
      if (purchaseLines === lines) {
        setLines([]);
        setNotes("");
      } else {
        setOrderQuantities({});
      }
      await Promise.all(
        [
          "purchases",
          "admin-products",
          "products",
          "staff-products",
          "movements",
          "replenishment-suggestions",
        ].map((k) => qc.invalidateQueries({ queryKey: [k] })),
      );
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const saveSupplierForm = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!supplierDraft?.name.trim()) {
      toast.error("Ingresá el nombre del proveedor");
      return;
    }
    const previousSupplier = supplierDraft.id
      ? suppliers.find((supplier) => supplier.id === supplierDraft.id)
      : undefined;
    const renamedProductIds =
      previousSupplier && normalizeName(previousSupplier.name) !== normalizeName(supplierDraft.name)
        ? products
            .filter(
              (product) =>
                normalizeName(product.supplier ?? "") === normalizeName(previousSupplier.name),
            )
            .map((product) => product.id)
        : [];
    let supplierSaved = false;
    try {
      if (previousSupplier && renamedProductIds.length > 0) {
        await updateProductsSupplier(renamedProductIds, supplierDraft.name.trim());
      }
      await saveSupplier({ ...supplierDraft, name: supplierDraft.name.trim() });
      supplierSaved = true;
      const savedName = supplierDraft.name.trim();
      setSupplierDraft(null);
      await qc.invalidateQueries({ queryKey: ["suppliers"] });
      if (renamedProductIds.length > 0) {
        await Promise.all([
          qc.invalidateQueries({ queryKey: ["admin-products"] }),
          qc.invalidateQueries({ queryKey: ["replenishment-suggestions"] }),
        ]);
      }
      const updatedSuppliers = await qc.fetchQuery(suppliersQuery);
      if (!supplierDraft.id) {
        const savedSupplier = updatedSuppliers.find(
          (supplier) => normalizeName(supplier.name) === normalizeName(savedName),
        );
        if (savedSupplier) setSupplierId(savedSupplier.id);
      }
      toast.success(supplierDraft.id ? "Proveedor actualizado" : "Proveedor guardado");
    } catch (err) {
      if (!supplierSaved && previousSupplier && renamedProductIds.length > 0) {
        try {
          await updateProductsSupplier(renamedProductIds, previousSupplier.name);
        } catch (rollbackError) {
          toast.error(
            `No se guardó el proveedor y tampoco se pudieron restaurar sus productos. ${errorMessage(rollbackError)}`,
          );
          return;
        }
      }
      toast.error(errorMessage(err));
    }
  };
  const removeSupplier = async (id: string) => {
    if (!confirm("¿Borrar este proveedor?")) return;
    const supplier = suppliers.find((entry) => entry.id === id);
    const assignedIds = supplier
      ? products
          .filter(
            (product) => normalizeName(product.supplier ?? "") === normalizeName(supplier.name),
          )
          .map((product) => product.id)
      : [];
    let productsUnlinked = false;
    let supplierDeleted = false;
    try {
      if (supplier && assignedIds.length > 0) {
        await updateProductsSupplier(assignedIds, "");
        productsUnlinked = true;
      }
      await deleteSupplier(id);
      supplierDeleted = true;
      if (supplierId === id) setSupplierId("");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["suppliers"] }),
        qc.invalidateQueries({ queryKey: ["admin-products"] }),
        qc.invalidateQueries({ queryKey: ["replenishment-suggestions"] }),
      ]);
      toast.success("Proveedor eliminado");
    } catch (err) {
      if (!supplierDeleted && productsUnlinked && supplier) {
        try {
          await updateProductsSupplier(assignedIds, supplier.name);
        } catch (rollbackError) {
          toast.error(
            `No se pudo eliminar el proveedor ni restaurar las asociaciones de productos. ${errorMessage(rollbackError)}`,
          );
          return;
        }
      }
      toast.error(errorMessage(err));
    }
  };

  return (
    <>
      <PageHeader
        title="Compras y Proveedores"
        description="Elegí un proveedor, armá un pedido y registrá el ingreso para actualizar el stock."
      />
      {suppliersResult.error && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          No se pudieron cargar los proveedores: {errorMessage(suppliersResult.error)}
        </p>
      )}
      {productsResult.error && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          No se pudieron cargar los productos: {errorMessage(productsResult.error)}
        </p>
      )}
      {purchasesResult.error && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          No se pudo cargar el historial de compras: {errorMessage(purchasesResult.error)}
        </p>
      )}
      <section className="mb-6 space-y-4 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Centro de proveedores</h2>
            <p className="text-sm text-muted-foreground">
              Productos asignados, stock, cantidades a pedir y registro de compras.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setSupplierDraft({ name: "", phone: "", notes: "" })}
          >
            <Plus /> Nuevo proveedor
          </Button>
        </div>
        {suppliers.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {suppliers.map((supplier) => {
              const count = products.filter(
                (product) => normalizeName(product.supplier ?? "") === normalizeName(supplier.name),
              ).length;
              return (
                <button
                  type="button"
                  key={supplier.id}
                  onClick={() => setSupplierId(supplier.id)}
                  aria-pressed={supplier.id === supplierId}
                  className={`min-w-36 rounded-lg border px-3 py-2 text-left text-sm ${
                    supplier.id === supplierId ? "border-primary bg-primary/5" : "hover:bg-muted"
                  }`}
                >
                  <span className="block font-medium">{supplier.name}</span>
                  <span className="text-muted-foreground">{count} productos</span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Todavía no hay proveedores. Agregá uno para empezar a organizar tus compras.
          </p>
        )}
        {suppliers.length > 0 && !selectedSupplier && (
          <p className="text-sm text-muted-foreground">
            Seleccioná un proveedor para ver sus productos y preparar un pedido.
          </p>
        )}
        {supplierDraft && (
          <form
            onSubmit={saveSupplierForm}
            className="grid gap-2 rounded-lg border p-3 sm:grid-cols-4"
          >
            <Input
              required
              maxLength={120}
              placeholder="Nombre"
              value={supplierDraft.name}
              onChange={(e) => setSupplierDraft({ ...supplierDraft, name: e.target.value })}
            />
            <Input
              maxLength={40}
              placeholder="Teléfono"
              value={supplierDraft.phone}
              onChange={(e) => setSupplierDraft({ ...supplierDraft, phone: e.target.value })}
            />
            <Input
              maxLength={300}
              placeholder="Notas"
              value={supplierDraft.notes}
              onChange={(e) => setSupplierDraft({ ...supplierDraft, notes: e.target.value })}
            />
            <div className="flex gap-2">
              <Button type="submit" className="flex-1">
                {supplierDraft.id ? "Guardar" : "Agregar"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setSupplierDraft(null)}>
                Cancelar
              </Button>
            </div>
          </form>
        )}
        {selectedSupplier && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/40 p-3">
              <div>
                <h3 className="font-semibold">{selectedSupplier.name}</h3>
                <p className="text-sm text-muted-foreground">
                  Teléfono: {selectedSupplier.phone || "Sin teléfono"}
                  {selectedSupplier.notes ? ` · ${selectedSupplier.notes}` : ""}
                </p>
              </div>
              <div className="flex gap-1">
                {validSupplierPhone && providerLines.length > 0 && (
                  <Button asChild size="sm" className="bg-green-600 text-white hover:bg-green-700">
                    <a
                      href={buildWhatsAppUrl(validSupplierPhone, whatsappMessage)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageCircle /> WhatsApp
                    </a>
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Editar ${selectedSupplier.name}`}
                  onClick={() =>
                    setSupplierDraft({
                      id: selectedSupplier.id,
                      name: selectedSupplier.name,
                      phone: selectedSupplier.phone,
                      notes: selectedSupplier.notes,
                    })
                  }
                >
                  <Pencil />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Eliminar ${selectedSupplier.name}`}
                  onClick={() => removeSupplier(selectedSupplier.id)}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="supplier-product-search" className="text-sm font-medium">
                Asignar producto a {selectedSupplier.name}
              </label>
              <div className="relative">
                <Input
                  id="supplier-product-search"
                  placeholder="Buscar producto por nombre…"
                  value={assignmentSearch}
                  onChange={(event) => setAssignmentSearch(event.target.value)}
                />
                {assignmentMatches.length > 0 && (
                  <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-popover shadow-lift">
                    {assignmentMatches.map((product) => (
                      <li key={product.id}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                          onClick={() => void assignProduct(product)}
                        >
                          {product.name} · {product.supplier || "Sin proveedor"}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            {productsResult.isLoading ? (
              <p className="text-sm text-muted-foreground">Cargando productos…</p>
            ) : assignedProducts.length > 0 ? (
              <div className="space-y-2">
                <h3 className="font-medium">Productos de {selectedSupplier.name}</h3>
                {assignedProducts.map((product) => {
                  const low = product.stock_disponible <= product.min_stock;
                  return (
                    <div
                      key={product.id}
                      className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto]"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{product.name}</p>
                        <p
                          className={`text-sm ${low ? "font-medium text-destructive" : "text-muted-foreground"}`}
                        >
                          Stock: {product.stock_disponible} · Mínimo: {product.min_stock}
                          {low ? " · Reponer" : ""}
                        </p>
                      </div>
                      <p className="self-center text-sm text-muted-foreground">
                        Costo: {formatPrice(product.cost ?? 0)}
                      </p>
                      <Input
                        aria-label={`Cantidad a pedir de ${product.name}`}
                        type="number"
                        min={0}
                        step={1}
                        value={
                          orderQuantities[product.id] ??
                          String(Math.max(0, product.min_stock - product.stock_disponible))
                        }
                        onChange={(event) =>
                          setOrderQuantities((current) => ({
                            ...current,
                            [product.id]: event.target.value,
                          }))
                        }
                        className="w-24"
                      />
                      <Input
                        aria-label={`Costo unitario de ${product.name}`}
                        inputMode="decimal"
                        value={orderCosts[product.id] ?? String(product.cost ?? 0)}
                        onChange={(event) =>
                          setOrderCosts((current) => ({
                            ...current,
                            [product.id]: event.target.value,
                          }))
                        }
                        className="w-28"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Desvincular ${product.name}`}
                        onClick={() => void unlinkProduct(product)}
                      >
                        <Unlink />
                      </Button>
                    </div>
                  );
                })}
                <div className="flex flex-wrap items-center justify-end gap-3 border-t pt-3">
                  <span className="font-semibold">
                    Total estimado: {formatPrice(providerTotal)}
                  </span>
                  <Button
                    disabled={busy || providerLines.length === 0}
                    onClick={() =>
                      void save(
                        providerLines,
                        selectedSupplier.id,
                        `Compra a ${selectedSupplier.name}`,
                      )
                    }
                  >
                    Registrar compra e ingresar stock
                  </Button>
                </div>
              </div>
            ) : (
              <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                No hay productos asignados. Buscá un producto arriba para asociarlo a este
                proveedor.
              </p>
            )}
          </>
        )}
      </section>
      <section className="mb-6 space-y-3 rounded-xl border bg-card p-4">
        <h2 className="font-semibold">Nueva compra</h2>
        <div className="grid gap-2 sm:grid-cols-4">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <div className="flex gap-1 sm:col-span-2">
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="h-9 flex-1 rounded-md border bg-card px-3 text-sm"
            >
              <option value="">Sin proveedor</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <Input placeholder="Notas" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="relative">
          <Input
            placeholder="Buscar producto para agregar…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {matches.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-lift">
              {matches.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => {
                      setLines((ls) => [
                        ...ls,
                        {
                          product_id: p.id,
                          name: p.name,
                          quantity: "1",
                          unit_cost: p.cost > 0 ? String(p.cost) : "",
                        },
                      ]);
                      setSearch("");
                    }}
                  >
                    {p.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {lines.map((l, i) => (
          <div
            key={l.product_id}
            className="grid grid-cols-[1fr_5rem_7rem_auto] items-center gap-2 text-sm"
          >
            <span className="truncate">{l.name}</span>
            <Input
              inputMode="numeric"
              value={l.quantity}
              onChange={(e) => setLine(i, { quantity: e.target.value })}
              aria-label="Cantidad"
            />
            <Input
              inputMode="decimal"
              value={l.unit_cost}
              onChange={(e) => setLine(i, { unit_cost: e.target.value })}
              placeholder="Costo unit."
              aria-label="Costo unitario"
            />
            <Button
              variant="ghost"
              size="sm"
              aria-label="Quitar"
              onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={updateCost}
              onChange={(e) => setUpdateCost(e.target.checked)}
            />{" "}
            Actualizar el costo de los productos
          </label>
          <span className="ml-auto font-semibold">Total: {formatPrice(total)}</span>
          <Button disabled={busy} onClick={() => void save()}>
            Registrar compra
          </Button>
        </div>
      </section>
      <DataTable
        rows={rows}
        getKey={(p) => p.id}
        empty={<p className="text-sm text-muted-foreground">Todavía no hay compras registradas.</p>}
        columns={[
          { header: "Compra", cell: (p) => `#${p.number}` },
          { header: "Fecha", cell: (p) => formatDate(p.date) },
          { header: "Proveedor", cell: (p) => p.supplierName },
          { header: "Total", cell: (p) => formatPrice(p.total), className: "text-right" },
          {
            header: "",
            cell: (p) => (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setOpen(open === p.id ? null : p.id)}
              >
                {open === p.id ? "Cerrar" : "Detalle"}
              </Button>
            ),
          },
        ]}
      />
      {open && <Detail id={open} />}
    </>
  );
}

function Detail({ id }: { id: string }) {
  const items = useQuery(purchaseItemsQuery(id)).data ?? [];
  return (
    <section className="mt-4 rounded-xl border bg-card p-4 text-sm">
      <h2 className="mb-2 font-semibold">Detalle de la compra</h2>
      <ul className="divide-y">
        {items.map((i) => (
          <li key={i.id} className="flex justify-between py-1.5">
            <span>
              {i.productName} × {i.quantity}
            </span>
            <span>{formatPrice(i.unit_cost * i.quantity)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
