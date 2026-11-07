import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/admin/FormField";
import { RequireAdmin } from "@/components/admin/RequireAdmin";
import { PageHeader } from "@/components/admin/PageHeader";
import {
  driveLinksQuery,
  errorMessage,
  saveDriveLinks,
  saveSettings,
  settingsQuery,
} from "@/lib/data";
import { driveLinksSchema, settingsSchema } from "@/lib/validation";
import { requireAdminRoute } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/admin/configuracion")({
  beforeLoad: requireAdminRoute,
  head: () => ({
    meta: [
      { title: "Configuración — Panel Festiva" },
      { name: "description", content: "Datos del negocio y contacto." },
      { property: "og:title", content: "Configuración — Panel Festiva" },
      { property: "og:description", content: "Datos del negocio y contacto." },
    ],
  }),
  component: () => (
    <RequireAdmin>
      <Configuracion />
    </RequireAdmin>
  ),
});

function Configuracion() {
  const qc = useQueryClient();
  const { data: s, isLoading } = useQuery(settingsQuery);
  const driveLinks = useQuery(driveLinksQuery);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const r = settingsSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
    const drive = driveLinksSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
    if (!r.success) {
      setErrors(Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    if (!drive.success) {
      setErrors(Object.fromEntries(drive.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const d = r.data;
      await Promise.all([
        saveSettings({
          name: d.name,
          whatsapp: d.whatsapp,
          instagram: (d.instagram ?? "").replace(/^@/, ""),
          tiktok: (d.tiktok ?? "").replace(/^@/, ""),
          address: d.address ?? "",
          hours: d.hours ?? "",
          email: d.email ?? "",
        }),
        saveDriveLinks(drive.data),
      ]);
      await Promise.all([
        qc.invalidateQueries({ queryKey: settingsQuery.queryKey }),
        qc.invalidateQueries({ queryKey: driveLinksQuery.queryKey }),
      ]);
      toast.success("Cambios guardados");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (isLoading || driveLinks.isLoading)
    return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (driveLinks.error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        No pudimos cargar los enlaces internos de Drive: {errorMessage(driveLinks.error)}
      </p>
    );
  }
  return (
    <>
      <PageHeader
        title="Configuración del negocio"
        description="Estos datos se muestran en la tienda y en los pedidos por WhatsApp."
      />
      <form
        key={s?.updated_at ?? "x"}
        onSubmit={submit}
        className="max-w-2xl space-y-5 rounded-xl border bg-card p-6 shadow-soft"
      >
        <FormField label="Nombre del negocio" htmlFor="name" error={errors["name"]}>
          <Input id="name" name="name" defaultValue={s?.name} />
        </FormField>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            label="WhatsApp para pedidos"
            htmlFor="whatsapp"
            hint="Con código de país, sin espacios ni +"
            error={errors["whatsapp"]}
          >
            <Input id="whatsapp" name="whatsapp" defaultValue={s?.whatsapp} />
          </FormField>
          <FormField label="Email" htmlFor="email" error={errors["email"]}>
            <Input id="email" name="email" type="email" defaultValue={s?.email ?? ""} />
          </FormField>
          <FormField label="Instagram" htmlFor="instagram">
            <Input id="instagram" name="instagram" defaultValue={s?.instagram ?? ""} />
          </FormField>
          <FormField label="TikTok" htmlFor="tiktok">
            <Input id="tiktok" name="tiktok" defaultValue={s?.tiktok ?? ""} />
          </FormField>
        </div>
        <FormField label="Dirección" htmlFor="address">
          <Input id="address" name="address" defaultValue={s?.address ?? ""} />
        </FormField>
        <FormField label="Horarios" htmlFor="hours">
          <Input id="hours" name="hours" defaultValue={s?.hours ?? ""} />
        </FormField>
        <div className="space-y-4 rounded-lg border p-4">
          <div>
            <h2 className="font-medium">Enlaces internos de Google Drive</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Solo visibles para el equipo con acceso al panel.
            </p>
          </div>
          <FormField
            label="Carpeta de fotos"
            htmlFor="drive-photos-url"
            error={errors["photos_url"]}
          >
            <Input
              id="drive-photos-url"
              name="photos_url"
              type="url"
              placeholder="https://drive.google.com/drive/folders/…"
              defaultValue={driveLinks.data?.photos_url ?? ""}
            />
          </FormField>
          <FormField
            label="Carpeta o planilla de costos"
            htmlFor="drive-spreadsheets-url"
            error={errors["spreadsheets_url"]}
          >
            <Input
              id="drive-spreadsheets-url"
              name="spreadsheets_url"
              type="url"
              placeholder="https://drive.google.com/drive/folders/…"
              defaultValue={driveLinks.data?.spreadsheets_url ?? ""}
            />
          </FormField>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={busy}>
            {busy ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      </form>
    </>
  );
}
