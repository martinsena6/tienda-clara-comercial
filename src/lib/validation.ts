import { z } from "zod";

const productCatalogFields = {
  name: z.string().trim().min(2, "Ingresá un nombre de al menos 2 letras").max(120),
  category_id: z.string().min(1, "Elegí una categoría"),
  price: z.coerce.number().positive("El precio debe ser mayor a cero"),
  description: z.string().trim().max(500).optional(),
  featured: z.preprocess((value) => value === "on", z.boolean()),
  badge: z.string().trim().max(40, "La etiqueta puede tener hasta 40 caracteres").optional(),
};

export const productSchema = z
  .object({
    ...productCatalogFields,
    cost: z.coerce.number().min(0, "El costo no puede ser negativo"),
    min_stock: z.coerce.number().int().min(0),
  })
  .refine((v) => v.price >= v.cost, {
    message: "El precio no puede ser menor al costo",
    path: ["price"],
  });

export const productCatalogSchema = z.object(productCatalogFields);

export const stockMovementSchema = z.object({
  product_id: z.string().min(1, "Elegí un producto"),
  type: z.enum(["entrada", "salida", "ajuste"]),
  quantity: z.coerce
    .number()
    .int()
    .refine((n) => n !== 0, "La cantidad no puede ser cero"),
  reason: z.string().trim().max(200).optional(),
});

export const settingsSchema = z.object({
  name: z.string().trim().min(2, "Ingresá el nombre del negocio").max(80),
  whatsapp: z
    .string()
    .trim()
    .regex(/^\d{8,15}$/, "Solo números, con código de país (ej. 5493625436293)"),
  instagram: z.string().trim().max(60).optional(),
  tiktok: z.string().trim().max(60).optional(),
  address: z.string().trim().max(160).optional(),
  hours: z.string().trim().max(160).optional(),
  email: z.string().trim().email("Ingresá un email válido").or(z.literal("")).optional(),
});

const driveUrl = z
  .string()
  .trim()
  .refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return (
        url.protocol === "https:" &&
        (url.hostname === "drive.google.com" || url.hostname === "docs.google.com")
      );
    } catch {
      return false;
    }
  }, "Ingresá un enlace seguro de Google Drive");

export const driveLinksSchema = z.object({
  photos_url: driveUrl,
  spreadsheets_url: driveUrl,
});

export const expenseSchema = z.object({
  category: z.string().trim().min(1, "Elegí una categoría"),
  description: z.string().trim().min(2).max(200),
  amount: z.coerce.number().positive("El monto debe ser mayor a cero"),
  date: z.string().min(1, "Indicá la fecha"),
});

export type ProductInput = z.infer<typeof productSchema>;
export type SettingsInput = z.infer<typeof settingsSchema>;
export type ExpenseInput = z.infer<typeof expenseSchema>;
