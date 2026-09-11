import fs from "fs";
import path from "path";
import { Store } from "./types";
import defaultStore from "@/data/store.json";

const dbPath = path.join(process.cwd(), "data", "store.json");
let memoryStore: Store = defaultStore as Store;

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

export function getStore(): Store {
  let store: Store = memoryStore;
  try {
    if (typeof fs !== "undefined" && fs.existsSync && fs.existsSync(dbPath)) {
      const content = fs.readFileSync(dbPath, "utf8");
      if (content) {
        store = JSON.parse(content);
      }
    }
  } catch {
    // Worker / Edge fallback
    store = memoryStore;
  }

  // Automatically prune screenshots older than 3 days to protect cloud storage
  if (pruneExpiredScreenshots(store)) {
    saveStore(store);
  }

  return store;
}

export function saveStore(data: Store) {
  pruneExpiredScreenshots(data);
  memoryStore = data;
  try {
    if (typeof fs !== "undefined" && fs.mkdirSync && fs.writeFileSync) {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
      fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
    }
  } catch {
    // Read-only filesystem fallback
  }
}

export async function getStoreAsync(): Promise<Store> {
  return getStore();
}

export async function saveStoreAsync(data: Store): Promise<void> {
  saveStore(data);
}
