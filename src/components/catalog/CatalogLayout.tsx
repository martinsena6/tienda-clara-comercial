import { Link, useNavigate } from "@tanstack/react-router";
import { Search, ShoppingCart, UserRound } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEFAULT_SETTINGS, settingsQuery } from "@/lib/data";
import { signOut, useSession } from "@/lib/auth";
import { useCart } from "@/lib/cart";

/** Datos del negocio con respaldo por si la base todavía no responde. */
export function useSettings() {
  const { data } = useQuery(settingsQuery);
  return data ?? DEFAULT_SETTINGS;
}

export function SearchBar({ defaultValue = "", className }: { defaultValue?: string | undefined; className?: string }) {
  const [q, setQ] = useState(defaultValue);
  const navigate = useNavigate();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    navigate({ to: "/catalogo/productos", search: { q: q.trim() || undefined } });
  };
  return (
    <form onSubmit={submit} className={className} role="search">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar productos…" aria-label="Buscar productos" className="h-10 rounded-full bg-card pl-9" />
      </div>
    </form>
  );
}

function CatalogHeader() {
  const { count } = useCart();
  const settings = useSettings();
  const email = useSession();
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
          <Link to="/catalogo/productos" className="text-muted-foreground hover:text-foreground" activeProps={{ className: "text-foreground font-medium" }}>Productos</Link>
          <Link to="/catalogo/categorias" className="text-muted-foreground hover:text-foreground" activeProps={{ className: "text-foreground font-medium" }}>Categorías</Link>
        </nav>
        <SearchBar className="ml-auto w-full max-w-xs" />
        {email ? (
          <div className="flex shrink-0 items-center gap-1">
            <Button asChild variant="outline" size="sm">
              <Link to="/admin"><UserRound /> Panel</Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => signOut(queryClient, navigate)}>Salir</Button>
          </div>
        ) : (
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link to="/auth"><UserRound /> Ingresar</Link>
          </Button>
        )}
        <Link to="/catalogo/carrito" className="relative grid size-10 shrink-0 place-items-center rounded-full border bg-card hover:bg-muted" aria-label={`Carrito, ${count} productos`}>
          <ShoppingCart className="size-4" />
          {count > 0 && (
            <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-accent px-1 text-xs font-bold text-accent-foreground">{count}</span>
          )}
        </Link>
      </div>
      <nav className="mx-auto flex max-w-6xl gap-5 px-4 pb-2 text-sm md:hidden">
        <Link to="/catalogo/productos" className="text-muted-foreground" activeProps={{ className: "text-foreground font-medium" }}>Productos</Link>
        <Link to="/catalogo/categorias" className="text-muted-foreground" activeProps={{ className: "text-foreground font-medium" }}>Categorías</Link>
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
          <span>{settings.name} · {settings.address}</span>
          <span className="flex flex-wrap gap-3">
            {settings.instagram && (
              <a href={`https://instagram.com/${settings.instagram.replace(/^@/, "").trim()}`} target="_blank" rel="noreferrer" className="hover:text-foreground">Instagram</a>
            )}
            {settings.tiktok && (
              <a href={`https://www.tiktok.com/@${settings.tiktok.replace(/^@\s*/, "").trim()}`} target="_blank" rel="noreferrer" className="hover:text-foreground">TikTok</a>
            )}
          </span>
          <span>{settings.hours}</span>
        </div>
      </footer>
    </div>
  );
}
