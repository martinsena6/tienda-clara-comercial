import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/admin/FormField";
import { PageHeader } from "@/components/admin/PageHeader";
import { errorMessage, saveSettings, settingsQuery } from "@/lib/data";
import { settingsSchema } from "@/lib/validation";

export const Route = createFileRoute("/_authenticated/admin/configuracion")({
  head: () => ({
    meta: [
      { title: "Configuración — Panel Festiva" },
      { name: "description", content: "Datos del negocio y contacto." },
      { property: "og:title", content: "Configuración — Panel Festiva" },
      { property: "og:description", content: "Datos del negocio y contacto." },
    ],
  }),
  component: Configuracion,
});

function Configuracion() {
  const qc = useQueryClient();
  const { data: s, isLoading } = useQuery(settingsQuery);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const r = settingsSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
    if (!r.success) {
      setErrors(Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const d = r.data;
      await saveSettings({ name: d.name, whatsapp: d.whatsapp, instagram: (d.instagram ?? "").replace(/^@/, ""), tiktok: (d.tiktok ?? "").replace(/^@/, ""), address: d.address ?? "", hours: d.hours ?? "", email: d.email ?? "" });
      await qc.invalidateQueries({ queryKey: settingsQuery.queryKey });
      toast.success("Cambios guardados");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  return (
    <>
      <PageHeader title="Configuración del negocio" description="Estos datos se muestran en la tienda y en los pedidos por WhatsApp." />
      <form key={s?.updated_at ?? "x"} onSubmit={submit} className="max-w-2xl space-y-5 rounded-xl border bg-card p-6 shadow-soft">
        <FormField label="Nombre del negocio" htmlFor="name" error={errors["name"]}><Input id="name" name="name" defaultValue={s?.name} /></FormField>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="WhatsApp para pedidos" htmlFor="whatsapp" hint="Con código de país, sin espacios ni +" error={errors["whatsapp"]}><Input id="whatsapp" name="whatsapp" defaultValue={s?.whatsapp} /></FormField>
          <FormField label="Email" htmlFor="email" error={errors["email"]}><Input id="email" name="email" type="email" defaultValue={s?.email ?? ""} /></FormField>
          <FormField label="Instagram" htmlFor="instagram"><Input id="instagram" name="instagram" defaultValue={s?.instagram ?? ""} /></FormField>
          <FormField label="TikTok" htmlFor="tiktok"><Input id="tiktok" name="tiktok" defaultValue={s?.tiktok ?? ""} /></FormField>
        </div>
        <FormField label="Dirección" htmlFor="address"><Input id="address" name="address" defaultValue={s?.address ?? ""} /></FormField>
        <FormField label="Horarios" htmlFor="hours"><Input id="hours" name="hours" defaultValue={s?.hours ?? ""} /></FormField>
        <div className="flex justify-end"><Button type="submit" disabled={busy}>{busy ? "Guardando…" : "Guardar cambios"}</Button></div>
      </form>
    </>
  );
}
