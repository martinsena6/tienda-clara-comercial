// Acceso a los datos guardados (fuente única de productos, precios y configuración).
import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
// Algunas tablas/funciones del código todavía no figuran en los tipos generados.
const db = supabase as unknown as SupabaseClient;
import type { Availability, PublicProduct } from "./domain/types";
import combo_misky_10 from "@/assets/combo-misky-10.jpg.asset.json";
import combo_misky_20 from "@/assets/combo-misky-20.jpg.asset.json";
import combo_eco_10 from "@/assets/combo-eco-10.jpg.asset.json";
import combo_eco_20 from "@/assets/combo-eco-20.jpg.asset.json";
import combo_eco_40 from "@/assets/combo-eco-40.jpg.asset.json";
import bola_loca_futbol from "@/assets/bola-loca-futbol.jpg.asset.json";
import chupetin_emoji from "@/assets/chupetin-emoji.jpg.asset.json";
import chupetin_cebollita from "@/assets/chupetin-cebollita.jpg.asset.json";
import chupetin_pico_dulce from "@/assets/chupetin-pico-dulce.jpg.asset.json";
import goma_mogul_anillos from "@/assets/goma-mogul-anillos.jpg.asset.json";
import docigoma_gajo from "@/assets/docigoma-gajo.jpg.asset.json";
import goma_ricomas_jelly from "@/assets/goma-ricomas-jelly.jpg.asset.json";
import goma_pinata from "@/assets/goma-pinata.jpg.asset.json";
import goma_fierita_roll from "@/assets/goma-fierita-roll.jpg.asset.json";

const ASSETS: Record<string, string> = {
  "combo-misky-10": combo_misky_10.url,
  "combo-misky-20": combo_misky_20.url,
  "combo-eco-10": combo_eco_10.url,
  "combo-eco-20": combo_eco_20.url,
  "combo-eco-40": combo_eco_40.url,
  "bola-loca-futbol": bola_loca_futbol.url,
  "chupetin-emoji": chupetin_emoji.url,
  "chupetin-cebollita": chupetin_cebollita.url,
  "chupetin-pico-dulce": chupetin_pico_dulce.url,
  "goma-mogul-anillos": goma_mogul_anillos.url,
  "docigoma-gajo": docigoma_gajo.url,
  "goma-ricomas-jelly": goma_ricomas_jelly.url,
  "goma-pinata": goma_pinata.url,
  "goma-fierita-roll": goma_fierita_roll.url,
};

/** Convierte lo guardado en la base en una dirección de imagen usable. */
export function resolveImage(v: string): string {
  if (!v || v.startsWith("data:")) return "";
  if (v.startsWith("asset:")) return ASSETS[v.slice(6)] ?? "";
  return v;
}

function imageUrlList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (image): image is string =>
      typeof image === "string" && Boolean(image.trim()) && !image.startsWith("data:"),
  );
}

export const publicProductsQuery = queryOptions({
  queryKey: ["public-products"],
  queryFn: async (): Promise<PublicProduct[]> => {
    const { data, error } = await supabase.rpc("get_public_products");
    if (error) throw error;
    return (data ?? []).map((p) => ({
      slug: p.slug,
      name: p.name,
      categorySlug: p.category_slug,
      categoryName: p.category_name,
      description: p.description,
      image: resolveImage(p.image_url),
      images: (Array.isArray(p.image_urls) ? p.image_urls : p.image_url ? [p.image_url] : [])
        .map((image) => resolveImage(String(image)))
        .filter(Boolean),
      price: Number(p.price),
      availability: p.availability as Availability,
      featured: Boolean(p.featured),
      badge: String(p.badge ?? ""),
    }));
  },
});

export const bestsellersQuery = queryOptions({
  queryKey: ["public-bestsellers"],
  queryFn: async () => {
    const { data, error } = await supabase.rpc("get_public_bestsellers");
    if (error) throw error;
    return data ?? [];
  },
});

export const customerProfileQuery = queryOptions({
  queryKey: ["customer-profile"],
  queryFn: async () => {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!userData.user) return null;
    const { data, error } = await db
      .from("customer_profiles")
      .select("*")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
    const metadata = userData.user.user_metadata ?? {};
    return {
      user_id: userData.user.id,
      full_name: String(metadata["full_name"] ?? metadata["name"] ?? ""),
      phone: String(metadata["phone"] ?? ""),
      street: "",
      street_number: "",
      unit: "",
      neighborhood: "",
      city: "",
      province: "",
      postal_code: "",
      updated_at: "",
    };
  },
});

export const customerOrderHistoryQuery = queryOptions({
  queryKey: ["customer-order-history"],
  queryFn: async () => {
    const { data, error } = await db.rpc("customer_order_history");
    if (error) throw error;
    return data ?? [];
  },
});

