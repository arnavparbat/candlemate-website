import { NextResponse } from "next/server";
import { getCashfreeOrder, getCashfreeOrderPayments } from "@/lib/cashfree";
import { getStore, saveStore } from "@/lib/store";
import { isSupabaseConfigured, updateOrderStatusInSupabase, supabase } from "@/lib/supabase";
import { notifyStudioNewOrder } from "@/lib/order-events";
import { Order } from "@/lib/types";

async function verifyOrder(orderId: string) {
  if (!orderId) {
    return { success: false, error: "Missing orderId parameter." };
  }

  // 1. Fetch ground truth directly from Cashfree API
  const cfOrder = await getCashfreeOrder(orderId);
  const payments = await getCashfreeOrderPayments(orderId);

  const successfulPayment = payments.find((p) => p.payment_status === "SUCCESS");
  const isPaid = cfOrder.order_status === "PAID" || !!successfulPayment;
  const cfPaymentId = successfulPayment?.cf_payment_id ? String(successfulPayment.cf_payment_id) : "";

  // 2. Find and update the order in store
  const db = getStore();
  const matchedOrder = db.orders.find((o) => o.id === orderId);

  if (matchedOrder) {
    if (isPaid) {
      const wasPending = matchedOrder.paymentStatus !== "SUCCESS";
      matchedOrder.status = "Order Received";
      matchedOrder.paymentStatus = "SUCCESS";
      matchedOrder.paymentMethod = "Cashfree Gateway";
      matchedOrder.cashfreeOrderId = cfOrder.cf_order_id;
      matchedOrder.cashfreePaymentId = cfPaymentId || matchedOrder.cashfreePaymentId || "CASHFREE_PAID";
      matchedOrder.transactionId = matchedOrder.cashfreePaymentId;
      matchedOrder.paidAt = matchedOrder.paidAt || new Date().toISOString();
      matchedOrder.screenshot = `CASHFREE_AUTO_VERIFIED:${matchedOrder.cashfreePaymentId}`;

      saveStore(db);

      // Notify studio dashboard in real-time via SSE if newly verified
      if (wasPending) {
        notifyStudioNewOrder(matchedOrder);
      }

      // Sync with Supabase
      if (isSupabaseConfigured()) {
        try {
          await updateOrderStatusInSupabase(matchedOrder.id, "Order Received");
          await supabase
            .from("orders")
            .update({
              screenshot: matchedOrder.screenshot,
              status: "Order Received",
            })
            .eq("id", matchedOrder.id);
        } catch (e: any) {
          console.error("[Cashfree Verify] Supabase sync error:", e.message);
        }
      }

      return {
        success: true,
        verified: true,
        status: "PAID",
        orderId: matchedOrder.id,
        paymentId: matchedOrder.cashfreePaymentId,
        order: matchedOrder,
      };
    } else if (cfOrder.order_status === "EXPIRED" || cfOrder.order_status === "TERMINATED") {
      matchedOrder.status = "Payment Failed";
      matchedOrder.paymentStatus = "FAILED";
      saveStore(db);

      if (isSupabaseConfigured()) {
        try {
          await updateOrderStatusInSupabase(matchedOrder.id, "Payment Failed");
        } catch {}
      }

      return {
        success: true,
        verified: false,
        status: cfOrder.order_status,
        orderId: matchedOrder.id,
        order: matchedOrder,
      };
    }

    return {
      success: true,
      verified: false,
      status: cfOrder.order_status, // "ACTIVE"
      orderId: matchedOrder.id,
      order: matchedOrder,
    };
  }

  return {
    success: true,
    verified: isPaid,
    status: cfOrder.order_status,
    orderId,
  };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const orderId = url.searchParams.get("orderId") || url.searchParams.get("order_id");

    if (!orderId) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    }

    const result = await verifyOrder(orderId);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[Cashfree Verify GET Error]", error);
    return NextResponse.json({ error: error.message || "Verification failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const orderId = body.orderId || body.order_id;

    if (!orderId) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    }

    const result = await verifyOrder(orderId);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[Cashfree Verify POST Error]", error);
    return NextResponse.json({ error: error.message || "Verification failed" }, { status: 500 });
  }
}
