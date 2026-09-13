import { NextResponse } from "next/server";
import { getCashfreeOrder, getCashfreeOrderPayments } from "@/lib/cashfree";
import { getStore, saveStore } from "@/lib/store";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
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
  const cfPaymentId = successfulPayment?.cf_payment_id
    ? String(successfulPayment.cf_payment_id)
    : "";

  const screenshotProof = `CASHFREE_AUTO_VERIFIED:${cfPaymentId || "PAID"}`;

  // 2. Fetch order from memory store OR Supabase
  const db = getStore();
  let matchedOrder: Order | undefined = db.orders.find((o) => o.id === orderId);

  if (!matchedOrder && isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .maybeSingle();

      if (!error && data) {
        matchedOrder = {
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
      console.warn("[Cashfree Verify] Supabase fetch fallback warning:", err.message);
    }
  }

  if (isPaid) {
    // 3. Immediately persist verified status to Supabase (ground truth cloud store)
    if (isSupabaseConfigured()) {
      try {
        await supabase
          .from("orders")
          .update({
            status: "Order Received",
            screenshot: screenshotProof,
          })
          .eq("id", orderId);
        console.log(`[Cashfree Verify] Successfully marked order ${orderId} as PAID in Supabase.`);
      } catch (err: any) {
        console.error("[Cashfree Verify] Error updating Supabase order status:", err.message);
      }
    }

    if (matchedOrder) {
      const wasPending = matchedOrder.paymentStatus !== "SUCCESS" && matchedOrder.status !== "Order Received";
      matchedOrder.status = "Order Received";
      matchedOrder.paymentStatus = "SUCCESS";
      matchedOrder.paymentMethod = "Cashfree Gateway";
      matchedOrder.cashfreeOrderId = cfOrder.cf_order_id;
      matchedOrder.cashfreePaymentId = cfPaymentId || "CASHFREE_PAID";
      matchedOrder.transactionId = cfPaymentId || "CASHFREE_PAID";
      matchedOrder.paidAt = matchedOrder.paidAt || new Date().toISOString();
      matchedOrder.screenshot = screenshotProof;

      saveStore(db);

      if (wasPending) {
        notifyStudioNewOrder(matchedOrder);
      }
    } else {
      matchedOrder = {
        id: orderId,
        customer: {
          name: cfOrder.customer_details?.customer_name || "Customer",
          phone: cfOrder.customer_details?.customer_phone || "",
          address: "",
        },
        items: [],
        total: Number(cfOrder.order_amount) || 0,
        status: "Order Received",
        paymentMethod: "Cashfree Gateway",
        paymentStatus: "SUCCESS",
        cashfreeOrderId: cfOrder.cf_order_id,
        cashfreePaymentId: cfPaymentId || "CASHFREE_PAID",
        transactionId: cfPaymentId || "CASHFREE_PAID",
        screenshot: screenshotProof,
        createdAt: new Date().toISOString(),
      };
    }

    return {
      success: true,
      verified: true,
      status: "PAID",
      orderId,
      paymentId: cfPaymentId || "CASHFREE_PAID",
      order: matchedOrder,
    };
  } else if (cfOrder.order_status === "EXPIRED" || cfOrder.order_status === "TERMINATED") {
    if (matchedOrder) {
      matchedOrder.status = "Payment Failed";
      matchedOrder.paymentStatus = "FAILED";
      saveStore(db);
    }
    if (isSupabaseConfigured()) {
      try {
        await supabase
          .from("orders")
          .update({ status: "Payment Failed" })
          .eq("id", orderId);
      } catch {}
    }

    return {
      success: true,
      verified: false,
      status: cfOrder.order_status,
      orderId,
      order: matchedOrder,
    };
  }

  return {
    success: true,
    verified: false,
    status: cfOrder.order_status, // "ACTIVE"
    orderId,
    order: matchedOrder,
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
