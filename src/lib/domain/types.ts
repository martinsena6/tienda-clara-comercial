// Tipos del dominio comercial. Preparados para mapearse luego a tablas de PostgreSQL.

export type Role = "admin" | "vendedor";

export interface Category {
  id: string;
  slug: string;
  name: string;
}

/** Producto completo: SOLO para el panel administrativo. Contiene datos internos. */
export interface Product {
  id: string;
  slug: string;
  name: string;
  categoryId: string;
  description: string;
  image: string;
  price: number;
  /** Interno: nunca debe llegar al catálogo público. */
  cost: number;
  /** Interno. */
  supplier: string;
  /** Interno: el catálogo solo ve la disponibilidad derivada. */
  stock: number;
  minStock: number;
  active: boolean;
}

export type Availability = "disponible" | "pocas_unidades" | "sin_stock";

/** Vista pública del producto: sin costo, proveedor ni cantidades de stock. */
export interface PublicProduct {
  slug: string;
  name: string;
  categorySlug: string;
  categoryName: string;
  description: string;
  image: string;
  price: number;
  availability: Availability;
}

export type StockMovementType = "entrada" | "salida" | "ajuste";

export interface StockMovement {
  id: string;
  productId: string;
  type: StockMovementType;
  quantity: number;
  reason: string;
  date: string;
  user: string;
}

/** Un pedido por WhatsApp nace "pendiente": no es venta ni descuenta stock. */
export type OrderStatus = "pendiente" | "confirmado" | "cancelado";

export interface OrderItem {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  number: number;
  customerName: string;
  customerPhone: string;
  items: OrderItem[];
  status: OrderStatus;
  channel: "whatsapp" | "local";
  date: string;
}

export interface Purchase {
  id: string;
  supplier: string;
  description: string;
  total: number;
  date: string;
}

export interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  date: string;
}

export interface BusinessSettings {
  name: string;
  whatsapp: string;
  email: string;
  address: string;
  currency: "ARS";
}
