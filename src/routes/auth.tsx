import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/admin/FormField";
import { supabase } from "@/integrations/supabase/client";
import { errorMessage } from "@/lib/data";

type Search = { redirect?: string | undefined };

// El parámetro redirect solo acepta rutas internas (empiezan con "/" y no con "//").
const safeRedirect = (v: unknown): string | undefined =>
  typeof v === "string" && v.startsWith("/") && !v.startsWith("//") ? v : undefined;

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): Search => ({ redirect: safeRedirect(s["redirect"]) }),
  head: () => ({
    meta: [
      { title: "Ingresar — Panel Festiva" },
      { name: "description", content: "Acceso al panel administrativo de Festiva." },
      { property: "og:title", content: "Ingresar — Panel Festiva" },
      { property: "og:description", content: "Acceso al panel administrativo." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: (redirect ?? "/admin") as "/admin", replace: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) throw err;
      await navigate({ to: (redirect ?? "/admin") as "/admin", replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-lift">
        <div className="mb-6 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-xl bg-primary font-display text-xl font-bold text-primary-foreground">F</div>
          <h1 className="mt-3 font-display text-2xl font-bold">Ingresar al panel</h1>
          <p className="mt-1 text-sm text-muted-foreground">Panel administrativo de Festiva</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <FormField label="Email" htmlFor="email">
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </FormField>
          <FormField label="Contraseña" htmlFor="password">
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </FormField>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Un momento…" : "Ingresar"}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          ¿No tenés cuenta? Pedile al dueño que te invite desde el panel.
        </p>
      </div>
    </div>
  );
}
