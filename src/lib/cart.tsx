import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getPublicProducts } from "./domain/catalog";
import type { PublicProduct } from "./domain/types";

interface CartLine {
  product: PublicProduct;
  quantity: number;
}

interface CartContextValue {
  lines: CartLine[];
  count: number;
  total: number;
  add: (slug: string) => void;
  setQuantity: (slug: string, qty: number) => void;
  remove: (slug: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);
const KEY = "carrito";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Record<string, number>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      /* ignorar */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(KEY, JSON.stringify(items));
  }, [items, loaded]);

  const value = useMemo<CartContextValue>(() => {
    // Los precios siempre se leen de la fuente única, nunca se guardan en el carrito.
    const all = getPublicProducts();
    const lines = Object.entries(items)
      .map(([slug, quantity]) => ({ product: all.find((p) => p.slug === slug)!, quantity }))
      .filter((l) => l.product && l.quantity > 0);
    return {
      lines,
      count: lines.reduce((s, l) => s + l.quantity, 0),
      total: lines.reduce((s, l) => s + l.quantity * l.product.price, 0),
      add: (slug) => setItems((p) => ({ ...p, [slug]: (p[slug] ?? 0) + 1 })),
      setQuantity: (slug, qty) => setItems((p) => ({ ...p, [slug]: Math.max(1, qty) })),
      remove: (slug) =>
        setItems((p) => {
          const n = { ...p };
          delete n[slug];
          return n;
        }),
      clear: () => setItems({}),
    };
  }, [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart debe usarse dentro de CartProvider");
  return ctx;
}