export async function saveCustomerProfile(input: {
  full_name: string;
  phone: string;
  street: string;
  street_number: string;
  unit: string;
  neighborhood: string;
  city: string;
  province: string;
  postal_code: string;
}) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("Iniciá sesión para guardar tus datos");
  const { error } = await db
    .from("customer_profiles")
    .upsert(
      { ...input, user_id: userData.user.id, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  if (error) throw error;
}

export const staffProfileQuery = queryOptions({
  queryKey: ["staff-profile"],
  queryFn: async () => {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!userData.user) throw new Error("Iniciá sesión para ver tu perfil");
    const { data, error } = await db
      .from("staff_profiles")
      .select("user_id, full_name, phone, updated_at")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (error) throw error;
    return {
      user_id: userData.user.id,
      email: userData.user.email ?? "",
      full_name: data?.full_name ?? String(userData.user.user_metadata?.["full_name"] ?? ""),
      phone: data?.phone ?? "",
    };
  },
});

export async function saveStaffProfile(input: { full_name: string; phone: string }) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("Iniciá sesión para guardar tu perfil");
  const { error } = await db
    .from("staff_profiles")
    .upsert(
      { ...input, user_id: userData.user.id, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  if (error) throw error;
}

export const bannersQuery = queryOptions({
  queryKey: ["banners"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("banners")
      .select("*")
      .eq("active", true)
      .order("sort")
      .order("created_at");
    if (error) throw error;
    return data ?? [];
  },
});

export const adminBannersQuery = queryOptions({
  queryKey: ["admin-banners"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("banners")
      .select("*")
      .order("sort")
      .order("created_at");
    if (error) throw error;
    return data ?? [];
  },
});

export async function saveBanner(input: {
  id?: string;
  title: string;
  subtitle: string;
  image_url: string;
  link: string;
  active: boolean;
  sort: number;
}) {
  const { id, ...values } = input;
  const query = id
    ? supabase.from("banners").update(values).eq("id", id)
    : supabase.from("banners").insert(values);
  const { error } = await query;
  if (error) throw error;
}

export async function deleteBanner(id: string) {
  const { error } = await supabase.from("banners").delete().eq("id", id);
  if (error) throw error;
}

export async function linkProductPhotos() {
  const baseUrl = `${import.meta.env["VITE_SUPABASE_URL"]}/storage/v1/object/public/productos`;
  const { data, error } = await supabase.rpc("link_product_photos", { p_base_url: baseUrl });
  if (error) throw error;
  return data ?? 0;
}

export const categoriesQuery = queryOptions({
  queryKey: ["categories"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("id, slug, name, sort")
      .order("sort");
    if (error) throw error;
    return data;
  },
});

export const settingsQuery = queryOptions({
  queryKey: ["settings"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("business_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
});

export const DEFAULT_SETTINGS = {
  name: "Festiva",
  whatsapp: "5493625436293",
  instagram: "festiva.rcia",
  tiktok: "festiva.rcia",
  address: "Salta 124, Galería Mariana, Local N°1",
  hours: "Lunes a sábado de 9:00 a 12:30 y de 17:30 a 20:30",
  email: "",
};

// ---------- Panel (requiere sesión; la base controla los permisos) ----------

export const myRoleQuery = queryOptions({
  queryKey: ["my-role"],
  queryFn: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user)
      return { email: "", role: null as null | "admin" | "propietario_local" | "vendedor" };
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
    const roles = (data ?? []).map((r) => r.role);
    return {
      email: u.user.email ?? "",
      role: roles.includes("admin")
        ? ("admin" as const)
        : (roles as string[]).includes("propietario_local")
          ? ("propietario_local" as const)
          : roles.includes("vendedor")
            ? ("vendedor" as const)
            : null,
    };
  },
});

/** Rol del usuario actual. undefined = todavía cargando. */
export function useMyRole() {
  const me = useQuery(myRoleQuery);
  return {
    role: me.data?.role,
    email: me.data?.email ?? "",
    isAdmin: me.data?.role === "admin" || me.data?.role === "propietario_local",
    isAppOwner: me.data?.role === "admin",
    isStaff: me.data?.role != null,
    loading: me.isLoading,
  };
}

// Los vendedores reciben costos solo mediante la vista de personal, nunca desde la tabla products.
async function fetchAdminProducts() {
  const [productsResult, stockResult] = await Promise.all([
    supabase.from("products").select("*, categories(name)").order("name"),
    supabase.from("products_staff").select("id, stock_disponible"),
  ]);
  if (productsResult.error) throw productsResult.error;
  const effectiveStockById = new Map(
    (stockResult.data ?? [])
      .filter((row) => row.id !== null)
      .map((row) => [row.id!, row.stock_disponible ?? 0]),
  );
  return productsResult.data.map((p) => ({
    ...p,
    price: Number(p.price),
    cost: Number(p.cost),
    stock_disponible: effectiveStockById.get(p.id) ?? p.stock,
    stock_calculation_available: !stockResult.error,
    image: resolveImage(p.image_url),
    images: imageUrlList(p.image_urls),
    featured: p.featured ?? false,
    badge: p.badge ?? "",
    expiration_date: p.expiration_date,
  }));
}

export const adminProductsQuery = queryOptions({
  queryKey: ["admin-products"],
  queryFn: fetchAdminProducts,
});
export type AdminProduct = Awaited<ReturnType<typeof fetchAdminProducts>>[number];

export const priceHistoryQuery = queryOptions({
  queryKey: ["price-history"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("price_history")
      .select(
        "id, product_id, old_price, new_price, old_cost, new_cost, changed_at, batch_id, reason, products(name)",
      )
      .order("changed_at", { ascending: false })
      .limit(1000);
    if (error) throw error;
    return (data ?? []).map((row) => ({
      ...row,
      productName: (row.products as { name: string } | null)?.name ?? "Producto",
      old_price: row.old_price == null ? null : Number(row.old_price),
      new_price: row.new_price == null ? null : Number(row.new_price),
    }));
  },
});

export async function applyPriceChanges(
  changes: { product_id: string; new_price: number }[],
  reason: string,
) {
  const batches: string[] = [];
  for (let offset = 0; offset < changes.length; offset += 500) {
    const { data, error } = await supabase.rpc("apply_price_changes", {
      p_changes: changes.slice(offset, offset + 500),
      p_reason: reason.slice(0, 200),
    });
    if (error) {
      const batch = Math.floor(offset / 500) + 1;
      throw new Error(
        batches.length
          ? `Falló el lote ${batch}; ya se aplicaron ${batches.length} lotes anteriores. ${error.message}`
          : error.message,
      );
    }
    if (data) batches.push(data);
  }
  return batches;
}

export async function undoPriceBatch(batchId: string) {
  const { data, error } = await supabase.rpc("undo_price_batch", { p_batch: batchId });
  if (error) throw error;
  return data ?? 0;
}

export const replenishmentQuery = queryOptions({
  queryKey: ["replenishment-suggestions", 7],
  queryFn: async () => {
    const products = await fetchAdminProducts();
    return products
      .filter((product) => product.active && product.stock_disponible <= 7)
      .map((product) => {
        const supplier = product.supplier?.trim() ?? "";
        return {
          product_id: product.id,
          name: product.name,
          stock: product.stock_disponible,
          min_stock: 7,
          supplier: normalizeName(supplier) === "a definir" ? "" : supplier,
          sugerido: Math.max(0, 7 - product.stock_disponible),
        };
      });
  },
});

export async function applyStockCount(
  counts: { product_id: string; counted: number }[],
  reason: string,
) {
  const { data, error } = await supabase.rpc("apply_stock_count", {
    p_counts: counts,
    p_reason: reason,
  });
  if (error) throw error;
  return data ?? 0;
}

export const staffProductsQuery = queryOptions({
  queryKey: ["staff-products"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("products_staff")
      .select("*, categories(name)")
      .order("name");
    if (error) throw error;
    return (data ?? []).map((p) => ({
      id: p.id ?? "",
      slug: p.slug ?? "",
      name: p.name ?? "",
      category_id: p.category_id,
      description: p.description ?? "",
      image_url: p.image_url ?? "",
      image: resolveImage(p.image_url ?? ""),
      images: imageUrlList(p.image_urls),
      price: Number(p.price ?? 0),
      stock: p.stock ?? 0,
      min_stock: p.min_stock ?? 0,
      active: p.active ?? false,
      featured: p.featured ?? false,
      badge: p.badge ?? "",
      stock_disponible: p.stock_disponible ?? p.stock ?? 0,
      cost: Number(p.cost ?? 0),
      expiration_date: p.expiration_date ?? null,
      categories: p.categories as { name: string } | null,
    }));
  },
});
export type StaffProduct = Awaited<ReturnType<typeof staffProductsQuery.queryFn & {}>>[number];

export const comboItemsQuery = queryOptions({
  queryKey: ["combo-items"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("combo_items")
      .select("combo_id, component_id, quantity")
      .order("combo_id")
      .order("component_id");
    if (error) throw error;
    return data ?? [];
  },
});

export async function saveComboRecipe(
  comboId: string,
  items: { component_id: string; quantity: number }[],
) {
  const componentIds = items.map((item) => item.component_id);
  if (
    items.some((item) => !Number.isInteger(item.quantity) || item.quantity <= 0) ||
    new Set(componentIds).size !== componentIds.length ||
    componentIds.includes(comboId)
  ) {
    throw new Error("La receta contiene componentes o cantidades inválidas");
  }

  const { data: existing, error: existingError } = await supabase
    .from("combo_items")
    .select("component_id")
    .eq("combo_id", comboId);
  if (existingError) throw existingError;

  if (items.length) {
    const { error } = await supabase.from("combo_items").upsert(
      items.map((item) => ({ combo_id: comboId, ...item })),
      { onConflict: "combo_id,component_id" },
    );
    if (error) throw error;
  }

  const removedIds = (existing ?? [])
    .map((item) => item.component_id)
    .filter((id) => !componentIds.includes(id));
  if (removedIds.length) {
    const { error } = await supabase
      .from("combo_items")
      .delete()
      .eq("combo_id", comboId)
      .in("component_id", removedIds);
    if (error) throw error;
  }
}

export async function copyComboRecipe(from: string, to: string, factor: number) {
  const { data, error } = await supabase.rpc("copy_combo_recipe", {
    p_from: from,
    p_to: to,
    p_factor: factor,
  });
  if (error) throw error;
  return data ?? 0;
}

export interface OrderItemRow {
  product_id?: string;
  name: string;
  quantity: number;
  unit_price: number;
  unit_cost?: number;
}

// La vista de personal incluye costos congelados para los roles autorizados del panel.
export const ordersQuery = queryOptions({
  queryKey: ["orders"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw error;
    return data.map((o) => ({
      ...o,
      total: Number(o.total),
      items: (o.items as unknown as OrderItemRow[] | null) ?? [],
      cost_total: Number(o.cost_total ?? 0),
    }));
  },
});
export type AdminOrder = Awaited<ReturnType<typeof ordersQuery.queryFn & {}>>[number];

export const staffOrdersQuery = queryOptions({
  queryKey: ["staff-orders"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("orders_staff")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw error;
    return (data ?? []).map((o) => ({
      id: o.id ?? "",
      number: o.number ?? 0,
      customer_name: o.customer_name ?? "",
      customer_phone: o.customer_phone ?? "",
      items: (o.items as unknown as OrderItemRow[] | null) ?? [],
      total: Number(o.total ?? 0),
      cost_total: Number(o.cost_total ?? 0),
      status: o.status ?? "pendiente",
      channel: o.channel ?? "whatsapp",
      created_at: o.created_at ?? "",
      confirmed_at: o.confirmed_at,
      customer_email: o.customer_email ?? "",
      delivery_method: o.delivery_method ?? "retiro",
      delivery_address: o.delivery_address,
      event_date: o.event_date,
      notes: o.notes ?? "",
      delivered_at: o.delivered_at,
      edited_at: o.edited_at,
    }));
  },
});
export type StaffOrder = Awaited<ReturnType<typeof staffOrdersQuery.queryFn & {}>>[number];

export const movementsQuery = queryOptions({
  queryKey: ["movements"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("stock_movements")
      .select("*, products(name)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data.map((m) => ({
      ...m,
      productName: (m.products as { name: string } | null)?.name ?? "Producto eliminado",
    }));
  },
});
export type AdminMovement = Awaited<ReturnType<typeof movementsQuery.queryFn & {}>>[number];

