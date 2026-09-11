import { getStore, saveStore, getStoreAsync, saveStoreAsync } from "@/lib/store";
import { isSupabaseConfigured, updateOrderStatusInSupabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const valid = ["Order Received", "Preparing", "Out for Delivery", "Delivered"];

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { status } = await req.json();

  if (!valid.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  // 1. Update in Supabase if configured
  if (isSupabaseConfigured()) {
    await updateOrderStatusInSupabase(id, status);
  }

  // 2. Fallback to local store
  const db = getStore();
  const order = db.orders.find((o) => o.id === id);
  if (order) {
    order.status = status;
    saveStore(db);
    return NextResponse.json(order);
  }

  return NextResponse.json({ id, status });
}
