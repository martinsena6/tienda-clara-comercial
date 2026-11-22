import { Link, useNavigate } from "@tanstack/react-router";
import { Minus, Plus, Search, ShoppingCart, UserRound } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DEFAULT_PUBLIC_SETTINGS,
  myRoleQuery,
  publicProductsQuery,
  publicSettingsQuery,
} from "@/lib/data";
import { signOut, useSession } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { searchPublicProducts } from "@/lib/domain/catalog";
import { formatPrice } from "@/lib/format";
import { ProductImage } from "./ProductImage";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

/** Datos del negocio con respaldo por si la base todavía no responde. */
export function useSettings() {
  const { data } = useQuery(publicSettingsQuery);
  return data ?? DEFAULT_PUBLIC_SETTINGS;
}

export function SearchBar({
  defaultValue = "",
  className,
}: {
  defaultValue?: string | undefined;
  className?: string;
}) {
  const [q, setQ] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data: products = [] } = useQuery(publicProductsQuery);
  const term = q.trim();
  const suggestions = term.length >= 2 ? searchPublicProducts(products, term).slice(0, 6) : [];
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setOpen(false);
    navigate({ to: "/catalogo/productos", search: { q: term || undefined } });
  };
  return (
    <form
      onSubmit={submit}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
      className={`relative ${className ?? ""}`}
      role="search"
    >
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          placeholder="Buscar productos…"
          aria-label="Buscar productos"
          aria-autocomplete="list"
          aria-expanded={open && term.length >= 2}
          className="h-10 rounded-full bg-card pl-9"
        />
      </div>
      {open && term.length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border bg-card shadow-lg">
          {suggestions.length ? (
            <ul
              role="listbox"
              aria-label="Sugerencias de productos"
              className="max-h-96 overflow-y-auto"
            >
              {suggestions.map((product) => (
                <li key={product.slug} role="option" aria-selected={false}>
                  <Link
                    to="/catalogo/producto/$slug"
                    params={{ slug: product.slug }}
                    onClick={() => {
                      setQ("");
                      setOpen(false);
                    }}
                    className="flex items-center gap-3 p-2 hover:bg-muted"
                  >
                    <ProductImage
                      src={product.images[0] || product.image}
                      alt=""
                      className="size-11 shrink-0 rounded-md"
                      imgClassName="size-11 rounded-md object-cover"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{product.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {product.categoryName}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold">
                      {formatPrice(product.price)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-3 text-sm text-muted-foreground">No encontramos coincidencias.</p>
          )}
          <Link
            to="/catalogo/productos"
            search={{ q: term }}
            onClick={() => setOpen(false)}
            className="block border-t px-3 py-3 text-sm font-medium text-primary hover:bg-muted"
          >
            Ver todos los resultados para “{term}”
          </Link>
        </div>
      )}
    </form>
  );
}

function CatalogHeader() {
  const { count, items, setQuantity, remove } = useCart();
  const [cartOpen, setCartOpen] = useState(false);
  const { data: products = [] } = useQuery(publicProductsQuery);
  const settings = useSettings();
  const email = useSession();
  const { data: roleData } = useQuery(myRoleQuery);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link to="/" className="flex shrink-0 items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-primary font-display text-sm font-bold text-primary-foreground">
            {settings.name.charAt(0)}
          </span>
          <span className="hidden font-display font-bold sm:inline">{settings.name}</span>
        </Link>
        <nav className="hidden items-center gap-5 text-sm md:flex">
          <Link
            to="/catalogo/categorias"
            className="text-muted-foreground hover:text-foreground"
            activeProps={{ className: "text-foreground font-medium" }}
          >
            Categorías
          </Link>
        </nav>
        <SearchBar className="ml-auto w-full max-w-xs" />
        {email && roleData?.role ? (
          <div className="flex shrink-0 items-center gap-1">
            <Button asChild variant="outline" size="sm">
              <Link to="/admin">
                <UserRound /> Panel
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => signOut(queryClient, navigate)}>
              Salir
            </Button>
          </div>
        ) : (
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link to="/cuenta">
              <UserRound /> {email ? "Mi cuenta" : "Ingresar"}
            </Link>
          </Button>
        )}
        <Sheet open={cartOpen} onOpenChange={setCartOpen}>
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="relative grid size-10 shrink-0 place-items-center rounded-full border bg-card hover:bg-muted"
            aria-label={`Abrir mini carrito, ${count} productos`}
          >
            <ShoppingCart className="size-4" />
            {count > 0 && (
              <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-accent px-1 text-xs font-bold text-accent-foreground">
                {count}
              </span>
            )}
          </button>
          <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
            <SheetHeader>
              <SheetTitle>Tu carrito</SheetTitle>
            </SheetHeader>
            <div className="flex-1 space-y-3 overflow-y-auto py-4">
              {Object.entries(items).length === 0 ? (
                <p className="text-sm text-muted-foreground">Todavía no agregaste productos.</p>
              ) : (
                Object.entries(items).map(([slug, quantity]) => {
                  const product = products.find((item) => item.slug === slug);
                  if (!product) return null;
                  return (
                    <div key={slug} className="flex items-center gap-3">
                      <ProductImage
                        src={product.images[0] || product.image}
                        alt=""
                        className="size-12 shrink-0 rounded-md"
                        imgClassName="size-12 rounded-md object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{product.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatPrice(product.price * quantity)}
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Quitar una unidad de ${product.name}`}
                        onClick={() =>
                          quantity <= 1 ? remove(slug) : setQuantity(slug, quantity - 1)
                        }
                      >
                        <Minus />
                      </Button>
                      <span className="text-sm">{quantity}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Agregar una unidad de ${product.name}`}
                        onClick={() => setQuantity(slug, quantity + 1)}
                      >
                        <Plus />
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
            <Button asChild onClick={() => setCartOpen(false)}>
              <Link to="/catalogo/carrito">Ver carrito y pedir</Link>
            </Button>
          </SheetContent>
        </Sheet>
      </div>
      <nav className="mx-auto flex max-w-6xl gap-5 px-4 pb-2 text-sm md:hidden">
        <Link
          to="/catalogo/categorias"
          className="text-muted-foreground"
          activeProps={{ className: "text-foreground font-medium" }}
        >
          Categorías
        </Link>
      </nav>
    </header>
  );
}

export function CatalogLayout({ children }: { children: ReactNode }) {
  const settings = useSettings();
  return (
    <div className="flex min-h-screen flex-col">
      <CatalogHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:justify-between">
          <span>
            {settings.name} · {settings.address}
          </span>
          <span className="flex flex-wrap gap-3">
            {settings.instagram && (
              <a
                href={`https://instagram.com/${settings.instagram.replace(/^@/, "").trim()}`}
                target="_blank"
                rel="noreferrer"
                className="hover:text-foreground"
              >
                Instagram
              </a>
            )}
            {settings.tiktok && (
              <a
                href={`https://www.tiktok.com/@${settings.tiktok.replace(/^@\s*/, "").trim()}`}
                target="_blank"
                rel="noreferrer"
                className="hover:text-foreground"
              >
                TikTok
              </a>
            )}
          </span>
          <span>{settings.hours}</span>
        </div>
      </footer>
    </div>
  );
}