// ---------- Equipo (solo admin) ----------

export const teamQuery = queryOptions({
  queryKey: ["team"],
  queryFn: async () => {
    const { data, error } = await supabase.rpc("list_team");
    if (error) throw error;
    return data ?? [];
  },
});

export async function setUserRole(userId: string, role: "vendedor" | "ninguno") {
  const { error } = await supabase.rpc("set_user_role", { p_user_id: userId, p_role: role });
  if (error) throw error;
}

// ---------- Proveedores, compras y gastos (solo admin) ----------

export const suppliersQuery = queryOptions({
  queryKey: ["suppliers"],
  queryFn: async () => {
    const { data, error } = await supabase.from("suppliers").select("*").order("name");
    if (error) throw error;
    return data ?? [];
  },
});

export async function saveSupplier(input: {
  id?: string;
  name: string;
  phone: string;
  notes: string;
}) {
  const q = input.id
    ? supabase
        .from("suppliers")
        .update({ name: input.name, phone: input.phone, notes: input.notes })
        .eq("id", input.id)
    : supabase
        .from("suppliers")
        .insert({ name: input.name, phone: input.phone, notes: input.notes });
  const { error } = await q;
  if (error) throw error;
}

export async function deleteSupplier(id: string) {
  const { error } = await supabase.from("suppliers").delete().eq("id", id);
  if (error) throw error;
}

