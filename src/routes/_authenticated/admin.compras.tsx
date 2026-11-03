import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/admin/DataTable";
import { PageHeader } from "@/components/admin/PageHeader";
import { RequireAdmin } from "@/components/admin/RequireAdmin";
import { adminProductsQuery, deleteSupplier, errorMessage, normalizeName, parseArNumber, purchaseItemsQuery, purchasesQuery, registerPurchase, saveSupplier, suppliersQuery, todayAR } from "@/lib/data";
import { formatDate, formatPrice } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/compras")({
  head: () => ({
    meta: [
      { title: "Compras — Panel Festiva" },
      { name: "description", content: "Compras a proveedores." },
      { property: "og:title", content: "Compras — Panel Festiva" },
      { property: "og:description", content: "Compras a proveedores." },
    ],
  }),
  component: () => <RequireAdmin><Compras /></RequireAdmin>,
});

interface Line { product_id: string; name: string; quantity: string; unit_cost: string }

function Compras() {
  const qc = useQueryClient();
  const rows = useQuery(purchasesQuery).data ?? [];
  const suppliers = useQuery(suppliersQuery).data ?? [];
  const products = useQuery(adminProductsQuery).data ?? [];
  const [open, setOpen] = useState<string | null>(null);
  const [date, setDate] = useState(todayAR());
  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [updateCost, setUpdateCost] = useState(true);
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [busy, setBusy] = useState(false);

  const matches = useMemo(() => {
    const q = normalizeName(search);
    if (q.length < 2) return [];
    return products.filter((p) => normalizeName(p.name).includes(q) && !lines.some((l) => l.product_id === p.id)).slice(0, 8);
  }, [search, products, lines]);

  const total = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (parseArNumber(l.unit_cost) || 0), 0);
  const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const save = async () => {
    const items = lines.map((l) => ({ product_id: l.product_id, quantity: Math.trunc(Number(l.quantity)), unit_cost: parseArNumber(l.unit_cost) ?? NaN }));
    if (items.length === 0) return toast.error("Agregá al menos un producto");
    if (items.some((i) => !(i.quantity > 0) || !(i.unit_cost >= 0))) return toast.error("Revisá cantidades y costos");
    setBusy(true);
    try {
      const r = await registerPurchase({ date, supplier_id: supplierId || null, notes, items, update_cost: updateCost });
      toast.success(`Compra #${r?.purchase_number ?? ""} registrada; el stock se sumó.`);
      setLines([]); setNotes("");
      await Promise.all(["purchases", "admin-products", "movements"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
    } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  };

  const addSupplier = async () => {
    const name = prompt("Nombre del proveedor")?.trim();
    if (!name) return;
    const phone = prompt("Teléfono (opcional)")?.trim() ?? "";
    try { await saveSupplier({ name, phone, notes: "" }); await qc.invalidateQueries({ queryKey: ["suppliers"] }); } catch (err) { toast.error(errorMessage(err)); }
  };
  const removeSupplier = async () => {
    if (!supplierId || !confirm("¿Borrar este proveedor?")) return;
    try { await deleteSupplier(supplierId); setSupplierId(""); await qc.invalidateQueries({ queryKey: ["suppliers"] }); } catch { toast.error("No se puede borrar: tiene compras registradas"); }
  };

  return (
    <>
      <PageHeader title="Compras" description="Al registrar una compra se suma el stock de cada producto." />
      <section className="mb-6 space-y-3 rounded-xl border bg-card p-4">
        <h2 className="font-semibold">Nueva compra</h2>
        <div className="grid gap-2 sm:grid-cols-4">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <div className="flex gap-1 sm:col-span-2">
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="h-9 flex-1 rounded-md border bg-card px-3 text-sm">
              <option value="">Sin proveedor</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <Button type="button" variant="outline" size="sm" onClick={addSupplier}>+ Proveedor</Button>
            {supplierId && <Button type="button" variant="ghost" size="sm" aria-label="Borrar proveedor" onClick={removeSupplier}><Trash2 /></Button>}
          </div>
          <Input placeholder="Notas" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="relative">
          <Input placeholder="Buscar producto para agregar…" value={search} onChange={(e) => setSearch(e.target.value)} />
          {matches.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-lift">
              {matches.map((p) => (
                <li key={p.id}><button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => { setLines((ls) => [...ls, { product_id: p.id, name: p.name, quantity: "1", unit_cost: p.cost > 0 ? String(p.cost) : "" }]); setSearch(""); }}>{p.name}</button></li>
              ))}
            </ul>
          )}
        </div>
        {lines.map((l, i) => (
          <div key={l.product_id} className="grid grid-cols-[1fr_5rem_7rem_auto] items-center gap-2 text-sm">
            <span className="truncate">{l.name}</span>
            <Input inputMode="numeric" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} aria-label="Cantidad" />
            <Input inputMode="decimal" value={l.unit_cost} onChange={(e) => setLine(i, { unit_cost: e.target.value })} placeholder="Costo unit." aria-label="Costo unitario" />
            <Button variant="ghost" size="sm" aria-label="Quitar" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}><Trash2 /></Button>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={updateCost} onChange={(e) => setUpdateCost(e.target.checked)} /> Actualizar el costo de los productos</label>
          <span className="ml-auto font-semibold">Total: {formatPrice(total)}</span>
          <Button disabled={busy} onClick={save}>Registrar compra</Button>
        </div>
      </section>
      <DataTable rows={rows} getKey={(p) => p.id} empty={<p className="text-sm text-muted-foreground">Todavía no hay compras registradas.</p>} columns={[
        { header: "Compra", cell: (p) => `#${p.number}` },
        { header: "Fecha", cell: (p) => formatDate(p.date) },
        { header: "Proveedor", cell: (p) => p.supplierName },
        { header: "Total", cell: (p) => formatPrice(p.total), className: "text-right" },
        { header: "", cell: (p) => <Button size="sm" variant="outline" onClick={() => setOpen(open === p.id ? null : p.id)}>{open === p.id ? "Cerrar" : "Detalle"}</Button> },
      ]} />
      {open && <Detail id={open} />}
    </>
  );
}

function Detail({ id }: { id: string }) {
  const items = useQuery(purchaseItemsQuery(id)).data ?? [];
  return (
    <section className="mt-4 rounded-xl border bg-card p-4 text-sm">
      <h2 className="mb-2 font-semibold">Detalle de la compra</h2>
      <ul className="divide-y">{items.map((i) => <li key={i.id} className="flex justify-between py-1.5"><span>{i.productName} × {i.quantity}</span><span>{formatPrice(i.unit_cost * i.quantity)}</span></li>)}</ul>
    </section>
  );
}
