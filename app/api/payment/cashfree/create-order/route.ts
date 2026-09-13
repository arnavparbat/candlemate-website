import { NextResponse } from "next/server";
import { createCashfreeOrder, getCashfreeConfig } from "@/lib/cashfree";
import { getStore, saveStore } from "@/lib/store";
import { isSupabaseConfigured, insertOrderToSupabase } from "@/lib/supabase";
import { Order } from "@/lib/types";

function getRequestOrigin(req: Request): string {
  const originHeader = req.headers.get("origin");
  if (originHeader) {
    return originHeader.replace(/\/$/, "");
  }

  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "");
  }

  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto =
    req.headers.get("x-forwarded-proto") || (host?.includes("localhost") ? "http" : "https");

  if (host) {
    return `${proto}://${host}`;
  }

  return "http://localhost:3000";
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (
      !body.customer?.name ||
      !body.customer?.address ||
      !/^\+?[0-9\s-]{8,16}$/.test(body.customer?.phone || "")
    ) {
      return NextResponse.json(
        { error: "Please enter your name, full address, and a valid contact number." },
        { status: 400 }
      );
    }

    if (!body.items?.length) {
      return NextResponse.json({ error: "Your bag is empty." }, { status: 400 });
    }

    const orderId = `CM-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    const total = body.items.reduce(
      (sum: number, item: any) => sum + Number(item.price) * Number(item.quantity),
      0
    );

    if (total <= 0) {
      return NextResponse.json({ error: "Invalid order amount." }, { status: 400 });
    }

    const origin = getRequestOrigin(req);
    const returnUrl = `${origin}/checkout?order_id=${encodeURIComponent(orderId)}`;
    const notifyUrl = `${origin}/api/payment/cashfree/webhook`;

    const now = new Date();
    const order: Order = {
      id: orderId,
      customer: body.customer,
      items: body.items,
      total,
      status: "Payment Pending",
      paymentMethod: "Cashfree Gateway",
      paymentStatus: "PENDING",
      screenshot: "CASHFREE_GATEWAY_PENDING",
      createdAt: now.toISOString(),
    };

    // 1. Persist initial order to store
    const db = getStore();
    db.orders.unshift(order);
    saveStore(db);

    // 2. Persist to Supabase if configured
    if (isSupabaseConfigured()) {
      await insertOrderToSupabase(order);
    }

    // 3. Initiate payment session with Cashfree PG
    const cashfreeRes = await createCashfreeOrder({
      orderId,
      orderAmount: total,
      customer: {
        name: body.customer.name,
        phone: body.customer.phone,
        email: body.customer.email,
      },
      returnUrl,
      notifyUrl,
      orderNote: `Candlemate Order ${orderId}`,
    });

    const config = getCashfreeConfig();

    return NextResponse.json({
      success: true,
      orderId,
      paymentSessionId: cashfreeRes.payment_session_id,
      cfOrderId: cashfreeRes.cf_order_id,
      environment: config.env.toLowerCase(), // "production" or "sandbox"
    });
  } catch (error: any) {
    console.error("[Cashfree Create Order Error]", error);
    return NextResponse.json(
      {
        error: error.message || "Failed to initiate Cashfree payment session. Please try again.",
      },
      { status: 500 }
    );
  }
}
