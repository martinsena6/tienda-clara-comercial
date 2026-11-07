import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { FormField } from "@/components/admin/FormField";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errorMessage, saveStaffProfile, staffProfileQuery } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/admin/perfil")({
  head: () => ({
    meta: [
      { title: "Mi perfil — Panel Festiva" },
      { name: "description", content: "Tus datos de contacto del equipo Festiva." },
    ],
  }),
  component: Perfil,
});

function Perfil() {
  const queryClient = useQueryClient();
  const profile = useQuery(staffProfileQuery);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile.data) return;
    setFullName(profile.data.full_name);
    setPhone(profile.data.phone);
  }, [profile.data]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (fullName.trim().split(/\s+/).length < 2) {
      toast.error("Ingresá tu nombre y apellido");
      return;
    }
    setBusy(true);
    try {
      await saveStaffProfile({ full_name: fullName.trim(), phone: phone.trim() });
      await queryClient.invalidateQueries({ queryKey: ["staff-profile"] });
      toast.success("Tu perfil quedó guardado");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  if (profile.isLoading) return <p className="text-sm text-muted-foreground">Cargando perfil…</p>;
  if (profile.error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        No pudimos cargar tu perfil: {errorMessage(profile.error)}
      </p>
    );
  }

  return (
    <div className="max-w-xl">
      <PageHeader title="Mi perfil" description="Datos personales del equipo Festiva." />
      <form onSubmit={save} className="mt-6 space-y-4 rounded-2xl border bg-card p-5">
        <FormField label="Nombre y apellido" htmlFor="staff-full-name">
          <Input
            id="staff-full-name"
            autoComplete="name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            required
          />
        </FormField>
        <FormField label="Teléfono" htmlFor="staff-phone">
          <Input
            id="staff-phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </FormField>
        <FormField label="Correo electrónico" htmlFor="staff-email">
          <Input id="staff-email" value={profile.data?.email ?? ""} readOnly />
        </FormField>
        <Button type="submit" disabled={busy}>
          {busy ? "Guardando…" : "Guardar perfil"}
        </Button>
      </form>
    </div>
  );
}
