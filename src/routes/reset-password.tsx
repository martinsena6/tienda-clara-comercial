import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
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
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let active = true;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" && session) {
        setHasSession(true);
        setCheckingSession(false);
        setError("");
      }
    });
    supabase.auth.getSession().then(({ data: sessionData, error: sessionError }) => {
      if (!active) return;
      setHasSession(Boolean(sessionData.session));
      if (sessionError) setError(errorMessage(sessionError));
      setCheckingSession(false);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!hasSession) return;
    setError("");
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres");
    if (password !== String(form.get("confirm") ?? ""))
      return setError("Las contraseñas no coinciden");
    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      await navigate({ to: "/admin", replace: true });
    } catch (updateError) {
      setError(errorMessage(updateError));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-2xl border bg-card p-6 shadow-lift"
      >
        <h1 className="text-center font-display text-2xl font-bold">Elegí tu nueva contraseña</h1>
        {checkingSession ? (
          <p role="status" className="text-sm text-muted-foreground">
            Verificando el enlace de recuperación…
          </p>
        ) : hasSession ? (
          <>
            <FormField label="Nueva contraseña" htmlFor="password">
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </FormField>
            <FormField label="Repetila" htmlFor="confirm">
              <Input
                id="confirm"
                name="confirm"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </FormField>
          </>
        ) : (
          <p role="alert" className="text-sm text-destructive">
            El enlace venció o no es válido. Volvé al ingreso y solicitá uno nuevo.
          </p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!checkingSession && !hasSession && (
          <Button asChild type="button" className="w-full">
            <Link to="/auth">Volver e ingresar</Link>
          </Button>
        )}
        {hasSession && (
          <Button type="submit" className="w-full" disabled={busy || checkingSession}>
            {busy ? "Guardando…" : "Guardar contraseña"}
          </Button>
        )}
      </form>
    </div>
  );
}
