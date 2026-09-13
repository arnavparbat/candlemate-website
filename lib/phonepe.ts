import crypto from "crypto";

export interface PhonePeConfig {
  merchantId: string;
  saltKey: string;
  saltIndex: string;
  env: string;
  hostUrl: string;
}

export function getPhonePeConfig(): PhonePeConfig {
  const env = (process.env.PHONEPE_ENV || "UAT").toUpperCase();
  const merchantId = process.env.PHONEPE_MERCHANT_ID || "PGTESTPAYUAT86";
  const saltKey = process.env.PHONEPE_SALT_KEY || "96434309-7796-489d-8924-ab56988a6076";
  const saltIndex = process.env.PHONEPE_SALT_INDEX || "1";

  let hostUrl = process.env.PHONEPE_HOST_URL;
  if (!hostUrl) {
    if (env === "PRODUCTION" || env === "PROD") {
      hostUrl = "https://api.phonepe.com/apis/hermes";
    } else {
      hostUrl = "https://api-preprod.phonepe.com/apis/pg-sandbox";
    }
  }

  return {
    merchantId,
    saltKey,
    saltIndex,
    env,
    hostUrl: hostUrl.replace(/\/$/, ""),
  };
}

/**
 * Calculates SHA256 hex digest for given text
 */
export function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

/**
 * Generates PhonePe X-VERIFY header for /pg/v1/pay
 * Formula: SHA256(base64Payload + "/pg/v1/pay" + saltKey) + "###" + saltIndex
 */
export function createPayChecksum(base64Payload: string, saltKey: string, saltIndex: string): string {
  const hash = sha256(`${base64Payload}/pg/v1/pay${saltKey}`);
  return `${hash}###${saltIndex}`;
}

/**
 * Generates PhonePe X-VERIFY header for Status Check API
 * Formula: SHA256("/pg/v1/status/" + merchantId + "/" + merchantTransactionId + saltKey) + "###" + saltIndex
 */
export function createStatusChecksum(
  merchantId: string,
  merchantTransactionId: string,
  saltKey: string,
  saltIndex: string
): string {
  const hash = sha256(`/pg/v1/status/${merchantId}/${merchantTransactionId}${saltKey}`);
  return `${hash}###${saltIndex}`;
}

/**
 * Verifies PhonePe S2S Callback Checksum
 * Formula: SHA256(responseBase64 + saltKey) + "###" + saltIndex
 */
export function verifyCallbackChecksum(
  responseBase64: string,
  receivedXVerify: string,
  saltKey: string,
  saltIndex: string
): boolean {
  if (!receivedXVerify) return false;
  const expectedHash = sha256(`${responseBase64}${saltKey}`);
  const expectedChecksum = `${expectedHash}###${saltIndex}`;
  return expectedChecksum === receivedXVerify;
}

export interface InitiatePaymentParams {
  merchantTransactionId: string;
  merchantUserId: string;
  amount: number; // in INR
  redirectUrl: string;
  callbackUrl: string;
  mobileNumber?: string;
}

export interface PhonePeInitiateResponse {
  success: boolean;
  code: string;
  message: string;
  data?: {
    merchantId: string;
    merchantTransactionId: string;
    instrumentResponse?: {
      type: string;
      redirectInfo?: {
        url: string;
        method: string;
      };
    };
  };
}

/**
 * Calls PhonePe /pg/v1/pay endpoint to initialize an automated payment session
 */
export async function initiatePhonePePay(
  params: InitiatePaymentParams
): Promise<PhonePeInitiateResponse> {
  const config = getPhonePeConfig();

  // PhonePe amounts are in Paise (1 INR = 100 Paise)
  const amountInPaise = Math.round(params.amount * 100);
  const rawPhone = (params.mobileNumber || "9999999999").replace(/[^0-9]/g, "");
  const mobileNumber = rawPhone.length >= 10 ? rawPhone.slice(-10) : "9999999999";

  const payload = {
    merchantId: config.merchantId,
    merchantTransactionId: params.merchantTransactionId,
    merchantUserId: params.merchantUserId,
    amount: amountInPaise,
    redirectUrl: params.redirectUrl,
    redirectMode: "POST",
    callbackUrl: params.callbackUrl,
    mobileNumber,
    paymentInstrument: {
      type: "PAY_PAGE",
    },
  };

  const base64Payload = Buffer.from(JSON.stringify(payload)).toString("base64");
  const xVerify = createPayChecksum(base64Payload, config.saltKey, config.saltIndex);

  const endpoint = `${config.hostUrl}/pg/v1/pay`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-VERIFY": xVerify,
    },
    body: JSON.stringify({ request: base64Payload }),
  });

  const data: PhonePeInitiateResponse = await response.json();
  return data;
}

export interface PhonePeStatusResponse {
  success: boolean;
  code: string;
  message: string;
  data?: {
    merchantId: string;
    merchantTransactionId: string;
    transactionId: string;
    amount: number;
    state: "COMPLETED" | "FAILED" | "PENDING";
    responseCode: string;
    paymentInstrument?: any;
  };
}

/**
 * Checks payment status with PhonePe Server API
 */
export async function fetchPhonePeStatus(
  merchantTransactionId: string
): Promise<PhonePeStatusResponse> {
  const config = getPhonePeConfig();
  const xVerify = createStatusChecksum(
    config.merchantId,
    merchantTransactionId,
    config.saltKey,
    config.saltIndex
  );

  const endpoint = `${config.hostUrl}/pg/v1/status/${config.merchantId}/${merchantTransactionId}`;
  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "X-VERIFY": xVerify,
      "X-MERCHANT-ID": config.merchantId,
    },
    cache: "no-store",
  });

  const data: PhonePeStatusResponse = await response.json();
  return data;
}
