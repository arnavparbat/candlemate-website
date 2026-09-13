import { NextResponse } from "next/server";
import { getStore, saveStore } from "@/lib/store";
import { fetchPhonePeStatus } from "@/lib/phonepe";
import { isSupabaseConfigured, updateOrderStatusInSupabase, supabase } from "@/lib/supabase";
import { notifyStudioNewOrder } from "@/lib/order-events";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const orderId = url.searchParams.get("orderId");

  if (!orderId) {
    return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
  }

  const db = getStore();
  let order = db.orders.find((o) => o.id === orderId);

  // Fallback to Supabase if not found in memory store
  if (!order && isSupabaseConfigured()) {
    try {
      const { data } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
      if (data) {
        order = {
          id: data.id,
          customer: {
            name: data.customer_name,
            phone: data.customer_phone,
            address: data.customer_address,
          },
          items: data.items || [],
          total: Number(data.total),
          status: data.status,
          screenshot: data.screenshot,
          createdAt: data.created_at,
        };
      }
    } catch (err: any) {
      console.warn("[PhonePe Status API] Supabase query error:", err.message);
    }
  }

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // If order status is pending, re-verify with PhonePe Status Check API
  if (order.phonepeTransactionId && order.paymentStatus !== "SUCCESS") {
    try {
      const statusRes = await fetchPhonePeStatus(order.phonepeTransactionId);
      if (
        statusRes.success &&
        (statusRes.code === "PAYMENT_SUCCESS" || statusRes.data?.state === "COMPLETED")
      ) {
        order.status = "Order Received";
        order.paymentStatus = "SUCCESS";
        order.transactionId = statusRes.data?.transactionId || "PHONEPE-VERIFIED";
        order.paidAt = new Date().toISOString();
        order.screenshot = `PHONEPE_AUTO_VERIFIED:${order.transactionId}`;
        saveStore(db);
        notifyStudioNewOrder(order);

        if (isSupabaseConfigured()) {
          await updateOrderStatusInSupabase(order.id, "Order Received");
          await supabase
            .from("orders")
            .update({ screenshot: order.screenshot, status: "Order Received" })
            .eq("id", order.id);
        }
      }
    } catch (e: any) {
      console.warn("[PhonePe Status API] Error checking status:", e.message);
    }
  }

  return NextResponse.json({
    success: true,
    order,
    isPaid: order.paymentStatus === "SUCCESS" || order.status === "Order Received",
  });
}
