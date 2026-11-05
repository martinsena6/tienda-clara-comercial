import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/admin/PageHeader";
import { createCounterSale, errorMessage, normalizeName, parseArNumber, usePanelProducts } from "@/lib/data";
import { formatPrice } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/mostrador")({
  head: () => ({
    meta: [
      { title: "Venta en el local — Panel Festiva" },
      { name: "description", content: "Registrar ventas de mostrador." },
      { property: "og:title", content: "Venta en el local — Panel Festiva" },
      { property: "og:description", content: "Ventas de mostrador." },
    ],
  }),
  component: Mostrador,
});

interface Line { product_id: string; name: string; quantity: string; price: string; listPrice: number }

function Mostrador() {
  const qc = useQueryClient();
  const { data: products } = usePanelProducts();
  const [lines, setLines] = useState<Line[]>([]);
  const [q, setQ] = useState("");
  const [note, setNote] = useState("");
  const [allowNeg, setAllowNeg] = useState(true);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<{ number: number; total: number } | null>(null);

  const nq = normalizeName(q);
  const matches = nq.length < 2 ? [] : products.filter((p) => p.active && normalizeName(p.name).includes(nq) && !lines.some((l) => l.product_id === p.id)).slice(0, 8);
  const unit = (l: Line) => (l.price.trim() ? parseArNumber(l.price) ?? NaN : l.listPrice);
  const total = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (unit(l) || 0), 0);
  const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const save = async () => {
    const items = lines.map((l) => ({ product_id: l.product_id, quantity: Math.trunc(Number(l.quantity)), ...(l.price.trim() ? { unit_price: unit(l) } : {}) }));
    if (!items.length) { toast.error("Agregá al menos un producto"); return; }
    if (items.some((i) => !(i.quantity > 0) || ("unit_price" in i && !(i.unit_price! >= 0)))) { toast.error("Revisá cantidades y precios"); return; }
    setBusy(true);
    try {
      const r = await createCounterSale(items, note, allowNeg);
      setLast(r); setLines([]); setNote(""); setQ("");
      toast.success(`Venta #${r.number} registrada`);
      await qc.invalidateQueries();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="Venta en el local" description="Se registra como venta confirmada y descuenta stock al instante." />
      {last && <div className="mb-4 rounded-xl border border-success bg-success/10 p-4 text-sm">Venta #{last.number} registrada por {formatPrice(last.total)}. Lista para la próxima.</div>}
      <section className="space-y-3 rounded-xl border bg-card p-4">
        <div className="relative">
          <Input autoFocus placeholder="Buscar producto…" value={q} onChange={(e) => setQ(e.target.value)} />
          {matches.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-lift">
              {matches.map((p) => (
                <li key={p.id}><button type="button" className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => { setLines((ls) => [...ls, { product_id: p.id, name: p.name, quantity: "1", price: "", listPrice: p.price }]); setQ(""); }}>
                  <span>{p.name}</span><span className="text-muted-foreground">{formatPrice(p.price)} · stock {p.stock}</span>
                </button></li>
              ))}
            </ul>
          )}
        </div>
        {lines.map((l, i) => (
          <div key={l.product_id} className="grid grid-cols-[1fr_5rem_7rem_auto] items-center gap-2 text-sm">
            <span className="truncate">{l.name}</span>
            <Input inputMode="numeric" aria-label="Cantidad" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} />
            <Input inputMode="decimal" aria-label="Precio" placeholder={String(l.listPrice)} value={l.price} onChange={(e) => setLine(i, { price: e.target.value })} />
            <Button variant="ghost" size="sm" aria-label="Quitar" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}><Trash2 /></Button>
          </div>
        ))}
        <Input placeholder="Nota (opcional)" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm"><Switch checked={allowNeg} onCheckedChange={setAllowNeg} /> Permitir stock negativo</label>
          <span className="ml-auto text-lg font-bold">Total: {formatPrice(total)}</span>
          <Button size="lg" disabled={busy} onClick={save}>Registrar venta</Button>
        </div>
      </section>
    </>
  );
}
