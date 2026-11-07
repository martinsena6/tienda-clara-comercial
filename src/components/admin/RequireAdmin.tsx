import type { ReactNode } from "react";
import { ShieldX } from "lucide-react";
import { useMyRole } from "@/lib/data";

/** Bloquea secciones operativas de administración a las cuentas de vendedor. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { role, loading } = useMyRole();
  if (loading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (role !== "admin") {
    return (
      <div className="mx-auto mt-16 max-w-sm rounded-2xl border bg-card p-8 text-center shadow-soft">
        <ShieldX className="mx-auto size-10 text-muted-foreground" />
        <h1 className="mt-4 text-lg font-semibold">Sección solo para administración</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Esta sección requiere permisos de administración del negocio.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
