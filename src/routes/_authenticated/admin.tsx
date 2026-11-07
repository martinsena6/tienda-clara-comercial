import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, ShieldX } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { useMyRole } from "@/lib/data";
import { signOut } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
  component: AdminLayout,
});

function AdminLayout() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { role, email, loading } = useMyRole();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        Cargando…
      </div>
    );
  }

  // Guardia por rol: sin rol no entra al panel, aunque tenga cuenta.
  if (!role) {
    return (
      <div className="grid min-h-screen place-items-center bg-secondary px-4">
        <div className="w-full max-w-sm rounded-2xl border bg-card p-8 text-center shadow-lift">
          <ShieldX className="mx-auto size-10 text-muted-foreground" />
          <h1 className="mt-4 text-lg font-semibold">Tu cuenta todavía no tiene permisos</h1>
          <p className="mt-1 text-sm text-muted-foreground">Pedile acceso al dueño del negocio.</p>
          <Button variant="outline" className="mt-6" onClick={() => signOut(qc, navigate)}>
            <LogOut /> Salir
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AdminSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur">
            <SidebarTrigger />
            <span className="text-sm text-muted-foreground">Panel administrativo</span>
            <Badge variant="secondary" className="text-xs">
              Beta
            </Badge>
            <span className="ml-auto hidden truncate text-sm text-muted-foreground sm:inline">
              {email}{" "}
              {role === "admin"
                ? "· Dueño de la app"
                : role === "propietario_local"
                  ? "· Dueño/a del local"
                  : "· Vendedor"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto sm:ml-0"
              onClick={() => signOut(qc, navigate)}
            >
              <LogOut /> Salir
            </Button>
          </header>
          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
