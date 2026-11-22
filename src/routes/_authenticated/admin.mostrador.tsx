import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  createCounterSale,
  errorMessage,
  normalizeName,
  parseArNumber,
  usePanelProducts,
} from "@/lib/data";
import { formatPrice } from "@/lib/format";

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
      { name: "description", content: "Registrar una venta de mostrador." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Mostrador,
});

function Mostrador() {
  const { data: products } = usePanelProducts();
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [note, setNote] = useState("");
  const [allowNegative, setAllowNegative] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ number: number; total: number } | null>(null);

  const matches = useMemo(() => {
    const q = normalizeName(search);
    if (q.length < 2) return [];
    return products
      .filter(
        (p) =>
          p.active &&
          normalizeName(p.name).includes(q) &&
          !lines.some((l) => l.product_id === p.id),
      )
      .slice(0, 8);
  }, [search, products, lines]);

  const total = lines.reduce((sum, line) => {
    const price = line.unit_price.trim()
      ? (parseArNumber(line.unit_price) ?? 0)
      : line.defaultPrice;
    return sum + (Number(line.quantity) || 0) * price;
  }, 0);

  const updateLine = (index: number, patch: Partial<Line>) => {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
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

    setBusy(true);
    try {
      const saved = await createCounterSale(items, note.trim(), allowNegative);
      setResult(saved);
      setLines([]);
      setNote("");
      setSearch("");
      toast.success(`Venta #${saved.number} registrada`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Venta Presencial"
        description="Registrá ventas de mostrador. Cada venta descuenta stock y guarda el costo vigente."
      />
      {result && (
        <section
          role="status"
          className="mb-5 rounded-xl border border-success/40 bg-success/10 p-4"
        >
          <h2 className="font-semibold">Venta #{result.number} registrada</h2>
          <p className="text-sm">Total: {formatPrice(result.total)}</p>
        </section>
      )}
      <section className="space-y-4 rounded-xl border bg-card p-4">
        <div className="relative">
          <Input
            aria-label="Buscar producto"
            placeholder="Buscar producto para agregar…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {matches.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-lift">
              {matches.map((product) => (
                <li key={product.id}>
                  <button
                    type="button"
                    className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => {
                      setLines((current) => [
                        ...current,
                        {
                          product_id: product.id,
                          name: product.name,
                          stock: product.stock_disponible,
                          defaultPrice: product.price,
                          quantity: "1",
                          unit_price: "",
                        },
                      ]);
                      setSearch("");
                      setResult(null);
                    }}
                  >
                    <span>{product.name}</span>
                    <span className="text-muted-foreground">Stock: {product.stock}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">Buscá productos para comenzar la venta.</p>
        ) : (
          <ul className="divide-y">
            {lines.map((line, index) => (
              <li
                key={line.product_id}
                className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_6rem_8rem_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{line.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Stock disponible: {line.stock} · Precio actual: {formatPrice(line.defaultPrice)}
                  </p>
                </div>
                <Input
                  aria-label={`Cantidad de ${line.name}`}
                  inputMode="numeric"
                  value={line.quantity}
                  onChange={(e) => updateLine(index, { quantity: e.target.value })}
                />
                <Input
                  aria-label={`Precio unitario de ${line.name}`}
                  inputMode="decimal"
                  placeholder="Precio actual"
                  value={line.unit_price}
                  onChange={(e) => updateLine(index, { unit_price: e.target.value })}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label={`Quitar ${line.name}`}
                  onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <Input
          aria-label="Nota de la venta"
          maxLength={300}
          placeholder="Nota (opcional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-3 border-t pt-4">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={allowNegative} onCheckedChange={setAllowNegative} />
            Permitir stock negativo
          </label>
          <span className="ml-auto font-semibold">Total: {formatPrice(total)}</span>
          <Button disabled={busy || lines.length === 0} onClick={save}>
            {busy ? "Registrando…" : "Registrar venta"}
          </Button>
        </div>
      </section>
    </>
  );
}
