import crypto from "crypto";

export interface CashfreeConfig {
  env: "PRODUCTION" | "SANDBOX";
  appId: string;
  secretKey: string;
  apiVersion: string;
  hostUrl: string;
}

export function getCashfreeConfig(): CashfreeConfig {
  const envRaw = (process.env.CASHFREE_ENV || "PRODUCTION").toUpperCase().trim();
  const env = envRaw === "SANDBOX" ? "SANDBOX" : "PRODUCTION";
  const appId = (process.env.CASHFREE_APP_ID || "").trim();
  const secretKey = (process.env.CASHFREE_SECRET_KEY || "").trim();
  const apiVersion = (process.env.CASHFREE_API_VERSION || "2023-08-01").trim();

  const hostUrl =
    env === "PRODUCTION"
      ? "https://api.cashfree.com/pg"
      : "https://sandbox.cashfree.com/pg";

  return {
    env,
    appId,
    secretKey,
    apiVersion,
    hostUrl,
  };
}

export interface CreateOrderParams {
  orderId: string;
  orderAmount: number;
  customer: {
    name: string;
    phone: string;
    email?: string;
  };
  returnUrl?: string;
  notifyUrl?: string;
  orderNote?: string;
}

export interface CashfreeOrderResponse {
  cf_order_id: string;
  order_id: string;
  entity: string;
  order_currency: string;
  order_amount: number;
  order_status: "ACTIVE" | "PAID" | "EXPIRED" | "TERMINATED";
  payment_session_id: string;
  order_expiry_time?: string;
  order_note?: string;
  message?: string;
  code?: string;
  type?: string;
}

export interface CashfreePaymentRecord {
  cf_payment_id: string;
  order_id: string;
  entity: string;
  payment_currency: string;
  payment_amount: number;
  payment_time: string;
  payment_status: "SUCCESS" | "FAILED" | "PENDING" | "USER_DROPPED";
  payment_message?: string;
  payment_group?: string;
  payment_method?: any;
}

/**
 * Creates an order in Cashfree Payment Gateway to obtain a payment_session_id
 */
export async function createCashfreeOrder(
  params: CreateOrderParams
): Promise<CashfreeOrderResponse> {
  const config = getCashfreeConfig();

  if (!config.appId || !config.secretKey) {
    throw new Error(
      "Cashfree credentials missing. Ensure CASHFREE_APP_ID and CASHFREE_SECRET_KEY are set."
    );
  }

  // Clean phone number: remove non-digits, take last 10 digits
  const rawDigits = params.customer.phone.replace(/[^0-9]/g, "");
  const cleanPhone = rawDigits.length >= 10 ? rawDigits.slice(-10) : "9999999999";
  const customerId = `CUST_${cleanPhone}_${Math.random().toString(36).slice(2, 6)}`;
  const cleanName = params.customer.name.trim().slice(0, 50) || "Candlemate Customer";
  const cleanEmail =
    params.customer.email?.trim() || `${cleanPhone}@candlemate.customer`;

  const payload: any = {
    order_id: params.orderId,
    order_amount: Number(params.orderAmount.toFixed(2)),
    order_currency: "INR",
    customer_details: {
      customer_id: customerId,
      customer_name: cleanName,
      customer_phone: cleanPhone,
      customer_email: cleanEmail,
    },
    order_meta: {
      return_url: params.returnUrl || undefined,
      notify_url: params.notifyUrl || undefined,
      payment_methods: "upi,cc,dc,nb",
    },
    order_note: params.orderNote || `Candlemate Order ${params.orderId}`,
  };

  const url = `${config.hostUrl}/orders`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "x-client-id": config.appId,
      "x-client-secret": config.secretKey,
      "x-api-version": config.apiVersion,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  const responseJson = await res.json();

  if (!res.ok) {
    const errorMsg =
      responseJson.message ||
      responseJson.description ||
      `Cashfree error (${res.status})`;
    console.error("[Cashfree Create Order Error]", res.status, responseJson);
    throw new Error(errorMsg);
  }

  return responseJson as CashfreeOrderResponse;
}

/**
 * Fetches order details from Cashfree to verify order status
 */
export async function getCashfreeOrder(orderId: string): Promise<CashfreeOrderResponse> {
  const config = getCashfreeConfig();

  const url = `${config.hostUrl}/orders/${encodeURIComponent(orderId)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "x-client-id": config.appId,
      "x-client-secret": config.secretKey,
      "x-api-version": config.apiVersion,
      Accept: "application/json",
    },
  });

  const responseJson = await res.json();

  if (!res.ok) {
    const errorMsg =
      responseJson.message || `Cashfree fetch error (${res.status})`;
    console.error("[Cashfree Fetch Order Error]", res.status, responseJson);
    throw new Error(errorMsg);
  }

  return responseJson as CashfreeOrderResponse;
}

/**
 * Fetches payment attempts for a given order ID from Cashfree
 */
export async function getCashfreeOrderPayments(
  orderId: string
): Promise<CashfreePaymentRecord[]> {
  const config = getCashfreeConfig();

  const url = `${config.hostUrl}/orders/${encodeURIComponent(orderId)}/payments`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "x-client-id": config.appId,
      "x-client-secret": config.secretKey,
      "x-api-version": config.apiVersion,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    console.warn("[Cashfree Fetch Payments Warning]", res.status);
    return [];
  }

  const responseJson = await res.json();
  return Array.isArray(responseJson) ? responseJson : [];
}

/**
 * Verifies Cashfree Webhook HMAC-SHA256 signature
 * Signature formula: base64(hmac_sha256(timestamp + rawBody, secretKey))
 */
export function verifyCashfreeWebhookSignature(
  rawBody: string,
  signature: string,
  timestamp: string,
  secretKey: string
): boolean {
  try {
    const data = `${timestamp}${rawBody}`;
    const generatedSignature = crypto
      .createHmac("sha256", secretKey)
      .update(data)
      .digest("base64");
    return generatedSignature === signature;
  } catch (err) {
    console.error("[Cashfree Signature Verification Error]", err);
    return false;
  }
}
