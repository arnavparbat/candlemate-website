import { createClient } from "@supabase/supabase-js";
import { Order, Product } from "./types";

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function cleanSupabaseUrl(url?: string): string {
  if (!url) return "https://placeholder.supabase.co";
  return url.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
}

// Safe fallback for build phase so Next.js static page collection never crashes
const cleanUrl = cleanSupabaseUrl(rawUrl);
const supabaseUrl = cleanUrl.startsWith("http") ? cleanUrl : "https://placeholder.supabase.co";
const supabaseAnonKey = rawKey || "placeholder-anon-key";

/**
 * Supabase client initialized with standard public environment variables
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Returns whether Supabase credentials are configured in environment variables
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    rawUrl &&
    rawKey &&
    rawUrl.startsWith("https://") &&
    !rawUrl.includes("your-project-id") &&
    !rawUrl.includes("placeholder")
  );
}

export function getSupabase() {
  return isSupabaseConfigured() ? supabase : null;
}

/**
 * Uploads a payment screenshot to the Supabase Storage 'payment-proofs' bucket
 * and returns the public CDN URL to store in the 'screenshot' column.
 */
export async function uploadScreenshotToSupabase(
  orderId: string,
  base64OrDataUrl: string
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    let contentType = "image/jpeg";
    let uploadPayload: any;

    if (typeof window !== "undefined") {
      // Universal browser environment: convert DataURL directly to Blob
      const res = await fetch(base64OrDataUrl);
      uploadPayload = await res.blob();
      contentType = uploadPayload.type || "image/jpeg";
    } else {
      // Universal Node.js / Server environment: convert base64 to Buffer
      const matches = base64OrDataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        contentType = matches[1];
        uploadPayload = Buffer.from(matches[2], "base64");
      } else {
        uploadPayload = Buffer.from(base64OrDataUrl, "base64");
      }
    }

    const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    const filePath = `receipts/${orderId}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("payment-proofs")
      .upload(filePath, uploadPayload, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      console.error("[Supabase Storage] Upload error:", uploadError.message);
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from("payment-proofs")
      .getPublicUrl(filePath);

    return publicUrlData?.publicUrl || null;
  } catch (err: any) {
    console.error("[Supabase Storage] Unexpected error uploading screenshot:", err.message);
    return null;
  }
}

/**
 * Save an order to Supabase PostgreSQL table using the exact schema column names
 */
export async function insertOrderToSupabase(order: Order): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  try {
    const { error } = await supabase.from("orders").insert([
      {
        id: order.id,
        customer_name: order.customer.name,
        customer_phone: order.customer.phone,
        customer_address: order.customer.address,
        items: order.items,
        total: order.total,
        status: order.status,
        screenshot: order.screenshot,
        screenshot_expired: order.screenshotExpired || false,
        screenshot_expires_at: order.screenshotExpiresAt || null,
        created_at: order.createdAt || new Date().toISOString(),
      },
    ]);

    if (error) {
      console.error("[Supabase DB] Error inserting order:", error.message);
      return false;
    }

    console.log(`[Supabase DB] 🕯️ Order ${order.id} inserted successfully into 'orders' table.`);
    return true;
  } catch (err: any) {
    console.error("[Supabase DB] Unexpected error inserting order:", err.message);
    return false;
  }
}

/**
 * Fetch orders from Supabase PostgreSQL table
 */
export async function fetchOrdersFromSupabase(): Promise<Order[] | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .neq("id", "__SYSTEM_STORE_PRODUCTS__")
      .neq("status", "SYSTEM_INTERNAL")
      .neq("status", "Archived")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[Supabase DB] Error fetching orders:", error.message);
      return null;
    }

    return (data || []).map((row: any): Order => ({
      id: row.id,
      customer: {
        name: row.customer_name,
        phone: row.customer_phone,
        address: row.customer_address,
      },
      items: row.items || [],
      total: Number(row.total),
      status: row.status,
      screenshot: row.screenshot,
      screenshotExpired: Boolean(row.screenshot_expired),
      screenshotExpiresAt: row.screenshot_expires_at,
      createdAt: row.created_at,
    }));
  } catch (err: any) {
    console.error("[Supabase DB] Unexpected error fetching orders:", err.message);
    return null;
  }
}

/**
 * Update order status in Supabase table
 */
export async function updateOrderStatusInSupabase(
  id: string,
  status: string
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  try {
    const { error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", id);

    if (error) {
      console.error("[Supabase DB] Error updating status:", error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error("[Supabase DB] Error updating order status:", err.message);
    return false;
  }
}

/**
 * Delete payment screenshot from Supabase Storage and DB
 */
export async function deleteScreenshotFromSupabase(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  try {
    // 1. Mark as expired and clear screenshot in DB
    const { error: dbError } = await supabase
      .from("orders")
      .update({ screenshot: null, screenshot_expired: true })
      .eq("id", id);

    if (dbError) {
      console.error("[Supabase DB] Error clearing screenshot:", dbError.message);
    }

    // 2. Remove file from payment-proofs storage bucket
    await supabase.storage.from("payment-proofs").remove([
      `receipts/${id}.jpg`,
      `receipts/${id}.png`,
      `receipts/${id}.webp`,
    ]);

    return true;
  } catch (err: any) {
    console.error("[Supabase DB] Error deleting screenshot:", err.message);
    return false;
  }
}

/**
 * Global Cloud Product Store: Fetch persistent products from Supabase
 */
export async function fetchProductsFromSupabase(): Promise<Product[] | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    // 1. Check if a dedicated 'products' table exists in PostgreSQL
    const { data: tableData, error: tableErr } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (!tableErr && Array.isArray(tableData) && tableData.length > 0) {
      return tableData as Product[];
    }

    // 2. Fetch from the permanent cloud sync row in orders
    const { data, error } = await supabase
      .from("orders")
      .select("items")
      .eq("id", "__SYSTEM_STORE_PRODUCTS__")
      .maybeSingle();

    if (!error && data?.items && Array.isArray(data.items) && data.items.length > 0) {
      return data.items as Product[];
    }

    return null;
  } catch (err: any) {
    console.warn("[Supabase DB] Could not fetch cloud products:", err.message);
    return null;
  }
}

/**
 * Global Cloud Product Store: Persist products to Supabase so changes sync across PC and mobile instantly
 */
export async function saveProductsToSupabase(products: Product[]): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  try {
    const { error } = await supabase.from("orders").upsert([
      {
        id: "__SYSTEM_STORE_PRODUCTS__",
        customer_name: "Candlemate Studio Inventory",
        customer_phone: "0000000000",
        customer_address: "Candlemate Cloud Inventory Store",
        items: products,
        total: 0,
        status: "SYSTEM_INTERNAL",
        created_at: new Date().toISOString(),
      },
    ]);

    if (error) {
      console.error("[Supabase DB] Error syncing products to cloud:", error.message);
      return false;
    }

    console.log(`[Supabase DB] 🕯️ Successfully synced ${products.length} products to cloud store.`);
    return true;
  } catch (err: any) {
    console.error("[Supabase DB] Unexpected error syncing products:", err.message);
    return false;
  }
}

/**
 * Global Cloud Category Store: Fetch persistent custom categories from Supabase
 */
export async function fetchCategoriesFromSupabase(): Promise<string[] | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const { data, error } = await supabase
      .from("orders")
      .select("items")
      .eq("id", "__SYSTEM_STORE_CATEGORIES__")
      .maybeSingle();

    if (!error && data?.items && Array.isArray(data.items)) {
      return data.items as string[];
    }
    return null;
  } catch (err: any) {
    console.warn("[Supabase DB] Could not fetch cloud categories:", err.message);
    return null;
  }
}

/**
 * Global Cloud Category Store: Persist categories to Supabase
 */
export async function saveCategoriesToSupabase(categories: string[]): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  try {
    const { error } = await supabase.from("orders").upsert([
      {
        id: "__SYSTEM_STORE_CATEGORIES__",
        customer_name: "Candlemate Studio Categories",
        customer_phone: "0000000000",
        customer_address: "Candlemate Cloud Categories Store",
        items: categories,
        total: 0,
        status: "SYSTEM_INTERNAL",
        created_at: new Date().toISOString(),
      },
    ]);

    if (error) {
      console.error("[Supabase DB] Error syncing categories to cloud:", error.message);
      return false;
    }

    console.log(`[Supabase DB] 🕯️ Successfully synced ${categories.length} categories to cloud store.`);
    return true;
  } catch (err: any) {
    console.error("[Supabase DB] Unexpected error syncing categories:", err.message);
    return false;
  }
}

