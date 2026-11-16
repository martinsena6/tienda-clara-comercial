import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { LogOut, ShoppingCart, UserRound } from "lucide-react";
import { toast } from "sonner";
import { FormField } from "@/components/admin/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CatalogLayout } from "@/components/catalog/CatalogLayout";
import { EmptyState } from "@/components/shared/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import {
  customerOrderHistoryQuery,
  customerProfileQuery,
  errorMessage,
  saveCustomerProfile,
  type CustomerOrderHistoryItem,
} from "@/lib/data";
import { formatDate, formatPrice } from "@/lib/format";

type ProfileForm = {
  full_name: string;
  phone: string;
  street: string;
  street_number: string;
  unit: string;
  neighborhood: string;
  city: string;
  province: string;
  postal_code: string;
};

const EMPTY_PROFILE: ProfileForm = {
  full_name: "",
  phone: "",
  street: "",
  street_number: "",
  unit: "",
  neighborhood: "",
  city: "",
  province: "",
  postal_code: "",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOrderHistoryItem(
  value: unknown,
): value is { name?: string; quantity?: number; unit_price?: number } {
  if (!isRecord(value)) return false;
  const name = value["name"];
  const quantity = value["quantity"];
  const unitPrice = value["unit_price"];
  return (
    (typeof name === "string" || name === undefined) &&
    (typeof quantity === "number" || quantity === undefined) &&
    (typeof unitPrice === "number" || unitPrice === undefined)
  );
}

export const Route = createFileRoute("/cuenta")({
  head: () => ({
    meta: [
      { title: "Mi cuenta — Festiva" },
      { name: "description", content: "Tus datos y pedidos en Festiva." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Cuenta,
});

function Cuenta() {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const roleQuery = useQuery({
    queryKey: ["account-user-role", session?.user.id],
    enabled: Boolean(session),
    queryFn: async () => {
      if (!session) return null;
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);
      if (error) throw error;
      const roles = (data ?? []).map((row) => row.role);
      return roles.includes("admin") ? "admin" : roles.includes("vendedor") ? "vendedor" : null;
    },
  });
  const isStaff = roleQuery.data != null;
  const profileQuery = useQuery({
    ...customerProfileQuery,
    enabled: Boolean(session) && roleQuery.data === null,
  });
  const historyQuery = useQuery({
    ...customerOrderHistoryQuery,
    enabled: Boolean(session) && roleQuery.data === null,
  });

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) toast.error(errorMessage(error));
      setSession(data.session);
      setCheckingSession(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setCheckingSession(false);
      void queryClient.invalidateQueries({ queryKey: ["my-role"] });
      void queryClient.invalidateQueries({ queryKey: ["account-user-role"] });
      void queryClient.invalidateQueries({ queryKey: ["customer-profile"] });
      void queryClient.invalidateQueries({ queryKey: ["customer-order-history"] });
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [queryClient]);

  useEffect(() => {
    const saved = profileQuery.data;
    if (!saved) return;
    setProfile({
      full_name: saved.full_name,
      phone: saved.phone,
      street: saved.street,
      street_number: saved.street_number,
      unit: saved.unit,
      neighborhood: saved.neighborhood,
      city: saved.city,
      province: saved.province,
      postal_code: saved.postal_code,
    });
  }, [profileQuery.data]);

  const update = (key: keyof ProfileForm, value: string) =>
    setProfile((current) => ({ ...current, [key]: value }));

  const authenticate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const form = new FormData(event.currentTarget);
      const email = String(form.get("email") ?? "").trim();
      const password = String(form.get("password") ?? "");
      if (password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres");

      if (registering) {
        const fullName = String(form.get("full_name") ?? "").trim();
        if (fullName.split(/\s+/).length < 2) throw new Error("Ingresá tu nombre y apellido");
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/cuenta`,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setMessage(
            "Te enviamos un correo para confirmar tu cuenta. Después vas a poder iniciar sesión.",
          );
        } else {
          setProfile((current) => ({ ...current, full_name: fullName }));
          setMessage("Cuenta creada. Completá tus datos para guardarlos para próximos pedidos.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const signInWithGoogle = async () => {
    setBusy(true);
    setMessage("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/cuenta` },
      });
      if (error) throw error;
    } catch (error) {
      setMessage(errorMessage(error));
      setBusy(false);
    }
  };

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const digits = profile.phone.replace(/\D/g, "");
    if (profile.full_name.trim().split(/\s+/).length < 2) {
      toast.error("Ingresá tu nombre y apellido");
      return;
    }
    if (digits.length < 8 || digits.length > 15) {
      toast.error("Ingresá un celular válido con código de área");
      return;
    }
    setBusy(true);
    try {
      await saveCustomerProfile({
        ...profile,
        full_name: profile.full_name.trim(),
        phone: profile.phone.trim(),
      });
      await queryClient.invalidateQueries({ queryKey: ["customer-profile"] });
      toast.success("Tus datos quedaron guardados");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    setBusy(true);
    try {
      await queryClient.cancelQueries();
      queryClient.clear();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setSession(null);
      setProfile(EMPTY_PROFILE);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  if (checkingSession || (session && roleQuery.isLoading)) {
    return (
      <CatalogLayout>
        <p className="text-center text-sm text-muted-foreground">Cargando tu cuenta…</p>
      </CatalogLayout>
    );
  }

  if (session && roleQuery.error) {
    return (
      <CatalogLayout>
        <p
          role="alert"
          className="mx-auto max-w-lg rounded-lg bg-destructive/10 p-4 text-sm text-destructive"
        >
          No pudimos verificar los permisos de esta cuenta. Actualizá la página para volver a
          intentar.
        </p>
      </CatalogLayout>
    );
  }

  if (!session) {
    return (
      <CatalogLayout>
        <div className="mx-auto max-w-md rounded-2xl border bg-card p-6 shadow-soft sm:p-8">
          <div className="text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-xl bg-primary text-primary-foreground">
              <UserRound />
            </span>
            <h1 className="mt-4 text-2xl font-bold">
              {registering ? "Crear cuenta Festiva" : "Ingresar a mi cuenta"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Guardá tus datos y consultá tus pedidos. También podés comprar como invitado, sin
              registrarte.
            </p>
          </div>
          <form onSubmit={authenticate} className="mt-6 space-y-4">
            {registering && (
              <FormField label="Nombre y apellido" htmlFor="full_name">
                <Input id="full_name" name="full_name" autoComplete="name" required />
              </FormField>
            )}
            <FormField label="Email" htmlFor="email">
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </FormField>
            <FormField label="Contraseña" htmlFor="password" hint="Al menos 8 caracteres">
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete={registering ? "new-password" : "current-password"}
                minLength={8}
                required
              />
            </FormField>
            {message && (
              <p role="status" className="text-sm text-muted-foreground">
                {message}
              </p>
            )}
            <Button className="w-full" disabled={busy}>
              {busy ? "Un momento…" : registering ? "Crear cuenta con email" : "Ingresar con email"}
            </Button>
          </form>
          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> o <span className="h-px flex-1 bg-border" />
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={busy}
            onClick={signInWithGoogle}
          >
            Continuar con Google
          </Button>
          <p className="mt-5 text-center text-sm">
            {registering ? "¿Ya tenés cuenta?" : "¿Primera vez por acá?"}{" "}
            <button
              type="button"
              className="font-medium text-primary underline-offset-4 hover:underline"
              onClick={() => {
                setRegistering((value) => !value);
                setMessage("");
              }}
            >
              {registering ? "Ingresar" : "Crear cuenta"}
            </button>
          </p>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            ¿Sos parte del equipo?{" "}
            <Link to="/auth" className="text-primary underline-offset-4 hover:underline">
              Ingresá al panel
            </Link>
          </p>
        </div>
      </CatalogLayout>
    );
  }

  if (isStaff) {
    return (
      <CatalogLayout>
        <div className="mx-auto max-w-lg rounded-2xl border bg-card p-6 text-center">
          <h1 className="text-2xl font-bold">Tu acceso es del equipo Festiva</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Las cuentas del personal y las cuentas de clientes son independientes.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <Button asChild>
              <Link to="/admin">Ir al panel</Link>
            </Button>
            <Button variant="outline" onClick={signOut} disabled={busy}>
              Salir
            </Button>
          </div>
        </div>
      </CatalogLayout>
    );
  }

  return (
    <CatalogLayout>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Mi cuenta</h1>
          <p className="mt-1 text-sm text-muted-foreground">{session.user.email}</p>
        </div>
        <Button variant="outline" onClick={signOut} disabled={busy}>
          <LogOut /> Cerrar sesión
        </Button>
      </div>

      {(profileQuery.error || historyQuery.error) && (
        <p role="alert" className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          No se pudieron cargar todos los datos de tu cuenta:{" "}
          {errorMessage(profileQuery.error ?? historyQuery.error)}
        </p>
      )}

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <form onSubmit={saveProfile} className="space-y-4 rounded-2xl border bg-card p-5">
          <div>
            <h2 className="text-lg font-semibold">Datos y dirección habitual</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Se completarán en el checkout. La compra como invitado sigue disponible.
            </p>
          </div>
          <FormField label="Nombre y apellido" htmlFor="profile-name">
            <Input
              id="profile-name"
              autoComplete="name"
              value={profile.full_name}
              onChange={(event) => update("full_name", event.target.value)}
              required
            />
          </FormField>
          <FormField label="Celular" htmlFor="profile-phone">
            <Input
              id="profile-phone"
              type="tel"
              autoComplete="tel"
              value={profile.phone}
              onChange={(event) => update("phone", event.target.value)}
              required
            />
          </FormField>
          <div className="grid grid-cols-2 gap-2">
            <Input
              aria-label="Calle habitual"
              placeholder="Calle"
              autoComplete="address-line1"
              value={profile.street}
              onChange={(event) => update("street", event.target.value)}
            />
            <Input
              aria-label="Número habitual"
              placeholder="Número"
              value={profile.street_number}
              onChange={(event) => update("street_number", event.target.value)}
            />
            <Input
              aria-label="Piso o departamento habitual"
              placeholder="Piso/depto"
              value={profile.unit}
              onChange={(event) => update("unit", event.target.value)}
            />
            <Input
              aria-label="Barrio habitual"
              placeholder="Barrio"
              autoComplete="address-level3"
              value={profile.neighborhood}
              onChange={(event) => update("neighborhood", event.target.value)}
            />
            <Input
              aria-label="Localidad habitual"
              placeholder="Localidad"
              autoComplete="address-level2"
              value={profile.city}
              onChange={(event) => update("city", event.target.value)}
            />
            <Input
              aria-label="Provincia habitual"
              placeholder="Provincia"
              autoComplete="address-level1"
              value={profile.province}
              onChange={(event) => update("province", event.target.value)}
            />
          </div>
          <Input
            aria-label="Código postal habitual"
            placeholder="Código postal"
            autoComplete="postal-code"
            value={profile.postal_code}
            onChange={(event) => update("postal_code", event.target.value)}
          />
          <Button type="submit" className="w-full" disabled={busy || profileQuery.isLoading}>
            {busy ? "Guardando…" : "Guardar mis datos"}
          </Button>
        </form>

        <section className="space-y-4 rounded-2xl border bg-card p-5">
          <div>
            <h2 className="text-lg font-semibold">Mis pedidos</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Pedidos creados con tu cuenta iniciada.
            </p>
          </div>
          {historyQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando pedidos…</p>
          ) : !historyQuery.error && historyQuery.data?.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title="Todavía no tenés pedidos"
              description="Cuando hagas un pedido con tu cuenta iniciada, lo vas a encontrar acá."
            />
          ) : (
            <ul className="divide-y">
              {(historyQuery.data ?? []).map((order: CustomerOrderHistoryItem) => {
                const status =
                  order.status === "cancelado"
                    ? "Cancelado"
                    : order.delivered_at
                      ? "Entregado"
                      : order.status === "confirmado"
                        ? "Confirmado"
                        : "Pendiente";
                const items = Array.isArray(order.items)
                  ? order.items.filter(isOrderHistoryItem)
                  : [];
                const address = isRecord(order.delivery_address)
                  ? Object.values(order.delivery_address)
                      .filter(
                        (value): value is string => typeof value === "string" && Boolean(value),
                      )
                      .join(", ")
                  : "";
                return (
                  <li key={order.order_id} className="py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="font-medium">Pedido #{order.order_number}</h3>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(order.created_at)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatPrice(Number(order.total))}</p>
                        <p className="text-xs text-primary">{status}</p>
                      </div>
                    </div>
                    <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                      {items.map((item, index) => (
                        <li key={`${order.order_id}-${index}`}>
                          {Number(item.quantity)} × {item.name} —{" "}
                          {formatPrice(Number(item.unit_price) * Number(item.quantity))}
                        </li>
                      ))}
                    </ul>
                    {order.delivery_method === "envio" && (
                      <p className="mt-2 text-xs text-muted-foreground">Envío: {address}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </CatalogLayout>
  );
}
