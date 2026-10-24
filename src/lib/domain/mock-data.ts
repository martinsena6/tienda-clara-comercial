// Datos de ejemplo: ÚNICA fuente de productos y precios en esta etapa.
// Será reemplazada por la base de datos sin cambiar las pantallas.
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
  name: "Festiva",
  whatsapp: "5493625436293",
  email: "festiva.shop@ejemplo.com",
  address: "Salta 124, Galería Mariana, Local N°1",
  currency: "ARS",
};

export const categories: Category[] = [
  { id: "c1", slug: "golosinas", name: "Golosinas y chicles" },
  { id: "c2", slug: "chupetines", name: "Chupetines" },
  { id: "c3", slug: "gomitas", name: "Gomitas" },
  { id: "c4", slug: "combos", name: "Combos para fiestas" },
  { id: "c5", slug: "cotillon", name: "Cotillón" },
];

// Precios tomados de la lista de precios y de los carteles de combos.
// Costos, proveedor y stock son provisorios hasta cargar los reales.
export const products: Product[] = [
  { id: "p1", slug: "combo-10-misky", name: "Combo 10 Misky", categoryId: "c4", description: "10 alfajores Mogy, 10 turrones Misky, 10 chupetines Pelotitas, 10 bocaditos Bel y 20 masticables. 60 unidades.", image: combo_misky_10.url, price: 12600, cost: 8190.0, supplier: "A definir", stock: 8, minStock: 3, active: true },
  { id: "p2", slug: "combo-20-misky", name: "Combo 20 Misky", categoryId: "c4", description: "20 alfajores Mogy, 20 turrones Misky, 20 chupetines Pelotitas, 20 bocaditos Bel y 40 masticables. 120 unidades.", image: combo_misky_20.url, price: 25100, cost: 16315.0, supplier: "A definir", stock: 5, minStock: 3, active: true },
  { id: "p3", slug: "combo-10-economico", name: "Combo 10 Económico", categoryId: "c4", description: "10 alfajores Tinchito, 10 turrones Fulbito, 10 chupetines, 10 bocaditos Bel y 20 masticables. 60 unidades.", image: combo_eco_10.url, price: 9800, cost: 6370.0, supplier: "A definir", stock: 10, minStock: 3, active: true },
  { id: "p4", slug: "combo-20-economico", name: "Combo 20 Económico", categoryId: "c4", description: "20 alfajores, 20 turrones, 20 chupetines, 20 bocaditos y 40 masticables. 120 unidades.", image: combo_eco_20.url, price: 19500, cost: 12675.0, supplier: "A definir", stock: 4, minStock: 3, active: true },
  { id: "p5", slug: "combo-40-economico", name: "Combo 40 Económico", categoryId: "c4", description: "40 alfajores, 40 turrones, 40 chupetines, 40 bocaditos y 80 masticables. 240 unidades.", image: combo_eco_40.url, price: 39000, cost: 25350.0, supplier: "A definir", stock: 2, minStock: 3, active: true },
  { id: "p6", slug: "bola-loca-futbol", name: "Bola Loca Fútbol", categoryId: "c1", description: "Chicles Bola Loca Fútbol Club, bolsa surtida.", image: bola_loca_futbol.url, price: 2871.65, cost: 1866.57, supplier: "A definir", stock: 15, minStock: 3, active: true },
  { id: "p7", slug: "chupetin-emoji", name: "Chupetín Emoji", categoryId: "c2", description: "Chupetines Pop Emo con caritas, bolsa.", image: chupetin_emoji.url, price: 3955.02, cost: 2570.76, supplier: "A definir", stock: 12, minStock: 3, active: true },
  { id: "p8", slug: "chupetin-cebollita", name: "Chupetín Cebollita", categoryId: "c2", description: "Chupetines Cebollitas Fútbol de Lheritier.", image: chupetin_cebollita.url, price: 1354.12, cost: 880.18, supplier: "A definir", stock: 20, minStock: 3, active: true },
  { id: "p9", slug: "chupetin-pico-dulce", name: "Chupetín Pico Dulce", categoryId: "c2", description: "Caja de chupetines Pico Dulce, 24 unidades.", image: chupetin_pico_dulce.url, price: 4381.2, cost: 2847.78, supplier: "A definir", stock: 3, minStock: 3, active: true },
  { id: "p10", slug: "goma-mogul-anillos", name: "Gomitas Mogul Anillos 1 kg", categoryId: "c3", description: "Gomitas Mogul en forma de anillo, bolsa de 1 kg.", image: goma_mogul_anillos.url, price: 9783, cost: 6358.95, supplier: "A definir", stock: 6, minStock: 3, active: true },
  { id: "p11", slug: "docigoma-gajo", name: "Docigoma Gajo", categoryId: "c3", description: "Gomitas Docile en forma de gajo.", image: docigoma_gajo.url, price: 2698.29, cost: 1753.89, supplier: "A definir", stock: 10, minStock: 3, active: true },
  { id: "p12", slug: "goma-ricomas-jelly", name: "Gomitas Ricomas Jelly Roll 500 g", categoryId: "c3", description: "Gomitas Ricomas de Misky, bolsa de 500 g.", image: goma_ricomas_jelly.url, price: 4030.91, cost: 2620.09, supplier: "A definir", stock: 0, minStock: 3, active: true },
  { id: "p13", slug: "goma-pinata", name: "Gomitas La Piñata 700 g", categoryId: "c3", description: "Gomitas La Piñata anillos azucarados, 700 g.", image: goma_pinata.url, price: 4961.67, cost: 3225.09, supplier: "A definir", stock: 7, minStock: 3, active: true },
  { id: "p14", slug: "goma-fierita-roll", name: "Gomitas Fierita Roll", categoryId: "c3", description: "Caja de gomitas Fierita en rollo.", image: goma_fierita_roll.url, price: 5342.89, cost: 3472.88, supplier: "A definir", stock: 4, minStock: 3, active: true },
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
  { id: "u1", supplier: "Distribuidora", description: "Mercadería surtida", total: 84000, date: "2026-10-18" },
  { id: "u2", supplier: "Mayorista golosinas", description: "Gomitas surtidas", total: 39000, date: "2026-10-21" },
];

export const expenses: Expense[] = [
  { id: "e1", category: "Alquiler", description: "Alquiler del local – octubre", amount: 180000, date: "2026-10-01" },
  { id: "e2", category: "Servicios", description: "Internet y luz", amount: 32000, date: "2026-10-05" },
  { id: "e3", category: "Marketing", description: "Publicidad en redes", amount: 25000, date: "2026-10-12" },
];
