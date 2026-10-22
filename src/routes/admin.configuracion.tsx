import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/admin/FormField";
import { PageHeader } from "@/components/admin/PageHeader";
import { businessSettings } from "@/lib/domain/mock-data";

export const Route = createFileRoute("/admin/configuracion")({
  head: () => ({
    meta: [
      { title: "Configuración — Panel administrativo" },
      { name: "description", content: "Datos del negocio y contacto." },
      { property: "og:title", content: "Configuración — Panel administrativo" },
      { property: "og:description", content: "Datos del negocio y contacto." },
    ],
  }),
  component: Configuracion,
});

function Configuracion() {
  const s = businessSettings;
  return (
    <>
      <PageHeader title="Configuración del negocio" description="Estos datos se muestran en el catálogo y en los pedidos por WhatsApp." />
      <form
        onSubmit={(e) => { e.preventDefault(); toast.info("El guardado se habilitará al conectar la base de datos."); }}
        className="max-w-2xl space-y-5 rounded-xl border bg-card p-6 shadow-soft"
      >
        <FormField label="Nombre del negocio" htmlFor="name"><Input id="name" defaultValue={s.name} /></FormField>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="WhatsApp para pedidos" htmlFor="wa" hint="Con código de país, sin espacios"><Input id="wa" defaultValue={s.whatsapp} /></FormField>
          <FormField label="Email" htmlFor="email"><Input id="email" type="email" defaultValue={s.email} /></FormField>
        </div>
        <FormField label="Dirección" htmlFor="address"><Input id="address" defaultValue={s.address} /></FormField>
        <FormField label="Moneda" htmlFor="currency"><Input id="currency" value="Peso argentino (ARS)" disabled /></FormField>
        <div className="flex justify-end"><Button type="submit">Guardar cambios</Button></div>
      </form>
    </>
  );
}
