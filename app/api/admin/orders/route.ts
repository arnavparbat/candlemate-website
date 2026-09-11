import { getStore } from "@/lib/store";
import { isSupabaseConfigured, fetchOrdersFromSupabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET() {
  if (isSupabaseConfigured()) {
    const supabaseOrders = await fetchOrdersFromSupabase();
    if (supabaseOrders) {
      return NextResponse.json(supabaseOrders);
    }
  }
  return NextResponse.json(getStore().orders);
}
