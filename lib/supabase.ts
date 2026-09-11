import { createClient } from "@supabase/supabase-js";
import { Order } from "./types";

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Safe fallback for build phase so Next.js static page collection never crashes
const supabaseUrl = rawUrl && rawUrl.startsWith("http") ? rawUrl : "https://placeholder.supabase.co";
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
