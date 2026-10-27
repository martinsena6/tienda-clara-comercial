import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { myRoleQuery } from "@/lib/data";
import { signOut } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
  component: AdminLayout,
});

function AdminLayout() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const me = useQuery(myRoleQuery).data;
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AdminSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur">
            <SidebarTrigger />
            <span className="text-sm text-muted-foreground">Panel administrativo</span>
            <span className="ml-auto hidden truncate text-sm text-muted-foreground sm:inline">
              {me?.email} {me?.role === "admin" ? "· Dueño" : me?.role === "vendedor" ? "· Vendedor" : me ? "· Sin permisos" : ""}
            </span>
            <Button variant="ghost" size="sm" className="ml-auto sm:ml-0" onClick={() => signOut(qc, navigate)}><LogOut /> Salir</Button>
          </header>
          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
