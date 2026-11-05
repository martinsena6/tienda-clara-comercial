import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface CartContextValue {
  /** Solo guarda slug y cantidad; los precios siempre se leen de la base. */
  items: Record<string, number>;
  count: number;
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
    if (loaded) {
      try {
        localStorage.setItem(KEY, JSON.stringify(items));
      } catch {
        /* El carrito sigue disponible durante la sesión. */
      }
    }
  }, [items, loaded]);
  const clear = useCallback(() => setItems({}), []);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      count: Object.values(items).reduce((s, q) => s + q, 0),
      add: (slug) => setItems((p) => ({ ...p, [slug]: (p[slug] ?? 0) + 1 })),
      setQuantity: (slug, qty) => setItems((p) => ({ ...p, [slug]: Math.max(1, qty) })),
      remove: (slug) =>
        setItems((p) => {
          const n = { ...p };
          delete n[slug];
          return n;
        }),
      clear,
    }),
    [items, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

// Valor seguro si el proveedor no está disponible (p. ej. tras una recarga parcial en desarrollo),
// para que la página nunca quede en blanco.
const EMPTY_CART: CartContextValue = {
  items: {},
  count: 0,
  add: () => {},
  setQuantity: () => {},
  remove: () => {},
  clear: () => {},
};

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    if (import.meta.env.DEV) console.warn("useCart se usó fuera de CartProvider");
    return EMPTY_CART;
  }
  return ctx;
}