export const EXPENSE_CATEGORIES = [
  "Alquiler",
  "Servicios",
  "Bolsas y packaging",
  "Flete",
  "Sueldos",
  "Impuestos",
  "Otros",
] as const;

/** Gastos de un mes (aaaa-mm). */
export const expensesQuery = (month: string) =>
  queryOptions({
    queryKey: ["expenses", month],
    queryFn: async () => {
      const [y = 2026, m = 1] = month.split("-").map(Number);
      const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .gte("date", `${month}-01`)
        .lt("date", next)
        .order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((e) => ({ ...e, amount: Number(e.amount) }));
    },
  });
export type ExpenseRow = Awaited<
  ReturnType<ReturnType<typeof expensesQuery>["queryFn"] & {}>
>[number];

export async function saveExpense(input: {
  id?: string;
  date: string;
  category: string;
  description: string;
  amount: number;
}) {
  const q = input.id
    ? supabase
        .from("expenses")
        .update({
          date: input.date,
          category: input.category,
          description: input.description,
          amount: input.amount,
        })
        .eq("id", input.id)
    : supabase.from("expenses").insert({
        date: input.date,
        category: input.category,
        description: input.description,
        amount: input.amount,
      });
  const { error } = await q;
  if (error) throw error;
}

export async function deleteExpense(id: string) {
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw error;
}

