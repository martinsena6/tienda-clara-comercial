// Datos de ejemplo: ÚNICA fuente de productos y precios en esta etapa.
// Será reemplazada por la base de datos sin cambiar las pantallas.
import taza from "@/assets/p-taza.jpg";
import cafe from "@/assets/p-cafe.jpg";
import bolso from "@/assets/p-bolso.jpg";
import vela from "@/assets/p-vela.jpg";
import type {
  BusinessSettings,
  Category,
  Expense,
  Order,
  Product,
  Purchase,
  StockMovement,
} from "./types";

export const businessSettings: BusinessSettings = {
  name: "Almacén Norte",
  whatsapp: "5491100000000",
  email: "hola@almacennorte.com",
  address: "Av. Siempre Viva 742, Buenos Aires",
  currency: "ARS",
};

export const categories: Category[] = [
  { id: "c1", slug: "cocina", name: "Cocina" },
  { id: "c2", slug: "cafe", name: "Café" },
  { id: "c3", slug: "accesorios", name: "Accesorios" },
  { id: "c4", slug: "hogar", name: "Hogar" },
];

export const products: Product[] = [
  { id: "p1", slug: "taza-ceramica-salvia", name: "Taza de cerámica Salvia", categoryId: "c1", description: "Taza de 350 ml esmaltada a mano, apta lavavajillas.", image: taza, price: 8900, cost: 4200, supplier: "Cerámica del Sur", stock: 24, minStock: 5, active: true },
  { id: "p2", slug: "cafe-especialidad-500", name: "Café de especialidad 500 g", categoryId: "c2", description: "Granos tostados de origen único, notas a chocolate y nuez.", image: cafe, price: 15400, cost: 9100, supplier: "Tostadero Andino", stock: 3, minStock: 6, active: true },
  { id: "p3", slug: "cafe-molido-250", name: "Café molido 250 g", categoryId: "c2", description: "Molienda media, ideal para cafetera de filtro o italiana.", image: cafe, price: 8200, cost: 4700, supplier: "Tostadero Andino", stock: 18, minStock: 6, active: true },
  { id: "p4", slug: "bolso-lino-natural", name: "Bolso de lino natural", categoryId: "c3", description: "Bolso amplio de lino resistente con asas reforzadas.", image: bolso, price: 12500, cost: 6000, supplier: "Textil Patagonia", stock: 0, minStock: 3, active: true },
  { id: "p5", slug: "vela-soja-ambar", name: "Vela de soja Ámbar", categoryId: "c4", description: "Vela aromática en frasco de vidrio, 40 horas de duración.", image: vela, price: 9800, cost: 3900, supplier: "Aromas Libres", stock: 12, minStock: 4, active: true },
  { id: "p6", slug: "vela-soja-grande", name: "Vela de soja grande", categoryId: "c4", description: "Versión grande con doble mecha, 70 horas de duración.", image: vela, price: 14600, cost: 6100, supplier: "Aromas Libres", stock: 2, minStock: 3, active: true },
];

export const stockMovements: StockMovement[] = [
  { id: "m1", productId: "p1", type: "entrada", quantity: 20, reason: "Compra a proveedor", date: "2026-10-18", user: "Martín" },
  { id: "m2", productId: "p2", type: "salida", quantity: 2, reason: "Venta confirmada #1021", date: "2026-10-19", user: "Martín" },
  { id: "m3", productId: "p4", type: "ajuste", quantity: -1, reason: "Unidad dañada", date: "2026-10-20", user: "Martín" },
  { id: "m4", productId: "p5", type: "entrada", quantity: 10, reason: "Compra a proveedor", date: "2026-10-21", user: "Martín" },
];

export const orders: Order[] = [
  { id: "o1", number: 1024, customerName: "Lucía Fernández", customerPhone: "11 5555-1234", items: [{ productId: "p1", quantity: 2, unitPrice: 8900 }, { productId: "p5", quantity: 1, unitPrice: 9800 }], status: "pendiente", channel: "whatsapp", date: "2026-10-22" },
  { id: "o2", number: 1023, customerName: "Diego Ramírez", customerPhone: "11 5555-9876", items: [{ productId: "p2", quantity: 1, unitPrice: 15400 }], status: "pendiente", channel: "whatsapp", date: "2026-10-21" },
  { id: "o3", number: 1022, customerName: "Sofía Gómez", customerPhone: "11 5555-4433", items: [{ productId: "p3", quantity: 3, unitPrice: 8200 }], status: "confirmado", channel: "whatsapp", date: "2026-10-20" },
  { id: "o4", number: 1021, customerName: "Carlos Pérez", customerPhone: "11 5555-2211", items: [{ productId: "p2", quantity: 2, unitPrice: 15400 }], status: "confirmado", channel: "local", date: "2026-10-19" },
  { id: "o5", number: 1020, customerName: "Ana Torres", customerPhone: "11 5555-7788", items: [{ productId: "p4", quantity: 1, unitPrice: 12500 }], status: "cancelado", channel: "whatsapp", date: "2026-10-18" },
];

export const purchases: Purchase[] = [
  { id: "u1", supplier: "Cerámica del Sur", description: "20 tazas Salvia", total: 84000, date: "2026-10-18" },
  { id: "u2", supplier: "Aromas Libres", description: "10 velas Ámbar", total: 39000, date: "2026-10-21" },
];

export const expenses: Expense[] = [
  { id: "e1", category: "Alquiler", description: "Alquiler del local – octubre", amount: 180000, date: "2026-10-01" },
  { id: "e2", category: "Servicios", description: "Internet y luz", amount: 32000, date: "2026-10-05" },
  { id: "e3", category: "Marketing", description: "Publicidad en redes", amount: 25000, date: "2026-10-12" },
];
