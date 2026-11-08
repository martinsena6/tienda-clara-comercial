import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/admin/FormField";
import { supabase } from "@/integrations/supabase/client";
import { errorMessage } from "@/lib/data";

type Search = { redirect?: string | undefined };
type AuthMode = "login" | "forgot" | "reset";

// El parámetro redirect solo acepta rutas internas (empiezan con "/" y no con "//").
const safeRedirect = (v: unknown): string | undefined =>
  typeof v === "string" && v.startsWith("/") && !v.startsWith("//") ? v : undefined;
const safeMode = (v: unknown): "reset" | undefined => (v === "reset" ? "reset" : undefined);

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): Search & { mode?: "reset" } => ({
    redirect: safeRedirect(s["redirect"]),
    mode: safeMode(s["mode"]),
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
  const { redirect, mode: searchMode } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<AuthMode>(searchMode === "reset" ? "reset" : "login");
  const [email, setEmail] = useState("");
  const [recoverySession, setRecoverySession] = useState<boolean | null>(
    searchMode === "reset" ? null : false,
  );

  useEffect(() => {
    let active = true;
    const goToPanel = () => navigate({ to: (redirect ?? "/admin") as "/admin", replace: true });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY") {
        setRecoverySession(true);
        setMode("reset");
        setError("");
        setMessage("");
      } else if (session && searchMode !== "reset") {
        void goToPanel();
      }
    });
    supabase.auth.getSession().then(({ data: sessionData, error: sessionError }) => {
      if (!active) return;
      if (sessionError) {
        setError(errorMessage(sessionError));
        if (searchMode === "reset") setRecoverySession(false);
      } else if (searchMode === "reset" && sessionData.session) {
        setRecoverySession(true);
        setMode("reset");
      } else if (searchMode === "reset") {
        setRecoverySession(false);
      } else if (sessionData.session && searchMode !== "reset") {
        void goToPanel();
      }
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [navigate, redirect, searchMode]);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      if (mode === "forgot" || (mode === "reset" && !recoverySession)) {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (err) throw err;
        if (mode === "reset") setMode("forgot");
        setMessage(
          "Si existe una cuenta con ese email, vas a recibir un enlace para crear una contraseña nueva.",
        );
      } else if (mode === "reset") {
        const form = new FormData(e.currentTarget);
        const password = String(form.get("password") ?? "");
        const confirmPassword = String(form.get("confirmPassword") ?? "");
        if (password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres");
        if (password !== confirmPassword) throw new Error("Las contraseñas no coinciden");
        const { error: err } = await supabase.auth.updateUser({ password });
        if (err) throw err;
        setMessage("Contraseña actualizada. Ya podés ingresar al panel.");
        await navigate({ to: (redirect ?? "/admin") as "/admin", replace: true });
      } else {
        const form = new FormData(e.currentTarget);
        const password = String(form.get("password") ?? "");
        if (password.length < 8) {
          setError("La contraseña debe tener al menos 8 caracteres");
          return;
        }
        const { error: err } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (err) throw err;
        await navigate({ to: (redirect ?? "/admin") as "/admin", replace: true });
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
          <div className="mx-auto grid size-12 place-items-center rounded-xl bg-primary font-display text-xl font-bold text-primary-foreground">
            F
          </div>
          <h1 className="mt-3 font-display text-2xl font-bold">
            {mode === "forgot"
              ? "Recuperar contraseña"
              : mode === "reset"
                ? "Crear contraseña nueva"
                : "Ingresar al panel"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "forgot"
              ? "Te enviaremos un enlace al correo de tu cuenta."
              : mode === "reset"
                ? "Elegí una contraseña segura de al menos 8 caracteres."
                : "Panel administrativo de Festiva"}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {mode === "reset" && recoverySession === null && (
            <p role="status" className="text-sm text-muted-foreground">
              Verificando el enlace de recuperación…
            </p>
          )}
          {mode === "reset" && !recoverySession && (
            <>
              <p role="alert" className="text-sm text-destructive">
                El enlace de recuperación venció, ya fue usado o no es válido. Solicitá uno nuevo.
              </p>
              <FormField label="Email" htmlFor="email">
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </FormField>
            </>
          )}
          {mode !== "reset" && (
            <FormField label="Email" htmlFor="email">
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </FormField>
          )}
          {mode !== "forgot" && (mode !== "reset" || recoverySession) && (
            <FormField
              label={mode === "reset" ? "Nueva contraseña" : "Contraseña"}
              htmlFor="password"
            >
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete={mode === "reset" ? "new-password" : "current-password"}
                minLength={8}
                required
              />
            </FormField>
          )}
          {mode === "reset" && recoverySession && (
            <FormField label="Repetir contraseña nueva" htmlFor="confirmPassword">
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </FormField>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {message && (
            <p role="status" className="text-sm text-muted-foreground">
              {message}
            </p>
          )}
          <Button
            type="submit"
            className="w-full"
            disabled={busy || (mode === "reset" && recoverySession === null)}
          >
            {busy
              ? "Un momento…"
              : mode === "forgot"
                ? "Enviar enlace de recuperación"
                : mode === "reset" && !recoverySession
                  ? "Solicitar enlace nuevo"
                  : mode === "reset"
                    ? "Guardar contraseña nueva"
                    : "Ingresar"}
          </Button>
        </form>

        {mode === "login" && (
          <button
            type="button"
            className="mt-4 w-full text-center text-sm font-medium text-primary underline-offset-4 hover:underline"
            onClick={() => {
              setError("");
              setMessage("");
              setMode("forgot");
            }}
          >
            ¿Olvidaste tu contraseña?
          </button>
        )}
        {mode !== "login" && (
          <button
            type="button"
            className="mt-4 w-full text-center text-sm font-medium text-primary underline-offset-4 hover:underline"
            onClick={() => {
              setError("");
              setMessage("");
              setMode("login");
            }}
          >
            Volver a ingresar
          </button>
        )}
        {mode === "login" && (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            ¿No tenés cuenta? Pedile al dueño que te invite desde el panel.
          </p>
        )}
      </div>
    </div>
  );
}
