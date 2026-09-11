import fs from "fs";
import path from "path";
import { Store } from "./types";
import defaultStore from "@/data/store.json";

const dbPath = path.join(process.cwd(), "data", "store.json");
let memoryStore: Store = defaultStore as Store;

export function getStore(): Store {
  try {
    if (typeof fs !== "undefined" && fs.existsSync && fs.existsSync(dbPath)) {
      const content = fs.readFileSync(dbPath, "utf8");
      if (content) {
        return JSON.parse(content);
      }
    }
  } catch {
    // Worker / Edge fallback
  }
  return memoryStore;
}

export function saveStore(data: Store) {
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
