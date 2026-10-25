// Acceso a los datos guardados (fuente única de productos, precios y configuración).
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  if (!v) return "";
  if (v.startsWith("asset:")) return ASSETS[v.slice(6)] ?? "";
  return v;
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
      price: Number(p.price),
      availability: p.availability as Availability,
    }));
  },
});

export const categoriesQuery = queryOptions({
  queryKey: ["categories"],
  queryFn: async () => {
    const { data, error } = await supabase.from("categories").select("id, slug, name, sort").order("sort");
    if (error) throw error;
    return data;
  },
});

export const settingsQuery = queryOptions({
  queryKey: ["settings"],
  queryFn: async () => {
    const { data, error } = await supabase.from("business_settings").select("*").eq("id", 1).maybeSingle();
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

export const adminProductsQuery = queryOptions({
  queryKey: ["admin-products"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("products")
      .select("*, categories(name)")
      .order("name");
    if (error) throw error;
    return data.map((p) => ({ ...p, price: Number(p.price), cost: Number(p.cost), image: resolveImage(p.image_url) }));
  },
});
export type AdminProduct = Awaited<ReturnType<typeof adminProductsQuery.queryFn & {}>>[number];

export const ordersQuery = queryOptions({
  queryKey: ["orders"],
  queryFn: async () => {
    const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(300);
    if (error) throw error;
    return data.map((o) => ({
      ...o,
      total: Number(o.total),
      items: (o.items as { name: string; quantity: number; unit_price: number }[]) ?? [],
    }));
  },
});
export type AdminOrder = Awaited<ReturnType<typeof ordersQuery.queryFn & {}>>[number];

export const movementsQuery = queryOptions({
  queryKey: ["movements"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("stock_movements")
      .select("*, products(name)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data;
  },
});

export const myRoleQuery = queryOptions({
  queryKey: ["my-role"],
  queryFn: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return { email: "", role: null as null | "admin" | "vendedor" };
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
    const roles = (data ?? []).map((r) => r.role);
    return { email: u.user.email ?? "", role: roles.includes("admin") ? ("admin" as const) : roles.includes("vendedor") ? ("vendedor" as const) : null };
  },
});

/** Sube una foto al almacenamiento y devuelve una dirección duradera para mostrarla. */
export async function uploadProductImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("El archivo debe ser una imagen");
  if (file.size > 5 * 1024 * 1024) throw new Error("La foto no puede pesar más de 5 MB");
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;
  const up = await supabase.storage.from("productos").upload(path, file, { contentType: file.type });
  if (up.error) throw up.error;
  const signed = await supabase.storage.from("productos").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
  if (signed.error) throw signed.error;
  return signed.data.signedUrl;
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
  const m = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : "Ocurrió un error";
  if (/duplicate key.*slug/i.test(m)) return "Ya existe un producto con ese nombre";
  if (/permission|Sin permiso|row-level/i.test(m)) return "No tenés permiso para hacer esto";
  return m;
}
