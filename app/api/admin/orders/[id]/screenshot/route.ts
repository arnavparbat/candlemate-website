import { getStore, saveStore, getStoreAsync, saveStoreAsync } from "@/lib/store";
import { isSupabaseConfigured, deleteScreenshotFromSupabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // 1. Delete from Supabase if configured
  if (isSupabaseConfigured()) {
    await deleteScreenshotFromSupabase(id);
  }

  // 2. Fallback to local store
  const db = getStore();
  const order = db.orders.find((o) => o.id === id);

  if (order) {
    delete order.screenshot;
    order.screenshotExpired = true;
    saveStore(db);
  }

  return NextResponse.json({
    success: true,
    message: "Screenshot deleted from storage",
    orderId: id,
  });
}
