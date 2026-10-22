import { z } from "zod";

export const productSchema = z
  .object({
    name: z.string().trim().min(2, "Ingresá un nombre de al menos 2 letras").max(120),
    categoryId: z.string().min(1, "Elegí una categoría"),
    price: z.coerce.number().positive("El precio debe ser mayor a cero"),
    cost: z.coerce.number().min(0, "El costo no puede ser negativo"),
    minStock: z.coerce.number().int().min(0),
    description: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.price >= v.cost, { message: "El precio no puede ser menor al costo", path: ["price"] });

export const expenseSchema = z.object({
  category: z.string().trim().min(1, "Elegí una categoría"),
  description: z.string().trim().min(2).max(200),
  amount: z.coerce.number().positive("El monto debe ser mayor a cero"),
  date: z.string().min(1, "Indicá la fecha"),
});

export type ProductInput = z.infer<typeof productSchema>;
export type ExpenseInput = z.infer<typeof expenseSchema>;
