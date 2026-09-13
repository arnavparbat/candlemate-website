import { NextResponse } from "next/server";
import {
  getPhonePeConfig,
  verifyCallbackChecksum,
  fetchPhonePeStatus,
} from "@/lib/phonepe";
import { getStore, saveStore } from "@/lib/store";
import { isSupabaseConfigured, updateOrderStatusInSupabase, supabase } from "@/lib/supabase";
import { notifyStudioNewOrder } from "@/lib/order-events";
import { Order } from "@/lib/types";

function getRequestOrigin(req: Request): string {
  const originHeader = req.headers.get("origin");
  if (originHeader) return originHeader.replace(/\/$/, "");

  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "");
  }

  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || (host?.includes("localhost") ? "http" : "https");

  if (host) return `${proto}://${host}`;
  return "http://localhost:3000";
}

async function parseRequestBody(req: Request): Promise<{ responseBase64?: string; rawBody?: any }> {
  const contentType = req.headers.get("content-type") || "";

  try {
    if (contentType.includes("application/json")) {
      const json = await req.json();
      return { responseBase64: json.response, rawBody: json };
    }

    if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      const formData = await req.formData();
      const responseVal = formData.get("response");
      const entries = Object.fromEntries(formData.entries());
      return {
        responseBase64: typeof responseVal === "string" ? responseVal : undefined,
        rawBody: entries,
      };
    }

    const text = await req.text();
    if (text.startsWith("{")) {
      const json = JSON.parse(text);
      return { responseBase64: json.response, rawBody: json };
    }

    const params = new URLSearchParams(text);
    return {
      responseBase64: params.get("response") || undefined,
      rawBody: Object.fromEntries(params.entries()),
    };
  } catch {
    return {};
  }
}

export async function POST(req: Request) {
  const origin = getRequestOrigin(req);
  const url = new URL(req.url);
  const queryOrderId = url.searchParams.get("orderId");
  const config = getPhonePeConfig();

  const isBrowserRequest =
    req.headers.get("accept")?.includes("text/html") ||
    req.headers.get("sec-fetch-dest") === "document" ||
    req.headers.get("content-type")?.includes("application/x-www-form-urlencoded");

  try {
    const { responseBase64, rawBody } = await parseRequestBody(req);
    const xVerifyHeader = req.headers.get("x-verify") || "";

    let merchantTransactionId = "";
    let isSuccess = false;
    let transactionId = "";
    let decodedResponse: any = null;

    if (responseBase64) {
      // 1. Verify Checksum if x-verify header is supplied
      if (xVerifyHeader) {
        const isValid = verifyCallbackChecksum(
          responseBase64,
          xVerifyHeader,
          config.saltKey,
          config.saltIndex
        );
        if (!isValid) {
          console.warn("[PhonePe Callback] Checksum verification mismatch!");
        }
      }

      try {
        const decodedText = Buffer.from(responseBase64, "base64").toString("utf-8");
        decodedResponse = JSON.parse(decodedText);
        merchantTransactionId = decodedResponse.data?.merchantTransactionId || "";
        transactionId = decodedResponse.data?.transactionId || "";
        isSuccess =
          decodedResponse.code === "PAYMENT_SUCCESS" ||
          decodedResponse.data?.state === "COMPLETED";
      } catch (e: any) {
        console.error("[PhonePe Callback] Error decoding base64 payload:", e.message);
      }
    } else if (rawBody) {
      merchantTransactionId =
        rawBody.merchantTransactionId ||
        rawBody.transactionId ||
        "";
      if (rawBody.code === "PAYMENT_SUCCESS") {
        isSuccess = true;
      }
    }

    // 2. Fetch ground-truth status from PhonePe Status Check API if we have merchantTransactionId
    if (merchantTransactionId) {
      try {
        const statusCheck = await fetchPhonePeStatus(merchantTransactionId);
        if (
          statusCheck.success &&
          (statusCheck.code === "PAYMENT_SUCCESS" || statusCheck.data?.state === "COMPLETED")
        ) {
          isSuccess = true;
          if (statusCheck.data?.transactionId) {
            transactionId = statusCheck.data.transactionId;
          }
        }
      } catch (err: any) {
        console.warn("[PhonePe Callback] Error verifying status via Status API:", err.message);
      }
    }

    // 3. Find and update order
    const db = getStore();
    let matchedOrder: Order | undefined = db.orders.find(
      (o) =>
        (queryOrderId && o.id === queryOrderId) ||
        (merchantTransactionId && o.phonepeTransactionId === merchantTransactionId)
    );

    if (matchedOrder) {
      if (isSuccess) {
        matchedOrder.status = "Order Received";
        matchedOrder.paymentStatus = "SUCCESS";
        matchedOrder.transactionId = transactionId || matchedOrder.transactionId || "PHONEPE-VERIFIED";
        matchedOrder.paidAt = new Date().toISOString();
        matchedOrder.screenshot = `PHONEPE_AUTO_VERIFIED:${matchedOrder.transactionId}`;

        // Notify studio dashboard via SSE
        notifyStudioNewOrder(matchedOrder);

        // Update in Supabase
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
            console.error("[PhonePe Callback] Supabase update error:", e.message);
          }
        }
      } else {
        matchedOrder.status = "Payment Failed";
        matchedOrder.paymentStatus = "FAILED";
      }
      saveStore(db);
    }

    const targetOrderId = matchedOrder?.id || queryOrderId || "";

    // 4. Return response: browser redirect or JSON for webhook
    if (isBrowserRequest) {
      const redirectTarget = isSuccess
        ? `${origin}/checkout?orderId=${encodeURIComponent(targetOrderId)}&status=success`
        : `${origin}/checkout?orderId=${encodeURIComponent(targetOrderId)}&status=failed`;

      return NextResponse.redirect(redirectTarget, { status: 303 });
    }

    return NextResponse.json({
      success: isSuccess,
      message: isSuccess ? "Payment verified successfully" : "Payment failed or pending",
      orderId: targetOrderId,
      transactionId,
    });
  } catch (err: any) {
    console.error("[PhonePe Callback] Unhandled callback error:", err);
    if (isBrowserRequest) {
      return NextResponse.redirect(
        `${origin}/checkout?orderId=${encodeURIComponent(queryOrderId || "")}&status=error`,
        { status: 303 }
      );
    }
    return NextResponse.json({ error: "Internal callback error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const origin = getRequestOrigin(req);
  const url = new URL(req.url);
  const orderId = url.searchParams.get("orderId");

  if (!orderId) {
    return NextResponse.redirect(`${origin}/checkout`, { status: 303 });
  }

  // Check order status
  const db = getStore();
  const order = db.orders.find((o) => o.id === orderId);

  if (order?.phonepeTransactionId && order.paymentStatus !== "SUCCESS") {
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
      console.warn("[PhonePe Callback GET] Status check error:", e.message);
    }
  }

  const isSuccess = order?.paymentStatus === "SUCCESS" || order?.status === "Order Received";
  const redirectTarget = isSuccess
    ? `${origin}/checkout?orderId=${encodeURIComponent(orderId)}&status=success`
    : `${origin}/checkout?orderId=${encodeURIComponent(orderId)}&status=failed`;

  return NextResponse.redirect(redirectTarget, { status: 303 });
}