export const purchasesQuery = queryOptions({
  queryKey: ["purchases"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("purchases")
      .select("*, suppliers(name)")
      .order("date", { ascending: false })
      .limit(200);
    if (error) throw error;
    return (data ?? []).map((p) => ({
      ...p,
      total: Number(p.total),
      supplierName: (p.suppliers as { name: string } | null)?.name ?? "Sin proveedor",
    }));
  },
});
export type PurchaseRow = Awaited<ReturnType<typeof purchasesQuery.queryFn & {}>>[number];

export const purchaseItemsQuery = (purchaseId: string) =>
  queryOptions({
    queryKey: ["purchase-items", purchaseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_items")
        .select("*, products(name)")
        .eq("purchase_id", purchaseId);
      if (error) throw error;
      return (data ?? []).map((i) => ({
        ...i,
        unit_cost: Number(i.unit_cost),
        productName: (i.products as { name: string } | null)?.name ?? "Producto",
      }));
    },
  });

export async function registerPurchase(input: {
  date: string;
  supplier_id: string | null;
  notes: string;
  items: { product_id: string; quantity: number; unit_cost: number }[];
  update_cost: boolean;
}) {
  const { data, error } = await supabase.rpc("register_purchase", {
    p_date: input.date,
    p_supplier_id: input.supplier_id as string,
    p_notes: input.notes,
    p_items: input.items,
    p_update_cost: input.update_cost,
  });
  if (error) throw error;
  return data?.[0];
}

// ---------- Costos ----------

export async function applyCosts(
  rows: { product_id: string; cost: number | null; supplier: string | null }[],
) {
  const { data, error } = await supabase.rpc("apply_costs", { p_rows: rows });
  if (error) throw error;
  return data ?? 0;
}

// ---------- Reporte del negocio (solo admin) ----------

export interface BusinessReport {
  ventas: number;
  pedidos: number;
  ticket_promedio: number;
  costo_mercaderia: number;
  pedidos_sin_costo: number;
  gastos: number;
  gastos_por_categoria: { category: string; total: number }[];
  pendientes: number;
  top_unidades: { name: string; unidades: number; ventas: number; ganancia: number }[];
  top_ganancia: { name: string; unidades: number; ventas: number; ganancia: number }[];
  por_dia: { dia: string; pedidos: number; ventas: number }[];
  inventario_costo: number;
  inventario_precio: number;
  productos_sin_costo: number;
  sin_movimiento_60d: number;
}

export const businessReportQuery = (from: string, to: string) =>
  queryOptions({
    queryKey: ["business-report", from, to],
    queryFn: async (): Promise<BusinessReport> => {
      const { data, error } = await supabase.rpc("business_report", { p_from: from, p_to: to });
      if (error) throw error;
      return data as unknown as BusinessReport;
    },
  });

// ---------- Mutaciones del panel ----------

export interface ProductInput {
  name: string;
  category_id: string;
  price: number;
  cost: number;
  min_stock: number;
  supplier?: string;
  initial_stock?: number;
  description: string;
  image_url?: string;
  image_urls?: string[];
  featured?: boolean;
  badge?: string;
  expiration_date?: string | null;
}

