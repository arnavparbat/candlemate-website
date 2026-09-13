"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { CartItem, Product } from "@/lib/types";

type Ctx = {
  items: CartItem[];
  add: (p: Product) => void;
  remove: (id: string) => void;
  update: (id: string, n: number) => void;
  total: number;
  clear: () => void;
  lastAdded: { product: Product; time: number } | null;
};

const Cart = createContext<Ctx | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [lastAdded, setLastAdded] = useState<{ product: Product; time: number } | null>(null);

  // 1. Initial hydration: read stored cart from localStorage once on client mount
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const cached = localStorage.getItem("candlemate-cart");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setItems(parsed);
          }
        }
      }
    } catch (err) {
      console.warn("[Cart] Failed to read cart from localStorage:", err);
    } finally {
      setHasHydrated(true);
    }
  }, []);

  // 2. Persist to localStorage ONLY after hydration has completed to avoid overwriting with []
  useEffect(() => {
    if (!hasHydrated) return;
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("candlemate-cart", JSON.stringify(items));
      }
    } catch (err) {
      console.warn("[Cart] Failed to save cart to localStorage:", err);
    }
  }, [items, hasHydrated]);

  const add = (p: Product) => {
    if (!p || !p.id) return;

    // Physical haptic vibration on mobile devices (Android / supported browsers)
    if (typeof window !== "undefined") {
      if ("vibrate" in navigator) {
        try {
          navigator.vibrate([60, 40, 70]);
        } catch {}
      }
      window.dispatchEvent(new CustomEvent("candlemate-item-added"));
    }

    setLastAdded({ product: p, time: Date.now() });
    setTimeout(() => {
      setLastAdded(null);
    }, 1200);

    setItems((current) => {
      const found = current.find((i) => i.id === p.id);
      const updated = found
        ? current.map((i) => (i.id === p.id ? { ...i, quantity: i.quantity + 1 } : i))
        : [...current, { ...p, quantity: 1 }];

      // Synchronous write ensures cart is saved even if navigation occurs immediately
      try {
        if (typeof window !== "undefined") {
          localStorage.setItem("candlemate-cart", JSON.stringify(updated));
        }
      } catch {}

      return updated;
    });
  };

  const update = (id: string, n: number) => {
    setItems((current) => {
      const updated = current
        .map((i) => (i.id === id ? { ...i, quantity: n } : i))
        .filter((i) => i.quantity > 0);

      try {
        if (typeof window !== "undefined") {
          localStorage.setItem("candlemate-cart", JSON.stringify(updated));
        }
      } catch {}

      return updated;
    });
  };

  const clear = () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("candlemate-cart");
      }
    } catch {}
    setItems([]);
  };

  return (
    <Cart.Provider
      value={{
        items,
        add,
        remove: (id) => update(id, 0),
        update,
        total: items.reduce(
          (s, i) => s + (Number(i.price) || 0) * (Number(i.quantity) || 1),
          0
        ),
        clear,
        lastAdded,
      }}
    >
      {children}
    </Cart.Provider>
  );
}

export function useCart() {
  const c = useContext(Cart);
  if (!c) throw new Error("Use within CartProvider");
  return c;
}

