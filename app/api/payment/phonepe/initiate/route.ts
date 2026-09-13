import { NextResponse } from "next/server";
import { initiatePhonePePay } from "@/lib/phonepe";
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
  const proto = req.headers.get("x-forwarded-proto") || (host?.includes("localhost") ? "http" : "https");

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
    const merchantTransactionId = `MT_${orderId.replace(/[^A-Z0-9]/gi, "")}_${Date.now()
      .toString(36)
      .toUpperCase()}`;

    const total = body.items.reduce(
      (sum: number, item: any) => sum + Number(item.price) * Number(item.quantity),
      0
    );

    if (total <= 0) {
      return NextResponse.json({ error: "Invalid order amount." }, { status: 400 });
    }

    const origin = getRequestOrigin(req);
    const callbackUrl = `${origin}/api/payment/phonepe/callback?orderId=${encodeURIComponent(
      orderId
    )}`;
    const redirectUrl = `${origin}/api/payment/phonepe/callback?orderId=${encodeURIComponent(
      orderId
    )}`;

    const now = new Date();
    const order: Order = {
      id: orderId,
      customer: body.customer,
      items: body.items,
      total,
      status: "Payment Pending",
      paymentMethod: "PhonePe Gateway",
      paymentStatus: "PENDING",
      phonepeTransactionId: merchantTransactionId,
      screenshot: "PHONEPE_GATEWAY_PENDING",
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

    // 3. Initiate payment with PhonePe PG
    const phonepeRes = await initiatePhonePePay({
      merchantTransactionId,
      merchantUserId: `MUID_${body.customer.phone.replace(/[^0-9]/g, "").slice(-10) || Date.now()}`,
      amount: total,
      redirectUrl,
      callbackUrl,
      mobileNumber: body.customer.phone,
    });

    if (phonepeRes.success && phonepeRes.data?.instrumentResponse?.redirectInfo?.url) {
      return NextResponse.json({
        success: true,
        orderId,
        merchantTransactionId,
        redirectUrl: phonepeRes.data.instrumentResponse.redirectInfo.url,
      });
    }

    console.error("[PhonePe Initiate] Error response from PhonePe:", phonepeRes);
    return NextResponse.json(
      {
        error: phonepeRes.message || "Failed to initialize PhonePe payment gateway session.",
        details: phonepeRes,
      },
      { status: 502 }
    );
  } catch (err: any) {
    console.error("[PhonePe Initiate] Server exception:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error initiating payment." },
      { status: 500 }
    );
  }
}