export async function createProduct(
  input: ProductInput & { slug: string; image_url: string },
  includeInternals = true,
): Promise<string> {
  if (!includeInternals) {
    const { data, error } = await db.rpc("save_staff_catalog_product", {
      p_product_id: null,
      p_slug: input.slug,
      p_name: input.name,
      p_category_id: input.category_id,
      p_price: input.price,
      p_description: input.description,
      p_image_url: input.image_url,
      p_image_urls: input.image_urls ?? [],
      p_featured: input.featured ?? false,
      p_badge: input.badge ?? "",
      p_expiration_date: input.expiration_date ?? null,
    });
    if (error) throw error;
    if (!data) throw new Error("No se pudo identificar el producto creado");
    return data;
  }

  const { data, error } = await supabase
    .from("products")
    .insert({
      slug: input.slug,
      name: input.name,
      category_id: input.category_id,
      price: input.price,
      cost: input.cost,
      supplier: input.supplier ?? "",
      min_stock: input.min_stock,
      description: input.description,
      image_url: input.image_url,
      image_urls: input.image_urls ?? [],
      featured: input.featured ?? false,
      badge: input.badge ?? "",
      expiration_date: input.expiration_date ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateProduct(
  id: string,
  input: ProductInput & { image_url: string },
  includeInternals = true,
) {
  if (!includeInternals) {
    const { error } = await db.rpc("save_staff_catalog_product", {
      p_product_id: id,
      p_slug: "",
      p_name: input.name,
      p_category_id: input.category_id,
      p_price: input.price,
      p_description: input.description,
      p_image_url: input.image_url,
      p_image_urls: input.image_urls ?? [],
      p_featured: input.featured ?? false,
      p_badge: input.badge ?? "",
      p_expiration_date: input.expiration_date ?? null,
    });
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from("products")
    .update({
      name: input.name,
      category_id: input.category_id,
      price: input.price,
      ...(includeInternals ? { cost: input.cost, min_stock: input.min_stock } : {}),
      description: input.description,
      image_url: input.image_url,
      image_urls: input.image_urls ?? [],
      featured: input.featured ?? false,
      badge: input.badge ?? "",
      expiration_date: input.expiration_date ?? null,
    })
    .eq("id", id);
  if (error) throw error;
}

/** Los productos no se borran: se ocultan de la tienda. */
export async function setProductActive(id: string, active: boolean, includeInternals = true) {
  if (!includeInternals) {
    const { error } = await db.rpc("set_staff_product_active", {
      p_product_id: id,
      p_active: active,
    });
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("products").update({ active }).eq("id", id);
  if (error) throw error;
}

/** Edición en línea de costo y proveedor (solo admin). */
export async function updateProductInternals(
  id: string,
  input: { cost?: number; price?: number; supplier?: string },
) {
  const { error } = await supabase.from("products").update(input).eq("id", id);
  if (error) throw error;
}

export interface SettingsInput {
  name: string;
  whatsapp: string;
  instagram: string;
  tiktok: string;
  address: string;
  hours: string;
  email: string;
}

export async function saveSettings(values: SettingsInput) {
  const { error } = await supabase
    .from("business_settings")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) throw error;
}

export async function adjustStock(
  productId: string,
  type: "entrada" | "salida" | "ajuste",
  quantity: number,
  reason: string,
) {
  const { error } = await supabase.rpc("adjust_stock", {
    p_product_id: productId,
    p_type: type,
    p_quantity: quantity,
    p_reason: reason,
  });
  if (error) throw error;
}

/** Confirma el pedido. Con allowNegative=false la base rechaza si falta stock. */
export async function confirmOrder(orderId: string, allowNegative = false) {
  const { error } = await supabase.rpc("confirm_order", {
    p_order_id: orderId,
    p_allow_negative: allowNegative,
  });
  if (error) throw error;
}

export async function cancelOrder(orderId: string) {
  const { error } = await supabase.rpc("cancel_order", { p_order_id: orderId });
  if (error) throw error;
}

export interface NewOrderResult {
  order_number: number;
  total: number;
  items: { name: string; quantity: number; unit_price: number }[];
}

export interface CustomerData {
  name: string;
  phone: string;
  email: string;
  delivery: "retiro" | "envio";
  street: string;
  street_number: string;
  unit: string;
  neighborhood: string;
  city: string;
  province: string;
  postal_code: string;
  event_date: string;
  notes: string;
}

/** Registra el pedido en la base (queda PENDIENTE). Los precios se calculan en el servidor. */
export async function createOrder(
  lines: { slug: string; quantity: number }[],
  c: CustomerData,
  hp: string,
): Promise<NewOrderResult> {
  const { data, error } = await supabase.rpc("create_order", {
    p_items: lines.map((l) => ({ slug: l.slug, quantity: l.quantity })),
    p_customer_name: c.name,
    p_customer_phone: c.phone,
    p_delivery_method: c.delivery,
    p_delivery_address:
      c.delivery === "envio"
        ? {
            street: [c.street, c.street_number, c.unit, c.neighborhood].filter(Boolean).join(", "),
            city: c.city,
            province: c.province,
            postal_code: c.postal_code,
          }
        : {},
    p_event_date: c.event_date || (null as unknown as string),
    p_notes: c.notes,
    p_customer_email: c.email,
    p_hp: hp,
  });
  if (error) throw error;
  const row = data?.[0];
  if (!row) throw new Error("No se pudo registrar el pedido");
  const items = (
    (row.items as unknown as { name: string; quantity: number; unit_price: number }[]) ?? []
  ).map((i) => ({ ...i, unit_price: Number(i.unit_price) }));
  return { order_number: row.order_number, total: Number(row.total), items };
}

export async function updateOrderItems(
  orderId: string,
  items: { product_id: string; quantity: number }[],
) {
  const { error } = await supabase.rpc("update_order_items", {
    p_order_id: orderId,
    p_items: items,
  });
  if (error) throw error;
}
export async function markOrderDelivered(orderId: string) {
  const { error } = await supabase.rpc("mark_order_delivered", { p_order_id: orderId });
  if (error) throw error;
}
export async function voidConfirmedOrder(orderId: string, reason: string) {
  const { error } = await supabase.rpc("void_confirmed_order", {
    p_order_id: orderId,
    p_reason: reason,
  });
  if (error) throw error;
}
export async function expirePendingOrders(hours = 48) {
  const { data, error } = await supabase.rpc("expire_pending_orders", { p_hours: hours });
  if (error) throw error;
  return data ?? 0;
}
export async function createCounterSale(
  items: { product_id: string; quantity: number; unit_price?: number }[],
  note: string,
  allowNegative: boolean,
) {
  const { data, error } = await supabase.rpc("create_counter_sale", {
    p_items: items,
    p_note: note,
    p_allow_negative: allowNegative,
  });
  if (error) throw error;
  const row = data?.[0];
  return { number: row?.order_number ?? 0, total: Number(row?.order_total ?? 0) };
}

export interface UploadProgress {
  completed: number;
  total: number;
  percent: number;
  phase: "compressing" | "uploading";
}

async function compressProductImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) throw new Error("El archivo debe ser una imagen");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("No se pudo leer la imagen");
  }
  try {
    const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No se pudo preparar la imagen");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) =>
          result ? resolve(result) : reject(new Error("No se pudo comprimir la imagen")),
        "image/webp",
        0.82,
      );
    });
    const baseName =
      file.name
        .replace(/\.[^.]+$/, "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "") || "producto";
    return new File([blob], `${baseName}.webp`, { type: "image/webp" });
  } finally {
    bitmap.close();
  }
}

