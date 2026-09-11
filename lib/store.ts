import fs from "fs";
import path from "path";
import { Store, Order } from "./types";
import defaultStore from "@/data/store.json";

const dbPath = path.join(process.cwd(), "data", "store.json");

// Persistent in-memory order registry that preserves all orders across requests
const runtimeOrdersMap = new Map<string, Order>();

// Initialize with bundled default orders
if (defaultStore.orders && Array.isArray(defaultStore.orders)) {
  for (const o of defaultStore.orders as Order[]) {
    if (o && o.id) runtimeOrdersMap.set(o.id, o);
  }
}

// Global in-memory store
let memoryStore: Store = {
  settings: { ...(defaultStore as Store).settings },
  products: [...(defaultStore as Store).products],
  orders: Array.from(runtimeOrdersMap.values()),
};

// 3 days in milliseconds: 3 * 24 * 60 * 60 * 1000 = 259,200,000 ms
export const SCREENSHOT_EXPIRY_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Automatically prunes payment screenshot images older than 3 days
 * to save cloud storage space and prevent database bloat.
 */
export function pruneExpiredScreenshots(store: Store): boolean {
  if (!store || !store.orders || !Array.isArray(store.orders)) return false;
  let modified = false;
  const now = Date.now();

  for (const order of store.orders) {
    if (order.screenshot) {
      const createdTime = new Date(order.createdAt).getTime();
      const expiresTime = order.screenshotExpiresAt
        ? new Date(order.screenshotExpiresAt).getTime()
        : createdTime + SCREENSHOT_EXPIRY_MS;

      // When the 3-day retention period has passed, purge the heavy screenshot payload
      if (now >= expiresTime) {
        delete order.screenshot;
        order.screenshotExpired = true;
        modified = true;
      }
    }
  }
  return modified;
}

export async function getCloudflareKV(): Promise<any | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const ctx = getCloudflareContext() as any;
    if (ctx && ctx.env) {
      const kv =
        ctx.env.CANDLEMATE_ORDERS ||
        ctx.env.ORDERS_KV ||
        ctx.env.STORE_KV ||
        ctx.env.CANDLEMATE_KV;
      if (kv && typeof kv.get === "function") {
        return kv;
      }
    }
  } catch {
    // Running in local Node.js or context not initialized
  }
  return null;
}

export function getStore(): Store {
  let diskProducts = memoryStore.products;
  let diskSettings = memoryStore.settings;

  try {
    if (typeof fs !== "undefined" && fs.existsSync && fs.existsSync(dbPath)) {
      const content = fs.readFileSync(dbPath, "utf8");
      if (content) {
        const diskData = JSON.parse(content);
        if (diskData.products) diskProducts = diskData.products;
        if (diskData.settings) diskSettings = diskData.settings;
        if (Array.isArray(diskData.orders)) {
          for (const o of diskData.orders) {
            if (o && o.id && !runtimeOrdersMap.has(o.id)) {
              runtimeOrdersMap.set(o.id, o);
            }
          }
        }
      }
    }
  } catch {
    // Read-only filesystem fallback
  }

  // Allow Cloudflare environment variables to set or override UPI ID across all edge nodes
  const envUpi = process.env.NEXT_PUBLIC_UPI_ID || process.env.UPI_ID;
  const activeSettings = {
    ...diskSettings,
    upiId: envUpi || diskSettings.upiId || "9552682389@ybl",
  };

  const currentStore: Store = {
    settings: activeSettings,
    products: diskProducts,
    // Always return all accumulated runtime orders, sorted newest first
    orders: Array.from(runtimeOrdersMap.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ),
  };

  // Automatically prune screenshots older than 3 days to protect cloud storage
  if (pruneExpiredScreenshots(currentStore)) {
    saveStore(currentStore);
  }

  memoryStore = currentStore;
  return currentStore;
}

export async function getStoreAsync(): Promise<Store> {
  const baseStore = getStore();

  // 1. Sync from Cloudflare KV across edge instances
  try {
    const kv = await getCloudflareKV();
    if (kv) {
      const kvOrders = await kv.get("orders", "json");
      if (Array.isArray(kvOrders)) {
        for (const o of kvOrders) {
          if (o && o.id) {
            runtimeOrdersMap.set(o.id, o);
          }
        }
      }
    }
  } catch (err) {
    console.warn("Could not read from Cloudflare KV:", err);
  }

  // 2. Sync from external order server if configured
  const externalServerUrl =
    process.env.ORDER_SERVER_URL || process.env.NEXT_PUBLIC_ORDER_SERVER_URL;
  if (externalServerUrl) {
    try {
      const res = await fetch(`${externalServerUrl.replace(/\/$/, "")}/api/orders`, {
        cache: "no-store",
      });
      if (res.ok) {
        const extOrders = await res.json();
        if (Array.isArray(extOrders)) {
          for (const o of extOrders) {
            if (o && o.id) {
              runtimeOrdersMap.set(o.id, o);
            }
          }
        }
      }
    } catch {}
  }

  baseStore.orders = Array.from(runtimeOrdersMap.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  memoryStore = baseStore;
  return baseStore;
}

export function saveStore(data: Store) {
  pruneExpiredScreenshots(data);

  // Sync all incoming orders into the persistent runtimeOrdersMap
  if (data.orders && Array.isArray(data.orders)) {
    for (const order of data.orders) {
      if (order && order.id) {
        runtimeOrdersMap.set(order.id, order);
      }
    }
  }

  memoryStore = {
    settings: { ...data.settings },
    products: [...data.products],
    orders: Array.from(runtimeOrdersMap.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ),
  };

  try {
    if (typeof fs !== "undefined" && fs.mkdirSync && fs.writeFileSync) {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
      fs.writeFileSync(dbPath, JSON.stringify(memoryStore, null, 2));
    }
  } catch {
    // Read-only filesystem fallback
  }
}

export async function saveStoreAsync(data: Store): Promise<void> {
  saveStore(data);

  // 1. Persist to Cloudflare KV across all edge instances
  try {
    const kv = await getCloudflareKV();
    if (kv) {
      const allOrders = Array.from(runtimeOrdersMap.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      await kv.put("orders", JSON.stringify(allOrders));
      if (data.orders && data.orders[0]?.id) {
        await kv.put(`order:${data.orders[0].id}`, JSON.stringify(data.orders[0]));
      }
    }
  } catch (err) {
    console.warn("Could not write to Cloudflare KV:", err);
  }

  // 2. Forward to external order server if configured
  const externalServerUrl =
    process.env.ORDER_SERVER_URL || process.env.NEXT_PUBLIC_ORDER_SERVER_URL;
  if (externalServerUrl && data.orders && data.orders[0]) {
    try {
      await fetch(`${externalServerUrl.replace(/\/$/, "")}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data.orders[0]),
      });
    } catch {}
  }
}
