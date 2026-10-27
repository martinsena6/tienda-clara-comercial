import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DataTable } from "@/components/admin/DataTable";
import { FormField } from "@/components/admin/FormField";
import { PageHeader } from "@/components/admin/PageHeader";
import { AvailabilityBadge } from "@/components/shared/AvailabilityBadge";
import { getAvailability, marginPct } from "@/lib/domain/catalog";
import {
  adminProductsQuery, categoriesQuery, createProduct, deleteProduct, errorMessage, slugify, updateProduct, uploadProductImage,
  type AdminProduct,
} from "@/lib/data";
import { formatPrice } from "@/lib/format";
import { productSchema } from "@/lib/validation";

export const Route = createFileRoute("/_authenticated/admin/productos")({
  head: () => ({
    meta: [
      { title: "Productos — Panel Festiva" },
      { name: "description", content: "Listado de productos, precios y costos." },
      { property: "og:title", content: "Productos — Panel Festiva" },
      { property: "og:description", content: "Listado de productos, precios y costos." },
    ],
  }),
  component: Productos,
});

function ProductForm({ product, onDone }: { product: AdminProduct | null; onDone: () => void }) {
  const qc = useQueryClient();
  const categories = useQuery(categoriesQuery).data ?? [];
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [image, setImage] = useState(product?.image_url ?? "");
  const [busy, setBusy] = useState(false);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      setImage(await uploadProductImage(file));
      toast.success("Foto subida");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const r = productSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
    if (!r.success) {
      setErrors(Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const input = { ...r.data, description: r.data.description ?? "", image_url: image };
      if (product) await updateProduct(product.id, input);
      else await createProduct({ ...input, slug: slugify(input.name) });
      await qc.invalidateQueries();
      toast.success(product ? "Producto actualizado" : "Producto creado");
      onDone();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const shown = image ? (image.startsWith("asset:") ? product?.image : image) : "";
  return (
    <form onSubmit={submit} className="space-y-4 p-4">
      <FormField label="Foto" htmlFor="photo" hint="JPG o PNG, hasta 5 MB">
        <div className="flex items-center gap-3">
          {shown ? <img src={shown} alt="" className="size-16 rounded-md object-cover" /> : <div className="size-16 rounded-md bg-muted" />}
          <div className="flex flex-col gap-2">
            <Input id="photo" type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0])} disabled={busy} />
            {image && <Button type="button" size="sm" variant="ghost" onClick={() => setImage("")}>Quitar foto</Button>}
          </div>
        </div>
      </FormField>
      <FormField label="Nombre" htmlFor="name" error={errors["name"]}><Input id="name" name="name" defaultValue={product?.name} /></FormField>
      <FormField label="Categoría" htmlFor="category_id" error={errors["category_id"]}>
        <select id="category_id" name="category_id" className="h-9 w-full rounded-md border bg-card px-3 text-sm" defaultValue={product?.category_id ?? ""}>
          <option value="" disabled>Elegir…</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Precio de venta" htmlFor="price" error={errors["price"]}><Input id="price" name="price" type="number" min={0} step="any" defaultValue={product?.price} /></FormField>
        <FormField label="Costo" htmlFor="cost" hint="Interno, no se publica" error={errors["cost"]}><Input id="cost" name="cost" type="number" min={0} step="any" defaultValue={product?.cost ?? 0} /></FormField>
      </div>
      <FormField label="Stock mínimo" htmlFor="min_stock" hint="El stock se carga desde la sección Stock" error={errors["min_stock"]}><Input id="min_stock" name="min_stock" type="number" min={0} defaultValue={product?.min_stock ?? 0} /></FormField>
      <FormField label="Descripción" htmlFor="description"><Textarea id="description" name="description" rows={3} defaultValue={product?.description} /></FormField>
      <Button type="submit" className="w-full" disabled={busy}>{busy ? "Guardando…" : "Guardar producto"}</Button>
    </form>
  );
}

function Productos() {
  const qc = useQueryClient();
  const { data: products = [], isLoading } = useQuery(adminProductsQuery);
  const [editing, setEditing] = useState<AdminProduct | null | undefined>(undefined);

  const remove = async (p: AdminProduct) => {
    if (!confirm(`¿Borrar "${p.name}"?`)) return;
    try {
      await deleteProduct(p.id);
      await qc.invalidateQueries();
      toast.success("Producto borrado");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <>
      <PageHeader
        title="Productos"
        description="Lo que cambies acá se ve al instante en la tienda."
        actions={<Button onClick={() => setEditing(null)}><Plus /> Nuevo producto</Button>}
      />
      <Sheet open={editing !== undefined} onOpenChange={(o) => !o && setEditing(undefined)}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader><SheetTitle>{editing ? "Editar producto" : "Nuevo producto"}</SheetTitle></SheetHeader>
          {editing !== undefined && <ProductForm key={editing?.id ?? "new"} product={editing} onDone={() => setEditing(undefined)} />}
        </SheetContent>
      </Sheet>
      {isLoading ? <p className="text-sm text-muted-foreground">Cargando…</p> : (
        <DataTable
          rows={products}
          getKey={(p) => p.id}
          columns={[
            { header: "Producto", cell: (p) => (
              <div className="flex items-center gap-3">
                {p.image ? <img src={p.image} alt="" loading="lazy" className="size-10 rounded-md object-cover" /> : <div className="size-10 rounded-md bg-muted" />}
                <div><div className="font-medium">{p.name}</div><div className="text-xs text-muted-foreground">{(p.categories as { name: string } | null)?.name ?? "Sin categoría"}</div></div>
              </div>
            ) },
            { header: "Precio", cell: (p) => formatPrice(p.price), className: "text-right whitespace-nowrap" },
            { header: "Costo", cell: (p) => formatPrice(p.cost), className: "text-right whitespace-nowrap", hideOnMobile: true },
            { header: "Margen", cell: (p) => `${marginPct(p.price, p.cost)}%`, className: "text-right", hideOnMobile: true },
            { header: "Disponibilidad", cell: (p) => <AvailabilityBadge value={getAvailability(p.stock, p.min_stock)} />, hideOnMobile: true },
            { header: "Acciones", cell: (p) => (
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" aria-label="Editar" onClick={() => setEditing(p)}><Pencil /></Button>
                <Button size="sm" variant="ghost" aria-label="Borrar" onClick={() => remove(p)}><Trash2 /></Button>
              </div>
            ) },
          ]}
        />
      )}
    </>
  );
}
