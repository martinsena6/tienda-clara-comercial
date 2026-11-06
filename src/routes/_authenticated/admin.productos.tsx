import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Check, Pencil, Plus, Upload } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DataTable } from "@/components/admin/DataTable";
import { FormField } from "@/components/admin/FormField";
import { PageHeader } from "@/components/admin/PageHeader";
import { AvailabilityBadge } from "@/components/shared/AvailabilityBadge";
import { ProductImage } from "@/components/catalog/ProductImage";
import { getAvailability, marginPct } from "@/lib/domain/catalog";
import {
  adminProductsQuery, categoriesQuery, comboItemsQuery, copyComboRecipe, createProduct, deleteProductImage, errorMessage, linkProductPhotos, normalizeName, saveComboRecipe, setProductActive, updateProductInternals, updateProductPhoto, uploadBulkProductImages, usePanelProducts, type PanelProduct, slugify, updateProduct, uploadProductImage,
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
  const [image, setImage] = useState(product?.image_url?.startsWith("data:") ? "" : product?.image_url ?? "");
  const [images, setImages] = useState<string[]>(product?.images ?? []);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const onFiles = async (files: FileList | File[]) => {
    if (!files.length) return;
    setBusy(true);
    try {
      const uploaded: string[] = [];
      for (const [index, file] of Array.from(files).entries()) {
        uploaded.push(await uploadProductImage(file, (p) => {
          setProgress(Math.round((index / files.length) * 100 + p.percent / files.length));
        }));
      }
      setImages(uploaded);
      setImage(uploaded[0] ?? "");
      toast.success(`${uploaded.length} foto${uploaded.length === 1 ? "" : "s"} subida${uploaded.length === 1 ? "" : "s"}`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const r = productSchema.safeParse(Object.fromEntries(fd));
    if (!r.success) {
      setErrors(Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const input = {
        ...r.data,
        description: r.data.description ?? "",
        image_url: image,
        image_urls: images,
        featured: fd.get("featured") === "on",
        badge: String(fd.get("badge") ?? ""),
      };
      const supplier = String(fd.get("supplier") ?? "").trim();
      if (product) await updateProduct(product.id, input);
      else await createProduct({ ...input, slug: slugify(input.name) });
      if (product) await updateProductInternals(product.id, { supplier });
      if (product) {
        for (const oldImage of product.images ?? [product.image_url]) {
          if (oldImage && oldImage !== image && !oldImage.startsWith("asset:")) await deleteProductImage(oldImage);
        }
      }
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
    <div>
    <form onSubmit={submit} className="space-y-4 p-4">
      <FormField label="Fotos" htmlFor="photo" hint="Arrastrá varias imágenes; se convierten a WebP de hasta 1200 px.">
        <div
          className="space-y-3 rounded-md border border-dashed p-3"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => { event.preventDefault(); void onFiles(event.dataTransfer.files); }}
        >
          <div className="flex flex-wrap gap-2">
            {images.map((url) => <ProductImage key={url} src={url} alt="" className="size-16 rounded-md" imgClassName="size-16 rounded-md object-cover" />)}
            {!images.length && shown && <ProductImage src={shown} alt="" className="size-16 rounded-md" imgClassName="size-16 rounded-md object-cover" />}
            {!images.length && !shown && <ProductImage alt="Producto sin foto" className="size-16 rounded-md" />}
          </div>
          <Input id="photo" type="file" accept="image/*" multiple onChange={(e) => { if (e.target.files) void onFiles(e.target.files); }} disabled={busy} />
          {images.length > 0 && <Button type="button" size="sm" variant="ghost" onClick={() => { setImages([]); setImage(""); }}>Quitar fotos</Button>}
          {busy && <progress className="h-2 w-full" value={progress} max={100} />}
          <p className="text-xs text-muted-foreground">También podés soltar varias imágenes aquí.</p>
        </div>
      </FormField>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="featured" defaultChecked={product?.featured ?? false} /> Destacado</label>
      <FormField label="Etiqueta de destacado" htmlFor="badge"><Input id="badge" name="badge" maxLength={40} defaultValue={product?.badge ?? ""} placeholder="Ej. Nuevo" /></FormField>
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
      <FormField label="Proveedor" htmlFor="supplier" hint="Interno, no se publica"><Input id="supplier" name="supplier" defaultValue={product?.supplier ?? ""} /></FormField>
      <FormField label="Stock mínimo" htmlFor="min_stock" hint="El stock se carga desde la sección Stock" error={errors["min_stock"]}><Input id="min_stock" name="min_stock" type="number" min={0} defaultValue={product?.min_stock ?? 0} /></FormField>
      <FormField label="Descripción" htmlFor="description"><Textarea id="description" name="description" rows={3} defaultValue={product?.description} /></FormField>
      {product ? (
        <ComboRecipeEditor product={product} />
      ) : (
        <p className="rounded-md border p-3 text-sm text-muted-foreground">
          Guardá el producto para poder configurar su receta de combo.
        </p>
      )}
      <Button type="submit" className="w-full" disabled={busy}>{busy ? "Guardando…" : "Guardar producto"}</Button>
    </form>
    </div>
  );
}

interface RecipeDraft {
  component_id: string;
  quantity: string;
}

function ComboRecipeEditor({ product }: { product: AdminProduct }) {
  const queryClient = useQueryClient();
  const productsQuery = useQuery(adminProductsQuery);
  const recipeQuery = useQuery(comboItemsQuery);
  const products = productsQuery.data ?? [];
  const recipe = useMemo(
    () => (recipeQuery.data ?? []).filter((item) => item.combo_id === product.id),
    [product.id, recipeQuery.data],
  );
  const recipeComboIds = useMemo(
    () => new Set((recipeQuery.data ?? []).map((item) => item.combo_id)),
    [recipeQuery.data],
  );
  const combos = products.filter(
    (item) =>
      item.id !== product.id &&
      recipeComboIds.has(item.id) &&
      !(recipeQuery.data ?? []).some(
        (recipeItem) => recipeItem.combo_id === item.id && recipeComboIds.has(recipeItem.component_id),
      ),
  );
  const [rows, setRows] = useState<RecipeDraft[]>([]);
  const [copyFrom, setCopyFrom] = useState("");
  const [factor, setFactor] = useState("1");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setRows(recipe.map((item) => ({
      component_id: item.component_id,
      quantity: String(item.quantity),
    })));
  }, [recipe]);

  const save = async () => {
    const items = rows.map((row) => ({
      component_id: row.component_id,
      quantity: Number(row.quantity),
    }));
    if (
      items.some((item) => !item.component_id || !Number.isInteger(item.quantity) || item.quantity < 1) ||
      new Set(items.map((item) => item.component_id)).size !== items.length ||
      items.some(
        (item) => item.component_id === product.id || recipeComboIds.has(item.component_id),
      )
    ) {
      toast.error("Elegí productos simples, distintos y cantidades enteras mayores a cero");
      return;
    }

    setBusy(true);
    try {
      await saveComboRecipe(product.id, items);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["combo-items"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-products"] }),
        queryClient.invalidateQueries({ queryKey: ["staff-products"] }),
        queryClient.invalidateQueries({ queryKey: ["public-products"] }),
      ]);
      toast.success("Receta del combo guardada");
    } catch (error) {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["combo-items"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-products"] }),
      ]);
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    const parsedFactor = Number(factor.replace(",", "."));
    if (!copyFrom || !Number.isFinite(parsedFactor) || parsedFactor <= 0) {
      toast.error("Elegí un combo de origen e indicá un factor mayor a cero");
      return;
    }
    if (rows.length && !window.confirm("Copiar reemplazará la receta actual de este producto. ¿Continuar?")) {
      return;
    }

    setBusy(true);
    try {
      const count = await copyComboRecipe(copyFrom, product.id, parsedFactor);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["combo-items"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-products"] }),
        queryClient.invalidateQueries({ queryKey: ["staff-products"] }),
        queryClient.invalidateQueries({ queryKey: ["public-products"] }),
      ]);
      toast.success(`Receta copiada: ${count} componentes`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-3 rounded-lg border p-3">
      <div>
        <h3 className="font-medium">Receta del combo</h3>
        <p className="text-xs text-muted-foreground">
          La disponibilidad y el costo se calculan con las cantidades de sus componentes. Sin receta, se usa el stock manual.
        </p>
      </div>
      {(productsQuery.error || recipeQuery.error) && (
        <p role="alert" className="text-sm text-destructive">
          No se pudo cargar la receta: {errorMessage(productsQuery.error ?? recipeQuery.error)}
        </p>
      )}
      {recipeQuery.isLoading || productsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando receta…</p>
      ) : !productsQuery.error && !recipeQuery.error ? (
        <>
          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground">Este producto no tiene receta y conserva stock manual.</p>
          )}
          <div className="space-y-2">
            {rows.map((row, index) => {
              const selectedComponents = new Set(rows.map((item) => item.component_id).filter(Boolean));
              return (
                <div key={`${product.id}-${index}`} className="grid grid-cols-[minmax(0,1fr)_5rem_auto] gap-2">
                  <select
                    aria-label={`Componente ${index + 1}`}
                    value={row.component_id}
                    onChange={(event) =>
                      setRows((current) =>
                        current.map((item, rowIndex) =>
                          rowIndex === index ? { ...item, component_id: event.target.value } : item,
                        ),
                      )
                    }
                    className="h-9 min-w-0 rounded-md border bg-background px-2 text-sm"
                  >
                    <option value="">Elegir componente…</option>
                    {products
                      .filter((item) =>
                        item.id !== product.id &&
                        (item.id === row.component_id ||
                          (!selectedComponents.has(item.id) && !recipeComboIds.has(item.id))),
                      )
                      .map((item) => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                  </select>
                  <Input
                    aria-label={`Cantidad de ${products.find((item) => item.id === row.component_id)?.name ?? "componente"}`}
                    type="number"
                    min={1}
                    step={1}
                    disabled={busy}
                    value={row.quantity}
                    onChange={(event) =>
                      setRows((current) =>
                        current.map((item, rowIndex) =>
                          rowIndex === index ? { ...item, quantity: event.target.value } : item,
                        ),
                      )
                    }
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    aria-label="Quitar componente"
                    onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}
                  >
                    Quitar
                  </Button>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy || !!productsQuery.error || !!recipeQuery.error}
              onClick={() => setRows((current) => [...current, { component_id: "", quantity: "1" }])}
            >
              Agregar componente
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={busy || !!productsQuery.error || !!recipeQuery.error}
              onClick={save}
            >
              {busy ? "Guardando…" : "Guardar receta"}
            </Button>
          </div>
          <div className="space-y-2 border-t pt-3">
            <h4 className="text-sm font-medium">Copiar receta ×N desde otro combo</h4>
            {combos.length === 0 ? (
              <p className="text-xs text-muted-foreground">Todavía no hay otros combos con receta guardada.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_6rem_auto]">
                <select
                  aria-label="Combo de origen"
                  value={copyFrom}
                  disabled={busy}
                  onChange={(event) => setCopyFrom(event.target.value)}
                  className="h-9 min-w-0 rounded-md border bg-background px-2 text-sm"
                >
                  <option value="">Elegir combo de origen…</option>
                  {combos.map((combo) => <option key={combo.id} value={combo.id}>{combo.name}</option>)}
                </select>
                <Input
                  aria-label="Factor de copia"
                  type="number"
                  min={0.01}
                  step="any"
                  disabled={busy}
                  value={factor}
                  onChange={(event) => setFactor(event.target.value)}
                />
                <Button type="button" size="sm" variant="outline" disabled={busy} onClick={copy}>
                  Copiar receta
                </Button>
              </div>
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}

function ProductPhotoButton({ product }: { product: PanelProduct }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  return (
    <label className="relative inline-flex cursor-pointer items-center justify-center rounded-md p-2 hover:bg-muted" title="Cambiar foto">
      <Camera className="size-4" />
      <input
        className="sr-only"
        type="file"
        accept="image/*"
        aria-label={`Cambiar foto de ${product.name}`}
        disabled={busy}
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          setBusy(true);
          try {
            const url = await uploadProductImage(file, (state) => setProgress(state.percent));
            await updateProductPhoto(product.id, url);
            for (const old of product.images?.length ? product.images : [product.image_url]) {
              if (old && old !== url && !old.startsWith("asset:") && !old.startsWith("data:")) {
                await deleteProductImage(old);
              }
            }
            await qc.invalidateQueries();
            toast.success("Foto actualizada");
          } catch (error) {
            toast.error(errorMessage(error));
          } finally {
            setBusy(false);
            setProgress(0);
          }
        }}
      />
      {busy && <progress aria-label={`Subiendo foto de ${product.name}`} className="absolute bottom-0 left-1/2 h-1 w-8 -translate-x-1/2" value={progress} max={100} />}
    </label>
  );
}

const PAGE = 25;

function hasPhoto(product: PanelProduct) {
  return [product.image_url, ...(product.images ?? [])].some((url) => Boolean(url && !url.startsWith("data:")));
}

function CostCell({ p }: { p: PanelProduct }) {
  const qc = useQueryClient();
  const [v, setV] = useState(p.cost && p.cost > 0 ? String(p.cost) : "");
  const save = async () => {
    const n = v.trim() === "" ? 0 : Number(v.replace(",", "."));
    if (!Number.isFinite(n) || n < 0) { toast.error("Costo inválido"); return; }
    if (n === (p.cost ?? 0)) return;
    try { await updateProductInternals(p.id, { cost: n }); await qc.invalidateQueries({ queryKey: ["admin-products"] }); toast.success("Costo guardado"); }
    catch (e) { toast.error(errorMessage(e)); }
  };
  return <Input aria-label={`Costo de ${p.name}`} className="h-8 w-24 text-right" inputMode="decimal" placeholder="Sin costo" value={v} onChange={(e) => setV(e.target.value)} onBlur={save} onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()} />;
}

function Productos() {
  const qc = useQueryClient();
  const { data: products, isLoading, isAdmin } = usePanelProducts();
  const categories = useQuery(categoriesQuery).data ?? [];
  const [editing, setEditing] = useState<AdminProduct | null | undefined>(undefined);
  const [status, setStatus] = useState<"activos" | "ocultos" | "todos">("activos");
  const [cat, setCat] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [noPhoto, setNoPhoto] = useState(false);
  const [uploadingBulk, setUploadingBulk] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);

  const filtered = useMemo(() => {
    const nq = normalizeName(q);
    return products.filter((p) =>
      (status === "todos" || (status === "activos" ? p.active : !p.active)) &&
      (!cat || p.category_id === cat) &&
      (!noPhoto || !hasPhoto(p)) &&
      (!nq || normalizeName(p.name).includes(nq)));
  }, [products, status, cat, q, noPhoto]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const rows = filtered.slice(page * PAGE, page * PAGE + PAGE);
  const photosCount = products.filter(hasPhoto).length;

  const toggle = async (p: PanelProduct, active: boolean) => {
    try {
      await setProductActive(p.id, active);
      await qc.invalidateQueries();
      toast.success(active ? "Visible en la tienda" : "Oculto de la tienda");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const selectCls = "h-9 rounded-md border bg-card px-3 text-sm";
  const onBulkUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploadingBulk(true);
    try {
      await uploadBulkProductImages(Array.from(files), (progress) => setBulkProgress(progress.percent));
      toast.success(`${files.length} fotos subidas`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setUploadingBulk(false);
      setBulkProgress(0);
    }
  };
  const onLinkPhotos = async () => {
    try {
      const count = await linkProductPhotos();
      await qc.invalidateQueries();
      toast.success(`${count} productos vinculados`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };
  return (
    <>
      <PageHeader
        title="Productos"
        description="Los productos no se borran: se ocultan de la tienda."
        actions={isAdmin ? <Button onClick={() => setEditing(null)}><Plus /> Nuevo producto</Button> : undefined}
      />
      <Sheet open={editing !== undefined} onOpenChange={(o) => !o && setEditing(undefined)}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader><SheetTitle>{editing ? "Editar producto" : "Nuevo producto"}</SheetTitle></SheetHeader>
          {editing !== undefined && <ProductForm key={editing?.id ?? "new"} product={editing} onDone={() => setEditing(undefined)} />}
        </SheetContent>
      </Sheet>
      <div className="mb-4 flex flex-wrap gap-2">
        <Input placeholder="Buscar producto…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} className="h-9 w-full sm:w-64" />
        <select aria-label="Estado" className={selectCls} value={status} onChange={(e) => { setStatus(e.target.value as typeof status); setPage(0); }}>
          <option value="activos">Activos</option><option value="ocultos">Ocultos</option><option value="todos">Todos</option>
        </select>
        <select aria-label="Categoría" className={selectCls} value={cat} onChange={(e) => { setCat(e.target.value); setPage(0); }}>
          <option value="">Todas las categorías</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={noPhoto} onChange={(e) => { setNoPhoto(e.target.checked); setPage(0); }} /> Sin foto</label>
        <span className="self-center text-sm text-muted-foreground">{filtered.length} productos · {photosCount} de {products.length} con foto</span>
      </div>
      {isAdmin && <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border p-3">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted">
          <Upload className="size-4" /> Subir varias fotos
          <input className="sr-only" type="file" accept=".webp,image/webp" multiple disabled={uploadingBulk} onChange={(e) => { void onBulkUpload(e.target.files); e.target.value = ""; }} />
        </label>
        <Button size="sm" variant="outline" onClick={onLinkPhotos}><Check className="mr-2 size-4" />Vincular fotos subidas</Button>
        {uploadingBulk && <progress className="h-2 w-32" value={bulkProgress} max={100} />}
        <span className="text-xs text-muted-foreground">Usá nombres slug.webp, slug-2.webp y slug-3.webp.</span>
      </div>}
      {isLoading ? <p className="text-sm text-muted-foreground">Cargando…</p> : (
        <DataTable
          rows={rows}
          getKey={(p) => p.id}
          columns={[
            { header: "Producto", cell: (p) => (
              <div className="flex items-center gap-3">
                <ProductImage src={p.image} alt="" className="size-10 rounded-md" imgClassName="size-10 rounded-md object-cover" />
                <div><div className="font-medium">{p.name}</div><div className="text-xs text-muted-foreground">{p.categories?.name ?? "Sin categoría"}{isAdmin && p.supplier ? ` · ${p.supplier}` : ""}</div></div>
              </div>
            ) },
            { header: "Precio", cell: (p) => formatPrice(p.price), className: "text-right whitespace-nowrap" },
            ...(isAdmin ? [
              { header: "Costo", cell: (p: PanelProduct) => <CostCell key={`${p.id}-${p.cost}`} p={p} />, className: "text-right", hideOnMobile: true },
              { header: "Margen", cell: (p: PanelProduct) => (p.cost ?? 0) > 0 ? `${marginPct(p.price, p.cost ?? 0)}%` : <span className="text-muted-foreground">—</span>, className: "text-right", hideOnMobile: true },
            ] : []),
            { header: "Disponibilidad", cell: (p) => <AvailabilityBadge value={getAvailability(p.stock_disponible, p.min_stock)} />, hideOnMobile: true },
            { header: "Visible en la tienda", cell: (p) => <Switch checked={p.active} disabled={!isAdmin} aria-label={`Visible en la tienda: ${p.name}`} onCheckedChange={(v) => toggle(p, v)} /> },
            ...(isAdmin ? [{ header: "Fotos", cell: (p: PanelProduct) => <ProductPhotoButton product={p} /> },
              { header: "Editar", cell: (p: PanelProduct) => (
              <Button size="sm" variant="ghost" aria-label="Editar" onClick={() => setEditing(p as AdminProduct)}><Pencil /></Button>
            ) }] : []),
          ]}
        />
      )}
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button>
          <span>Página {page + 1} de {pages}</span>
          <Button size="sm" variant="outline" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Siguiente</Button>
        </div>
      )}
    </>
  );
}
