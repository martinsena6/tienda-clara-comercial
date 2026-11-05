import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PageHeader } from "@/components/admin/PageHeader";
import { useMyRole, adminBannersQuery, deleteBanner, deleteProductImage, errorMessage, saveBanner, uploadProductImage } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/admin/banners")({
  head: () => ({ meta: [{ title: "Banners — Panel Festiva" }, { name: "robots", content: "noindex" }] }),
  component: Banners,
});

type Banner = {
  id: string;
  title: string;
  subtitle: string;
  image_url: string;
  link: string;
  active: boolean;
  sort: number;
};

function BannerForm({ banner, onDone }: { banner: Banner | null; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [imageUrl, setImageUrl] = useState(banner?.image_url ?? "");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await saveBanner({
        ...(banner ? { id: banner.id } : {}),
        title: String(form.get("title") ?? "").trim(),
        subtitle: String(form.get("subtitle") ?? "").trim(),
        image_url: imageUrl,
        link: String(form.get("link") ?? "").trim(),
        sort: Number(form.get("sort") ?? 0),
        active: form.get("active") === "on",
      });
      if (banner?.image_url && banner.image_url !== imageUrl) await deleteProductImage(banner.image_url);
      await queryClient.invalidateQueries({ queryKey: ["admin-banners"] });
      await queryClient.invalidateQueries({ queryKey: ["banners"] });
      toast.success(banner ? "Banner actualizado" : "Banner creado");
      onDone();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 p-4">
      <label className="grid gap-1 text-sm">Título<Input name="title" required maxLength={120} defaultValue={banner?.title ?? ""} /></label>
      <label className="grid gap-1 text-sm">Subtítulo<Input name="subtitle" maxLength={240} defaultValue={banner?.subtitle ?? ""} /></label>
      <label className="grid gap-1 text-sm">Enlace<Input name="link" type="url" placeholder="https://…" defaultValue={banner?.link ?? ""} /></label>
      <label className="grid gap-1 text-sm">Orden<Input name="sort" type="number" step={1} defaultValue={banner?.sort ?? 0} /></label>
      <label className="grid gap-2 text-sm">Imagen
        {imageUrl && <img src={imageUrl} alt="" className="aspect-video w-full rounded-md object-cover" />}
        <Input type="file" accept="image/*" disabled={busy} onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          setBusy(true);
          try {
            setImageUrl(await uploadProductImage(file));
          } catch (error) {
            toast.error(errorMessage(error));
          } finally {
            setBusy(false);
          }
        }} />
      </label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={banner?.active ?? true} /> Activo</label>
      <Button type="submit" className="w-full" disabled={busy}>{busy ? "Guardando…" : "Guardar banner"}</Button>
    </form>
  );
}

function Banners() {
  const { isAdmin, loading } = useMyRole();
  const queryClient = useQueryClient();
  const { data: banners = [], isLoading, error } = useQuery({ ...adminBannersQuery, enabled: isAdmin });
  const [editing, setEditing] = useState<Banner | null | undefined>(undefined);

  if (loading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (!isAdmin) return <p role="alert" className="text-sm text-destructive">Esta sección es solo para administradores.</p>;

  return (
    <>
      <PageHeader title="Banners" description="Administrá las imágenes y mensajes de la portada." actions={<Button onClick={() => setEditing(null)}><Plus /> Nuevo banner</Button>} />
      {error && <p role="alert" className="text-sm text-destructive">{errorMessage(error)}</p>}
      {isLoading ? <p className="text-sm text-muted-foreground">Cargando banners…</p> : banners.length === 0 ? (
        <p className="rounded-lg border p-6 text-sm text-muted-foreground">Todavía no hay banners.</p>
      ) : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {banners.map((banner) => <article key={banner.id} className="overflow-hidden rounded-xl border bg-card">
          {banner.image_url && <img src={banner.image_url} alt="" className="aspect-video w-full object-cover" />}
          <div className="space-y-2 p-4">
            <div className="flex items-center justify-between gap-2"><h2 className="font-semibold">{banner.title}</h2><span className="text-xs text-muted-foreground">{banner.active ? "Activo" : "Inactivo"} · Orden {banner.sort}</span></div>
            <p className="line-clamp-2 text-sm text-muted-foreground">{banner.subtitle}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing(banner)}><Pencil /> Editar</Button>
              <Button size="sm" variant="ghost" aria-label={`Eliminar banner ${banner.title}`} onClick={async () => {
                if (!window.confirm(`¿Eliminar el banner “${banner.title}”?`)) return;
                try {
                  await deleteBanner(banner.id);
                  if (banner.image_url) await deleteProductImage(banner.image_url);
                  await queryClient.invalidateQueries({ queryKey: ["admin-banners"] });
                  await queryClient.invalidateQueries({ queryKey: ["banners"] });
                  toast.success("Banner eliminado");
                } catch (deleteError) {
                  toast.error(errorMessage(deleteError));
                }
              }}><Trash2 /></Button>
            </div>
          </div>
        </article>)}
      </div>}
      <Sheet open={editing !== undefined} onOpenChange={(open) => !open && setEditing(undefined)}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader><SheetTitle>{editing ? "Editar banner" : "Nuevo banner"}</SheetTitle></SheetHeader>
          {editing !== undefined && <BannerForm key={editing?.id ?? "new"} banner={editing} onDone={() => setEditing(undefined)} />}
        </SheetContent>
      </Sheet>
    </>
  );
}
