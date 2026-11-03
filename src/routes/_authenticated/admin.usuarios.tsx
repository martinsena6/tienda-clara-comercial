import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/admin/DataTable";
import { PageHeader } from "@/components/admin/PageHeader";
import { RequireAdmin } from "@/components/admin/RequireAdmin";
import { errorMessage, setUserRole, teamQuery, useMyRole } from "@/lib/data";
import { inviteUser } from "@/lib/team.functions";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuarios — Panel Festiva" },
      { name: "description", content: "Equipo y permisos del panel." },
      { property: "og:title", content: "Usuarios — Panel Festiva" },
      { property: "og:description", content: "Equipo y permisos." },
    ],
  }),
  component: () => <RequireAdmin><Usuarios /></RequireAdmin>,
});

function Usuarios() {
  const qc = useQueryClient();
  const { email: myEmail } = useMyRole();
  const team = useQuery(teamQuery).data ?? [];
  const invite = useServerFn(inviteUser);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const email = String(new FormData(form).get("email") ?? "");
    setBusy(true);
    try { await invite({ data: { email } }); form.reset(); toast.success("Invitación enviada. Cuando entre, asignale un rol."); await qc.invalidateQueries({ queryKey: ["team"] }); }
    catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  };
  const change = async (id: string, role: "admin" | "vendedor" | "ninguno") => {
    if (role !== "vendedor" && !confirm(role === "admin" ? "¿Darle acceso total de dueño?" : "¿Quitarle el acceso al panel?")) return;
    try { await setUserRole(id, role); await qc.invalidateQueries({ queryKey: ["team"] }); toast.success("Permiso actualizado"); }
    catch (err) { toast.error(errorMessage(err)); }
  };

  return (
    <>
      <PageHeader title="Usuarios" description="Quién puede entrar al panel y con qué permisos." />
      <form onSubmit={submit} className="mb-6 flex flex-wrap gap-2 rounded-xl border bg-card p-4">
        <Input name="email" type="email" required placeholder="email@ejemplo.com" className="max-w-xs" />
        <Button type="submit" disabled={busy}>Invitar por email</Button>
      </form>
      <DataTable rows={team} getKey={(u) => u.user_id} columns={[
        { header: "Email", cell: (u) => u.email },
        { header: "Alta", cell: (u) => formatDate(u.created_at), hideOnMobile: true },
        { header: "Permiso", cell: (u) => u.email === myEmail ? <span>Dueño (vos)</span> : (
          <select className="h-9 rounded-md border bg-card px-2 text-sm" value={u.role ?? "ninguno"} onChange={(e) => change(u.user_id, e.target.value as "admin" | "vendedor" | "ninguno")}>
            <option value="admin">Dueño</option>
            <option value="vendedor">Vendedor</option>
            <option value="ninguno">Sin acceso</option>
          </select>
        ) },
      ]} />
    </>
  );
}
