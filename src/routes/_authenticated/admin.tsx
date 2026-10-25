import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

// Próxima etapa: proteger con inicio de sesión y roles (admin / vendedor).
export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AdminSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur">
            <SidebarTrigger />
            <span className="text-sm text-muted-foreground">Panel administrativo</span>
            <span className="ml-auto rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">Datos de ejemplo</span>
          </header>
          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
