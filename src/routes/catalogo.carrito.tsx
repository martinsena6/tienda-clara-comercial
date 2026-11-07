import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MessageCircle, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/admin/FormField";
import { CatalogLayout, useSettings } from "@/components/catalog/CatalogLayout";
import { EmptyState } from "@/components/shared/EmptyState";
import { useCart } from "@/lib/cart";
import {
  createOrder,
  customerProfileQuery,
  errorMessage,
  publicProductsQuery,
  todayAR,
  type CustomerData,
} from "@/lib/data";
import { formatPrice } from "@/lib/format";
import { useSession } from "@/lib/auth";

export const Route = createFileRoute("/catalogo/carrito")({
  head: () => ({
    meta: [
      { title: "Tu carrito — Festiva" },
      { name: "description", content: "Revisá tu pedido y envialo por WhatsApp." },
      { property: "og:title", content: "Tu carrito — Festiva" },
      { property: "og:description", content: "Revisá tu pedido y envialo por WhatsApp." },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(publicProductsQuery),
  errorComponent: ({ error }) => (
    <CatalogLayout>
      <p role="alert" className="text-center text-muted-foreground">
        No pudimos cargar el carrito. {error instanceof Error ? error.message : ""}
      </p>
    </CatalogLayout>
  ),
  component: Carrito,
});

const SAVED_KEY = "festiva-cliente";
const EMPTY: CustomerData = {
  name: "",
  phone: "",
  email: "",
  delivery: "retiro",
  street: "",
  street_number: "",
  unit: "",
  neighborhood: "",
  city: "Resistencia",
  province: "Chaco",
  postal_code: "",
  event_date: "",
  notes: "",
};

/** Celular argentino: 10 dígitos de área+número, aceptando +54, 9, 0 y 15. */
export function normalizeArPhone(raw: string): string | null {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("54")) d = d.slice(2);
  if (d.startsWith("9") && d.length === 11) d = d.slice(1);
  if (d.startsWith("0")) d = d.slice(1);
  if (d.length === 12 && /^\d{2,4}15/.test(d)) d = d.replace(/^(\d{2,4})15/, "$1");
  return d.length === 10 ? d : null;
}

function Carrito() {
  const { items, setQuantity, remove } = useCart();
  const { data: products } = useSuspenseQuery(publicProductsQuery);
  const sessionEmail = useSession();
  const profileQuery = useQuery({
    ...customerProfileQuery,
    enabled: Boolean(sessionEmail),
  });
  const navigate = useNavigate();
  const [c, setC] = useState<CustomerData>(EMPTY);
  const [customerEdited, setCustomerEdited] = useState(false);
  const [hp, setHp] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof CustomerData, v: string) => {
    setCustomerEdited(true);
    setC((x) => ({ ...x, [k]: v }));
  };

  useEffect(() => {
    try {
      const s = localStorage.getItem(SAVED_KEY);
      if (s) setC({ ...EMPTY, ...JSON.parse(s), event_date: "", notes: "" });
    } catch {
      /* sin almacenamiento */
    }
  }, []);

  useEffect(() => {
    const saved = profileQuery.data;
    if (!saved || customerEdited) return;
    setC((current) => ({
      ...current,
      name: saved.full_name || current.name,
      phone: saved.phone || current.phone,
      email: sessionEmail || current.email,
      street: saved.street,
      street_number: saved.street_number,
      unit: saved.unit,
      neighborhood: saved.neighborhood,
      city: saved.city || current.city,
      province: saved.province || current.province,
      postal_code: saved.postal_code,
    }));
  }, [customerEdited, profileQuery.data, sessionEmail]);

  const lines = Object.entries(items)
    .map(([slug, quantity]) => ({ product: products.find((p) => p.slug === slug), quantity }))
    .filter(
      (l): l is { product: NonNullable<typeof l.product>; quantity: number } =>
        Boolean(l.product) && l.quantity > 0,
    );
  const total = lines.reduce((s, l) => s + l.product.price * l.quantity, 0);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (c.name.trim().split(/\s+/).length < 2) return setErr("Ingresá tu nombre y apellido");
    const phone = normalizeArPhone(c.phone);
    if (!phone) return setErr("Ingresá un celular válido con código de área (ej: 362 5436293)");
    if (
      c.delivery === "envio" &&
      (!c.street.trim() ||
        !c.street_number.trim() ||
        !c.city.trim() ||
        !c.province.trim() ||
        !c.postal_code.trim())
    )
      return setErr("Completá calle, número, localidad, provincia y código postal");
    if (c.event_date && c.event_date < todayAR())
      return setErr("La fecha del evento no puede ser pasada");
    setBusy(true);
    try {
      const data = { ...c, name: c.name.trim(), phone };
      const order = await createOrder(
        lines.map((l) => ({ slug: l.product.slug, quantity: l.quantity })),
        data,
        hp,
      );
      try {
        localStorage.setItem(SAVED_KEY, JSON.stringify({ ...data, event_date: "", notes: "" }));
      } catch {
        /* sin almacenamiento */
      }
      const address =
        c.delivery === "envio"
          ? [c.street, c.city, c.province, c.postal_code].filter(Boolean).join(", ")
          : "";
      const payload = {
        number: order.order_number,
        total: order.total,
        items: order.items,
        name: data.name,
        phone,
        delivery: c.delivery,
        address,
        eventDate: c.event_date,
        notes: c.notes.trim(),
      };
      try {
        sessionStorage.setItem(`festiva-pedido-${order.order_number}`, JSON.stringify(payload));
      } catch {
        /* sin almacenamiento */
      }
      await navigate({
        to: "/catalogo/pedido/$numero",
        params: { numero: String(order.order_number) },
      });
    } catch (e2) {
      setErr(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <CatalogLayout>
      <h1 className="text-3xl font-bold">Tu carrito</h1>
      {lines.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={ShoppingCart}
            title="Tu carrito está vacío"
            description="Agregá productos del catálogo para armar tu pedido."
            action={
              <Button asChild>
                <Link to="/catalogo/productos">Ver productos</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
          <ul className="divide-y rounded-2xl border bg-card">
            {lines.map(({ product, quantity }) => (
              <li key={product.slug} className="flex gap-4 p-4">
                <img
                  src={product.image}
                  alt={product.name}
                  width={816}
                  height={816}
                  loading="lazy"
                  className="size-20 rounded-lg object-cover"
                />
                <div className="flex flex-1 flex-col gap-2">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{product.name}</span>
                    <span className="font-display font-bold">
                      {formatPrice(product.price * quantity)}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatPrice(product.price)} c/u
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="outline"
                      className="size-8"
                      onClick={() => setQuantity(product.slug, quantity - 1)}
                      aria-label="Restar"
                    >
                      <Minus />
                    </Button>
                    <span className="w-6 text-center text-sm">{quantity}</span>
                    <Button
                      size="icon"
                      variant="outline"
                      className="size-8"
                      onClick={() => setQuantity(product.slug, quantity + 1)}
                      aria-label="Sumar"
                    >
                      <Plus />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto text-muted-foreground"
                      onClick={() => remove(product.slug)}
                    >
                      <Trash2 /> Quitar
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <aside className="h-fit space-y-4 rounded-2xl border bg-card p-5 shadow-soft">
            <div className="flex justify-between text-lg">
              <span>Total estimado</span>
              <span className="font-display font-bold">{formatPrice(total)}</span>
            </div>
            <form onSubmit={send} className="space-y-3">
              <FormField label="Nombre y apellido *" htmlFor="c-name">
                <Input
                  id="c-name"
                  value={c.name}
                  onChange={(e) => set("name", e.target.value)}
                  maxLength={120}
                  autoComplete="name"
                  required
                />
              </FormField>
              <FormField
                label="Celular con WhatsApp *"
                htmlFor="c-phone"
                hint="Con código de área, ej: 362 5436293"
              >
                <Input
                  id="c-phone"
                  type="tel"
                  value={c.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  maxLength={25}
                  autoComplete="tel"
                  required
                />
              </FormField>
              <FormField label="Email (opcional)" htmlFor="c-email">
                <Input
                  id="c-email"
                  type="email"
                  value={c.email}
                  onChange={(e) => set("email", e.target.value)}
                  maxLength={120}
                  autoComplete="email"
                />
              </FormField>
              {!sessionEmail && (
                <p className="text-xs text-muted-foreground">
                  ¿Pedís seguido?{" "}
                  <Link
                    to="/cuenta"
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Ingresá o creá una cuenta
                  </Link>{" "}
                  para guardar tus datos. También podés continuar como invitado.
                </p>
              )}
              {profileQuery.error && (
                <p role="alert" className="text-xs text-destructive">
                  No se pudieron precargar tus datos guardados: {errorMessage(profileQuery.error)}
                </p>
              )}
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Entrega">
                {(["retiro", "envio"] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    role="radio"
                    aria-checked={c.delivery === d}
                    onClick={() => set("delivery", d)}
                    className={`rounded-md border px-3 py-2 text-sm ${c.delivery === d ? "border-primary bg-primary/10 font-medium" : "bg-card"}`}
                  >
                    {d === "retiro" ? "Retiro en el local" : "Envío a domicilio"}
                  </button>
                ))}
              </div>
              {c.delivery === "envio" && (
                <div className="space-y-2">
                  <Input
                    aria-label="Calle"
                    placeholder="Calle *"
                    value={c.street}
                    onChange={(e) => set("street", e.target.value)}
                    maxLength={150}
                    required
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      aria-label="Número"
                      placeholder="Número *"
                      value={c.street_number}
                      onChange={(e) => set("street_number", e.target.value)}
                      maxLength={20}
                      required
                    />
                    <Input
                      aria-label="Piso o departamento"
                      placeholder="Piso/depto"
                      value={c.unit}
                      onChange={(e) => set("unit", e.target.value)}
                      maxLength={40}
                    />
                  </div>
                  <Input
                    aria-label="Barrio"
                    placeholder="Barrio"
                    value={c.neighborhood}
                    onChange={(e) => set("neighborhood", e.target.value)}
                    maxLength={80}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      aria-label="Localidad"
                      placeholder="Localidad *"
                      value={c.city}
                      onChange={(e) => set("city", e.target.value)}
                      maxLength={80}
                    />
                    <Input
                      aria-label="Provincia"
                      placeholder="Provincia *"
                      value={c.province}
                      onChange={(e) => set("province", e.target.value)}
                      maxLength={80}
                      required
                    />
                  </div>
                  <Input
                    aria-label="Código postal"
                    placeholder="Código postal *"
                    value={c.postal_code}
                    onChange={(e) => set("postal_code", e.target.value)}
                    maxLength={12}
                    required
                  />
                </div>
              )}
              <FormField label="Fecha del evento o entrega (opcional)" htmlFor="c-date">
                <Input
                  id="c-date"
                  type="date"
                  min={todayAR()}
                  value={c.event_date}
                  onChange={(e) => set("event_date", e.target.value)}
                />
              </FormField>
              <FormField
                label="Aclaraciones (opcional)"
                htmlFor="c-notes"
                hint={`${c.notes.length}/300`}
              >
                <textarea
                  id="c-notes"
                  value={c.notes}
                  onChange={(e) => set("notes", e.target.value.slice(0, 300))}
                  rows={2}
                  className="w-full rounded-md border bg-card px-3 py-2 text-sm"
                />
              </FormField>
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                value={hp}
                onChange={(e) => setHp(e.target.value)}
                className="absolute -left-[9999px] h-px w-px opacity-0"
              />
              {err && (
                <p
                  role="alert"
                  className="rounded-md bg-destructive/10 p-2 text-sm text-destructive"
                >
                  {err}
                </p>
              )}
              <Button
                type="submit"
                size="lg"
                className="w-full bg-whatsapp text-whatsapp-foreground hover:bg-whatsapp/90"
                disabled={busy}
              >
                <MessageCircle /> {busy ? "Registrando…" : "Registrar pedido"}
              </Button>
            </form>
            <p className="text-xs text-muted-foreground">
              Tu pedido queda pendiente hasta que el negocio confirme disponibilidad. No se realiza
              ningún cobro online.
            </p>
          </aside>
        </div>
      )}
    </CatalogLayout>
  );
}
