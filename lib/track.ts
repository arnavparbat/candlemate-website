import { getStore } from "./store";
import { isSupabaseConfigured, fetchOrdersFromSupabase } from "./supabase";
import { Order } from "./types";

export type TrackResult = {
  type: "phone" | "order_id";
  query: string;
  phoneLast10?: string;
  orderId?: string;
  orders: Order[];
};

/**
 * Searches orders by either Order ID (exact match) or Customer Phone Number (last 10 digits match).
 * - If Phone Number: returns full order history for that phone number.
 * - If Order ID: returns only the single specified order.
 */
export async function trackOrders(query: string): Promise<TrackResult> {
  const trimmed = (query || "").trim();
  if (!trimmed) {
    return {
      type: "order_id",
      query: "",
      orders: [],
    };
  }

  const digitsOnly = trimmed.replace(/\D/g, "");

  // 1. Gather all orders from Supabase (if configured) and local store
  let allOrders: Order[] = [];
  if (isSupabaseConfigured()) {
    try {
      const sbOrders = await fetchOrdersFromSupabase();
      if (sbOrders && sbOrders.length) {
        allOrders = sbOrders;
      }
    } catch (err) {
      console.warn("Could not fetch orders from Supabase for tracking:", err);
    }
  }

  // Fallback / merge with local store
  try {
    const store = getStore();
    if (store && Array.isArray(store.orders)) {
      if (!allOrders.length) {
        allOrders = [...store.orders];
      } else {
        const existingIds = new Set(allOrders.map((o) => o.id));
        for (const o of store.orders) {
          if (!existingIds.has(o.id)) {
            allOrders.push(o);
          }
        }
      }
    }
  } catch (err) {
    console.warn("Could not load local store for tracking:", err);
  }

  // Sort newest first
  allOrders.sort((a, b) => {
    const timeA = new Date(a.createdAt || 0).getTime();
    const timeB = new Date(b.createdAt || 0).getTime();
    return timeB - timeA;
  });

  // 2. Phone Number Lookup: if 10 or more digits are provided
  if (digitsOnly.length >= 10) {
    const phoneLast10 = digitsOnly.slice(-10);
    const matched = allOrders.filter((order) => {
      const p = (order.customer?.phone || "").replace(/\D/g, "");
      return p.endsWith(phoneLast10) || p.slice(-10) === phoneLast10;
    });

    return {
      type: "phone",
      query: trimmed,
      phoneLast10,
      orders: matched,
    };
  }

  // 3. Order ID Lookup: matches exact order ID (case-insensitive)
  const cleanId = trimmed.toUpperCase();
  const matched = allOrders.filter((order) => {
    const oId = (order.id || "").trim().toUpperCase();
    return oId === cleanId || oId === `CM-${cleanId}`;
  });

  return {
    type: "order_id",
    query: trimmed,
    orderId: cleanId,
    // When queried by Order ID, return only the single specified order
    orders: matched.slice(0, 1),
  };
}
