import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/admin/FormField";
import { supabase } from "@/integrations/supabase/client";
import { errorMessage } from "@/lib/data";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nueva contraseña — Panel Festiva" },
      { name: "description", content: "Elegí una contraseña nueva para el panel de Festiva." },
      { property: "og:title", content: "Nueva contraseña — Panel Festiva" },
      { property: "og:description", content: "Recuperá el acceso al panel de Festiva." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres");
    if (password !== String(form.get("confirm") ?? "")) return setError("Las contraseñas no coinciden");
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) return setError(errorMessage(err));
    await navigate({ to: "/admin", replace: true });
  };
  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border bg-card p-6 shadow-lift">
        <h1 className="text-center font-display text-2xl font-bold">Elegí tu nueva contraseña</h1>
        <FormField label="Nueva contraseña" htmlFor="password">
          <Input id="password" name="password" type="password" autoComplete="new-password" required />
        </FormField>
        <FormField label="Repetila" htmlFor="confirm">
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
        </FormField>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Guardando…" : "Guardar contraseña"}
        </Button>
      </form>
    </div>
  );
}
