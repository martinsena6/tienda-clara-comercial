import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DataTable } from "@/components/admin/DataTable";
import { FormField } from "@/components/admin/FormField";
import { PageHeader } from "@/components/admin/PageHeader";
import { AvailabilityBadge } from "@/components/shared/AvailabilityBadge";
import { categoryName, getAvailability, marginPct } from "@/lib/domain/catalog";
import { categories, products } from "@/lib/domain/mock-data";
import { formatPrice } from "@/lib/format";
import { productSchema } from "@/lib/validation";

export const Route = createFileRoute("/admin/productos")({
  head: () => ({
    meta: [
      { title: "Productos — Panel administrativo" },
      { name: "description", content: "Listado de productos, precios y costos." },
      { property: "og:title", content: "Productos — Panel administrativo" },
      { property: "og:description", content: "Listado de productos, precios y costos." },
    ],
  }),
  component: Productos,
});

function ProductForm({ onDone }: { onDone: () => void }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const r = productSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
    if (!r.success) {
      setErrors(Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    toast.info("Validación correcta", { description: "El guardado se habilitará al conectar la base de datos." });
    onDone();
  };
  return (
    <form onSubmit={submit} className="space-y-4 p-4">
      <FormField label="Nombre" htmlFor="name" error={errors["name"]}><Input id="name" name="name" /></FormField>
      <FormField label="Categoría" htmlFor="categoryId" error={errors["categoryId"]}>
        <select id="categoryId" name="categoryId" className="h-9 w-full rounded-md border bg-card px-3 text-sm" defaultValue="">
          <option value="" disabled>Elegir…</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Precio de venta" htmlFor="price" error={errors["price"]}><Input id="price" name="price" type="number" min={0} /></FormField>
        <FormField label="Costo" htmlFor="cost" hint="Interno, no se publica" error={errors["cost"]}><Input id="cost" name="cost" type="number" min={0} /></FormField>
      </div>
      <FormField label="Stock mínimo" htmlFor="minStock" hint="El stock se carga con movimientos" error={errors["minStock"]}><Input id="minStock" name="minStock" type="number" min={0} defaultValue={0} /></FormField>
      <FormField label="Descripción" htmlFor="description"><Textarea id="description" name="description" rows={3} /></FormField>
      <Button type="submit" className="w-full">Guardar producto</Button>
    </form>
  );
}

function Productos() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <PageHeader
        title="Productos"
        description="Fuente única de nombres y precios para el panel y el catálogo."
        actions={
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild><Button><Plus /> Nuevo producto</Button></SheetTrigger>
            <SheetContent className="overflow-y-auto">
              <SheetHeader><SheetTitle>Nuevo producto</SheetTitle></SheetHeader>
              <ProductForm onDone={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
        }
      />
      <DataTable
        rows={products}
        getKey={(p) => p.id}
        columns={[
          { header: "Producto", cell: (p) => (
            <div className="flex items-center gap-3">
              <img src={p.image} alt="" width={816} height={816} loading="lazy" className="size-10 rounded-md object-cover" />
              <div><div className="font-medium">{p.name}</div><div className="text-xs text-muted-foreground">{categoryName(p.categoryId)}</div></div>
            </div>
          ) },
          { header: "Precio", cell: (p) => formatPrice(p.price), className: "text-right whitespace-nowrap" },
          { header: "Costo", cell: (p) => formatPrice(p.cost), className: "text-right whitespace-nowrap", hideOnMobile: true },
          { header: "Margen", cell: (p) => `${marginPct(p.price, p.cost)}%`, className: "text-right", hideOnMobile: true },
          { header: "Disponibilidad", cell: (p) => <AvailabilityBadge value={getAvailability(p.stock, p.minStock)} />, hideOnMobile: true },
        ]}
      />
    </>
  );
}
