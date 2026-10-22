import { Link, useRouterState } from "@tanstack/react-router";
import { BarChart3, Boxes, LayoutDashboard, Package, Settings, ShoppingBag, Store, Truck, Wallet } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { businessSettings } from "@/lib/domain/mock-data";

const groups = [
  { label: "General", items: [{ title: "Inicio", url: "/admin", icon: LayoutDashboard }] },
  {
    label: "Inventario",
    items: [
      { title: "Productos", url: "/admin/productos", icon: Package },
      { title: "Stock", url: "/admin/stock", icon: Boxes },
    ],
  },
  {
    label: "Operaciones",
    items: [
      { title: "Ventas", url: "/admin/ventas", icon: ShoppingBag },
      { title: "Compras", url: "/admin/compras", icon: Truck },
      { title: "Gastos", url: "/admin/gastos", icon: Wallet },
      { title: "Rentabilidad", url: "/admin/rentabilidad", icon: BarChart3 },
    ],
  },
  { label: "Negocio", items: [{ title: "Configuración", url: "/admin/configuracion", icon: Settings }] },
] as const;

export function AdminSidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (url: string) => (url === "/admin" ? path === "/admin" || path === "/admin/" : path.startsWith(url));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-1 py-1.5">
          <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-sidebar-primary font-display text-sm font-bold text-sidebar-primary-foreground">
            {businessSettings.name.charAt(0)}
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <div className="truncate font-display text-sm font-semibold">{businessSettings.name}</div>
            <div className="text-xs opacity-70">Panel administrativo</div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((g) => (
          <SidebarGroup key={g.label}>
            <SidebarGroupLabel>{g.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                      <Link to={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Ver catálogo">
              <Link to="/">
                <Store />
                <span>Ver catálogo público</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

