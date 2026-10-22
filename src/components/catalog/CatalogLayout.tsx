import { Link, useNavigate } from "@tanstack/react-router";
import { Search, ShoppingCart } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { businessSettings } from "@/lib/domain/mock-data";
import { useCart } from "@/lib/cart";

export function SearchBar({ defaultValue = "", className }: { defaultValue?: string; className?: string }) {
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
  return (
    <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link to="/" className="flex shrink-0 items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-primary font-display text-sm font-bold text-primary-foreground">
            {businessSettings.name.charAt(0)}
          </span>
          <span className="hidden font-display font-bold sm:inline">{businessSettings.name}</span>
        </Link>
        <nav className="hidden items-center gap-5 text-sm md:flex">
          <Link to="/catalogo/productos" className="text-muted-foreground hover:text-foreground" activeProps={{ className: "text-foreground font-medium" }}>Productos</Link>
          <Link to="/catalogo/categorias" className="text-muted-foreground hover:text-foreground" activeProps={{ className: "text-foreground font-medium" }}>Categorías</Link>
        </nav>
        <SearchBar className="ml-auto w-full max-w-xs" />
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
  return (
    <div className="flex min-h-screen flex-col">
      <CatalogHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:justify-between">
          <span>{businessSettings.name} · {businessSettings.address}</span>
          <Link to="/admin" className="hover:text-foreground">Acceso administración</Link>
        </div>
      </footer>
    </div>
  );
}
