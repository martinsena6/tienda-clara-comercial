import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Boxes,
  LayoutDashboard,
  Package,
  PackageSearch,
  Settings,
  ShoppingBag,
  Store,
  Wallet,
} from "lucide-react";
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
import { useQuery } from "@tanstack/react-query";
import { DEFAULT_SETTINGS, publicSettingsQuery, useMyRole } from "@/lib/data";

interface Item {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
}

const groups: { label: string; items: Item[] }[] = [
  {
    label: "General",
    items: [{ title: "Inicio / Rentabilidad", url: "/admin", icon: BarChart3 }],
  },
  {
    label: "Catálogo y Stock",
    items: [
      { title: "Productos", url: "/admin/productos", icon: Package },
      { title: "Stock y Vencimientos", url: "/admin/stock", icon: Boxes },
      { title: "Reposición", url: "/admin/reposicion", icon: PackageSearch, adminOnly: true },
    ],
  },
  {
    label: "Operaciones",
    items: [
      { title: "Ventas (Pedidos)", url: "/admin/ventas", icon: ShoppingBag },
      { title: "Gastos", url: "/admin/gastos", icon: Wallet, adminOnly: true },
    ],
  },
  {
    label: "Sistema",
    items: [
      { title: "Configuración", url: "/admin/configuracion", icon: Settings, adminOnly: true },
    ],
  },
];

export function AdminSidebar() {
  const name = useQuery(publicSettingsQuery).data?.name ?? DEFAULT_SETTINGS.name;
  const { isAdmin } = useMyRole();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (url: string) =>
    url === "/admin" ? path === "/admin" || path === "/admin/" : path.startsWith(url);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-1 py-1.5">
          <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-sidebar-primary font-display text-sm font-bold text-sidebar-primary-foreground">
            {name.charAt(0)}
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <div className="truncate font-display text-sm font-semibold">{name}</div>
            <div className="text-xs opacity-70">Panel administrativo</div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((g) => {
          const items = g.items.filter((i) => !i.adminOnly || isAdmin);
          if (items.length === 0) return null;
          return (
            <SidebarGroup key={g.label}>
              <SidebarGroupLabel>{g.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => (
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
          );
        })}
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
