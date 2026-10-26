import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/admin/FormField";
import { supabase } from "@/integrations/supabase/client";
import { errorMessage } from "@/lib/data";

type Search = { redirect?: string | undefined };

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    redirect: typeof s["redirect"] === "string" && s["redirect"].startsWith("/") ? s["redirect"] : undefined,
  }),
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
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

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
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        await navigate({ to: (redirect ?? "/admin") as "/admin", replace: true });
      } else {
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/auth" },
        });
        if (err) throw err;
        if (data.session) {
          await navigate({ to: (redirect ?? "/admin") as "/admin", replace: true });
        } else {
          setSent(true);
        }
      }
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
          <h1 className="mt-3 font-display text-2xl font-bold">{mode === "login" ? "Ingresar al panel" : "Crear cuenta"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Panel administrativo de Festiva</p>
        </div>

        {sent ? (
          <div className="rounded-xl border bg-muted/40 p-4 text-center text-sm">
            <p className="font-medium">Revisá tu correo</p>
            <p className="mt-1 text-muted-foreground">Te enviamos un enlace para confirmar tu cuenta. Cuando lo abras, ya podés ingresar.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <FormField label="Email" htmlFor="email">
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </FormField>
            <FormField label="Contraseña" htmlFor="password" hint="Mínimo 6 caracteres">
              <Input id="password" name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required />
            </FormField>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Un momento…" : mode === "login" ? "Ingresar" : "Crear cuenta"}
            </Button>
          </form>
        )}

        <p className="mt-4 text-center text-sm text-muted-foreground">
          {mode === "login" ? (
            <>
              ¿No tenés cuenta?{" "}
              <button type="button" className="font-medium text-primary" onClick={() => { setMode("signup"); setError(""); }}>
                Crear cuenta
              </button>
            </>
          ) : (
            <>
              ¿Ya tenés cuenta?{" "}
              <button type="button" className="font-medium text-primary" onClick={() => { setMode("login"); setError(""); }}>
                Ingresar
              </button>
            </>
          )}
        </p>
        {mode === "signup" && !sent && (
          <p className="mt-3 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            La primera cuenta que se cree queda como administradora del negocio.
          </p>
        )}
      </div>
    </div>
  );
}
