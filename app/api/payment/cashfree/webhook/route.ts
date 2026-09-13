import { NextResponse } from "next/server";
import {
  getCashfreeConfig,
  verifyCashfreeWebhookSignature,
  getCashfreeOrder,
} from "@/lib/cashfree";
import { getStore, saveStore } from "@/lib/store";
import { isSupabaseConfigured, updateOrderStatusInSupabase, supabase } from "@/lib/supabase";
import { notifyStudioNewOrder } from "@/lib/order-events";

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-webhook-signature") || "";
    const timestamp = req.headers.get("x-webhook-timestamp") || "";
    const config = getCashfreeConfig();

    let isSignatureValid = false;
    if (signature && timestamp && config.secretKey) {
      isSignatureValid = verifyCashfreeWebhookSignature(
        rawBody,
        signature,
        timestamp,
        config.secretKey
      );
    }

    let payload: any = {};
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const eventType = payload.type || "";
    const orderData = payload.data?.order || {};
    const paymentData = payload.data?.payment || {};

    const orderId = orderData.order_id || payload.orderId || "";
    const paymentStatus = paymentData.payment_status || "";
    const cfPaymentId = paymentData.cf_payment_id ? String(paymentData.cf_payment_id) : "";

    console.log(`[Cashfree Webhook] Event: ${eventType} for order: ${orderId}, status: ${paymentStatus}`);

    if (!orderId) {
      return NextResponse.json({ received: true, note: "No order_id in payload" });
    }

    // If signature was not passed, verify directly by querying Cashfree PG API
    let isConfirmedPaid =
      eventType === "PAYMENT_SUCCESS_WEBHOOK" || paymentStatus === "SUCCESS";

    if (!isConfirmedPaid) {
      try {
        const cfOrder = await getCashfreeOrder(orderId);
        if (cfOrder.order_status === "PAID") {
          isConfirmedPaid = true;
        }
      } catch (err) {
        console.warn("[Cashfree Webhook] Error double-checking order status:", err);
      }
    }

    if (isConfirmedPaid) {
      const screenshotProof = `CASHFREE_AUTO_VERIFIED:${cfPaymentId || "PAID"}`;

      if (isSupabaseConfigured()) {
        try {
          await supabase
            .from("orders")
            .update({
              screenshot: screenshotProof,
              status: "Order Received",
            })
            .eq("id", orderId);
          console.log(`[Cashfree Webhook] Successfully marked order ${orderId} as PAID in Supabase.`);
        } catch (e: any) {
          console.error("[Cashfree Webhook] Supabase sync error:", e.message);
        }
      }

      const db = getStore();
      const matchedOrder = db.orders.find((o) => o.id === orderId);

      if (matchedOrder) {
        const wasPending = matchedOrder.paymentStatus !== "SUCCESS";

        matchedOrder.status = "Order Received";
        matchedOrder.paymentStatus = "SUCCESS";
        matchedOrder.paymentMethod = "Cashfree Gateway";
        if (cfPaymentId) matchedOrder.cashfreePaymentId = cfPaymentId;
        matchedOrder.transactionId = cfPaymentId || matchedOrder.transactionId || "CASHFREE_PAID";
        matchedOrder.paidAt = matchedOrder.paidAt || new Date().toISOString();
        matchedOrder.screenshot = screenshotProof;

        saveStore(db);

        if (wasPending) {
          notifyStudioNewOrder(matchedOrder);
        }
      }
    }

    return NextResponse.json({ status: "OK", received: true });
  } catch (error: any) {
    console.error("[Cashfree Webhook Error]", error);
    return NextResponse.json({ error: error.message || "Webhook handling error" }, { status: 500 });
  }
}