export async function uploadProductImage(
  file: File,
  onProgress?: (progress: UploadProgress) => void,
): Promise<string> {
  onProgress?.({ completed: 0, total: 1, percent: 5, phase: "compressing" });
  const compressed = await compressProductImage(file);
  const path = `${crypto.randomUUID()}.webp`;
  onProgress?.({ completed: 0, total: 1, percent: 25, phase: "uploading" });
  const up = await supabase.storage
    .from("productos")
    .upload(path, compressed, { contentType: "image/webp" });
  if (up.error) throw up.error;
  const { data } = supabase.storage.from("productos").getPublicUrl(path);
  onProgress?.({ completed: 1, total: 1, percent: 100, phase: "uploading" });
  return data.publicUrl;
}

export async function uploadBulkProductImages(
  files: File[],
  onProgress?: (progress: UploadProgress) => void,
): Promise<void> {
  const bucket = supabase.storage.from("productos");
  for (const [index, file] of files.entries()) {
    onProgress?.({
      completed: index,
      total: files.length,
      percent: Math.round((index / files.length) * 100),
      phase: "compressing",
    });
    const compressed = await compressProductImage(file);
    onProgress?.({
      completed: index,
      total: files.length,
      percent: Math.round((index / files.length) * 100),
      phase: "uploading",
    });
    const { error } = await bucket.upload(compressed.name, compressed, {
      contentType: "image/webp",
      upsert: true,
    });
    if (error) throw error;
    onProgress?.({
      completed: index + 1,
      total: files.length,
      percent: Math.round(((index + 1) / files.length) * 100),
      phase: "uploading",
    });
  }
}

export async function deleteProductImage(publicUrl: string) {
  const marker = "/storage/v1/object/public/productos/";
  const index = publicUrl.indexOf(marker);
  if (index < 0) return;
  const path = decodeURIComponent(publicUrl.slice(index + marker.length).split("?")[0] ?? "");
  if (!path) return;
  const { error } = await supabase.storage.from("productos").remove([path]);
  if (error) throw error;
}

export async function updateProductPhoto(id: string, imageUrl: string, includeInternals = true) {
  if (!includeInternals) {
    const { error } = await db.rpc("set_staff_product_photo", {
      p_product_id: id,
      p_image_url: imageUrl,
      p_image_urls: imageUrl ? [imageUrl] : [],
    });
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from("products")
    .update({ image_url: imageUrl, image_urls: imageUrl ? [imageUrl] : [] })
    .eq("id", id);
  if (error) throw error;
}

export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export function errorMessage(e: unknown): string {
  const m =
    e instanceof Error
      ? e.message
      : typeof e === "object" && e && "message" in e
        ? String((e as { message: unknown }).message)
        : "Ocurrió un error";
  if (/duplicate key.*slug/i.test(m)) return "Ya existe un producto con ese nombre";
  if (/permission|Sin permiso|row-level/i.test(m)) return "No tenés permiso para hacer esto";
  return m;
}

// ---------- Lectura según rol ----------

export interface PanelProduct {
  id: string;
  slug: string;
  name: string;
  category_id: string | null;
  description: string;
  image_url: string;
  image: string;
  images: string[];
  price: number;
  stock: number;
  stock_disponible: number;
  min_stock: number;
  active: boolean;
  featured: boolean;
  badge: string;
  categories: { name: string } | null;
  /** Disponible para el personal autorizado del panel; no se incluye en el catálogo público. */
  cost?: number;
  supplier?: string;
  expiration_date?: string | null;
}

/** Costos del vendedor llegan exclusivamente desde products_staff. */
export function usePanelProducts() {
  const { role, isAdmin } = useMyRole();
  const canManageBusiness = role === "admin" || role === "propietario_local";
  const a = useQuery({ ...adminProductsQuery, enabled: canManageBusiness });
  const s = useQuery({ ...staffProductsQuery, enabled: role === "vendedor" });
  const data: PanelProduct[] = isAdmin
    ? (a.data ?? []).map((p) => ({ ...p, categories: p.categories as { name: string } | null }))
    : (s.data ?? []);
  return {
    data,
    error: isAdmin ? a.error : s.error,
    warning:
      isAdmin && a.data?.some((product) => !product.stock_calculation_available)
        ? "No se pudo calcular el stock real de los combos. Se muestra el stock manual hasta aplicar la migración de base de datos."
        : null,
    isLoading: role === undefined || (isAdmin ? a.isLoading : s.isLoading),
    isAdmin,
  };
}

export interface PanelOrder {
  id: string;
  number: number;
  customer_name: string;
  customer_phone: string;
  items: OrderItemRow[];
  total: number;
  cost_total: number;
  status: "pendiente" | "confirmado" | "cancelado";
  channel: string;
  created_at: string;
  confirmed_at: string | null;
  customer_email: string;
  delivery_method: string;
  delivery_address: unknown;
  event_date: string | null;
  notes: string;
  delivered_at: string | null;
  edited_at: string | null;
}

export function usePanelOrders() {
  const { role, isAdmin } = useMyRole();
  const canManageBusiness = role === "admin" || role === "propietario_local";
  const a = useQuery({ ...ordersQuery, enabled: canManageBusiness });
  const s = useQuery({ ...staffOrdersQuery, enabled: role === "vendedor" });
  const data: PanelOrder[] = isAdmin ? (a.data ?? []) : (s.data ?? []);
  return { data, isLoading: role === undefined || (isAdmin ? a.isLoading : s.isLoading), isAdmin };
}

/** Rango [desde, hasta) en hora de Argentina (UTC-3) para el reporte. */
export function argentinaRange(fromDate: string, toDate: string) {
  const [y, m, d] = toDate.split("-").map(Number);
  const next = new Date(Date.UTC(y!, m! - 1, d! + 1)).toISOString().slice(0, 10);
  return { from: `${fromDate}T00:00:00-03:00`, to: `${next}T00:00:00-03:00` };
}

/** Fecha de hoy (aaaa-mm-dd) en Argentina. */
export function todayAR(offsetDays = 0): string {
  const t = new Date(Date.now() - 3 * 3600_000 + offsetDays * 86400_000);
  return t.toISOString().slice(0, 10);
}

/** Interpreta números en formato argentino (1.234,50) o con punto decimal; ignora $ y espacios. */
export function parseArNumber(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  let s = String(raw ?? "")
    .replace(/\s|ARS|USD|US\$|AR\$|[$€£¥₽]/gi, "")
    .trim();
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

export function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
