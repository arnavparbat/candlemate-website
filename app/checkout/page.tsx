"use client";

import { Header } from "@/components/header";
import { useCart } from "@/components/cart-context";
import { Candle, CandleStage } from "@/components/candle";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import { FormEvent, useEffect, useState, useRef } from "react";
import { uploadScreenshotToSupabase, isSupabaseConfigured } from "@/lib/supabase";
import Link from "next/link";

type Phase = "details" | "pay" | "burning" | "done";

export default function Checkout() {
  const { items, total, clear } = useCart();
  const [phase, setPhase] = useState<Phase>("details");
  const [upi, setUpi] = useState("9552682389@ybl");
  const [form, setForm] = useState({ name: "", address: "", phone: "" });
  const [error, setError] = useState("");
  const [shot, setShot] = useState("");
  const [order, setOrder] = useState<any>(null);

  // Preserved order details snapshot when cart is cleared
  const [placedOrder, setPlacedOrder] = useState<{
    id: string;
    customer: { name: string; address: string; phone: string };
    items: Array<{ name: string; quantity: number; price: number }>;
    total: number;
    paymentMethod?: string;
    transactionId?: string;
  } | null>(null);

  // PhonePe Payment Gateway states
  const [phonepeLoading, setPhonepeLoading] = useState(false);
  const [phonepeError, setPhonepeError] = useState("");

  // Payment feedback and state
  const [payHint, setPayHint] = useState<string>("");
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [qrDownloaded, setQrDownloaded] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"qr" | "number" | "app">("qr");
  const [deviceType, setDeviceType] = useState<"android" | "ios" | "other">("other");
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const hasAutoRedirected = useRef(false);

  useEffect(() => {
    fetch("/api/settings/payment")
      .then((r) => r.json())
      .then((x) => {
        if (x.upiId) setUpi(x.upiId);
      })
      .catch(() => {});

    if (typeof navigator !== "undefined") {
      const ua = navigator.userAgent || "";
      if (/Android/i.test(ua)) setDeviceType("android");
      else if (/iPhone|iPad|iPod/i.test(ua)) setDeviceType("ios");
      else setDeviceType("other");
    }

    // Auto-detect return from PhonePe Payment Gateway
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const orderIdParam = params.get("orderId");
      const statusParam = params.get("status");

      if (orderIdParam && statusParam === "success") {
        setPhase("burning");
        fetch(`/api/payment/phonepe/status?orderId=${encodeURIComponent(orderIdParam)}`)
          .then((r) => r.json())
          .then((data) => {
            if (data.order) {
              setPlacedOrder({
                id: data.order.id,
                customer: data.order.customer,
                items: data.order.items || [],
                total: Number(data.order.total),
                paymentMethod: data.order.paymentMethod || "PhonePe Gateway",
                transactionId: data.order.transactionId,
              });
              setOrder(data.order);
              clear();
              setTimeout(() => setPhase("done"), 2200);
            }
          })
          .catch(() => {
            clear();
            setPhase("done");
          });
      } else if (statusParam === "failed" || statusParam === "error") {
        setError("⚠️ PhonePe payment was cancelled or could not be completed. You can retry or choose an alternative payment option below.");
        setPhase("pay");
      }
    }
  }, []);

  async function payWithPhonePe(overrideForm?: { name: string; address: string; phone: string }) {
    const activeForm = overrideForm || form;
    if (!items.length) {
      setError("Your bag is empty.");
      return;
    }
    if (!activeForm.name || activeForm.address.length < 8 || !/^\+?[0-9\s-]{8,16}$/.test(activeForm.phone)) {
      setError("Please enter your name, full address, and a valid contact number.");
      return;
    }

    setError("");
    setPhonepeError("");
    setPhonepeLoading(true);

    try {
      const res = await fetch("/api/payment/phonepe/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: activeForm,
          items,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success || !data.redirectUrl) {
        throw new Error(data.error || "Could not start PhonePe payment session. Please try again.");
      }

      // 1-Click Auto-Launch: Redirect customer directly to PhonePe Gateway
      window.location.href = data.redirectUrl;
    } catch (err: any) {
      console.error("[PhonePe Checkout] Initiation error:", err);
      setPhonepeError(err.message || "Failed to initialize PhonePe payment.");
      setPhonepeLoading(false);
    }
  }

  // Standard NPCI formatted UPI URI (2 decimal places, clean payee & note)
  const formattedAmount = Number(total).toFixed(2);
  const paymentUri = `upi://pay?pa=${encodeURIComponent(upi)}&pn=${encodeURIComponent(
    "Candlemate Studio"
  )}&am=${encodeURIComponent(formattedAmount)}&cu=INR&tn=${encodeURIComponent("Candlemate Order")}`;

  const candleStage: CandleStage =
    phase === "details"
      ? "checkout"
      : phase === "pay"
      ? "lighting"
      : phase === "burning"
      ? "burning"
      : "done";

  function details(e: FormEvent) {
    e.preventDefault();
    if (!items.length) return setError("Your bag is empty.");
    if (!form.name || form.address.length < 8 || !/^\+?[0-9\s-]{8,16}$/.test(form.phone)) {
      return setError("Please enter your name, full address, and a valid contact number.");
    }
    setError("");
    setPhase("pay");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function copyPhone() {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText("9552682389").then(() => {
        setCopiedPhone(true);
        setPayHint("✓ Mobile +91 9552682389 copied! Inside PhonePe / GPay, select 'To Mobile Number' and paste to pay.");
        setTimeout(() => setCopiedPhone(false), 3000);
      });
    }
  }

  function copyUpiId() {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(upi).then(() => {
        setCopiedUpi(true);
        setPayHint(`✓ Studio UPI ID (${upi}) copied! Inside any UPI app, select 'To UPI ID' and paste to pay.`);
        setTimeout(() => setCopiedUpi(false), 3000);
      });
    }
  }

  function saveQrCode() {
    const canvas = qrCanvasRef.current;
    if (!canvas) return;
    try {
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `Candlemate-QR-Pay-Rs${total}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setQrDownloaded(true);
      setPayHint(
        `✓ QR Code saved to Photos! Now open PhonePe, Google Pay or Paytm, tap the Scanner icon (📷) at the top, select "Upload from Gallery", and pay ₹${total}.`
      );
      setTimeout(() => setQrDownloaded(false), 4500);
    } catch {
      setPayHint("Take a screenshot of the QR code to scan it directly from your UPI app gallery!");
    }
  }

  function getAppLaunchLink(
    appName: "PhonePe" | "Google Pay" | "Paytm" | "Universal",
    mode: "scan" | "mobile" | "intent"
  ): string {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
    const isAndroid = deviceType === "android" || /Android/i.test(ua);
    const isIos = deviceType === "ios" || /iPhone|iPad|iPod/i.test(ua);

    if (mode === "intent") {
      if (isAndroid) {
        const upiQuery = paymentUri.replace("upi://pay?", "");
        if (appName === "PhonePe") {
          return `intent://pay?${upiQuery}#Intent;scheme=upi;package=com.phonepe.app;end`;
        }
        if (appName === "Google Pay") {
          return `intent://pay?${upiQuery}#Intent;scheme=upi;package=com.google.android.apps.nbu.paisa.user;end`;
        }
        if (appName === "Paytm") {
          return `intent://pay?${upiQuery}#Intent;scheme=upi;package=net.one97.paytm;end`;
        }
        return paymentUri;
      }
      return paymentUri;
    }

    if (isAndroid) {
      if (appName === "PhonePe") {
        return "phonepe://";
      }
      if (appName === "Google Pay") {
        return "tez://upi/";
      }
      if (appName === "Paytm") {
        return "paytmmp://";
      }
      return paymentUri;
    }

    if (isIos) {
      if (appName === "PhonePe") return "phonepe://";
      if (appName === "Google Pay") return "gpay://";
      if (appName === "Paytm") return "paytmmp://";
      return paymentUri;
    }

    if (appName === "PhonePe") return "phonepe://";
    if (appName === "Google Pay") return "gpay://";
    if (appName === "Paytm") return "paytmmp://";
    return paymentUri;
  }

  function launchUpiApp(
    appName: "PhonePe" | "Google Pay" | "Paytm" | "Universal",
    mode: "scan" | "mobile" | "intent"
  ) {
    if (mode === "mobile") {
      copyPhone();
      setPayHint(
        `✓ Studio Mobile (9552682389) copied! Opening ${appName}... In ${appName}, tap "To Mobile Number", paste 9552682389, and pay ₹${total}.`
      );
    } else if (mode === "scan") {
      if (!qrDownloaded) {
        saveQrCode();
      }
      if (navigator?.clipboard) {
        navigator.clipboard.writeText(upi).catch(() => {});
      }
      setPayHint(
        `✓ QR saved! Opening ${appName}... In ${appName}, tap the Scanner icon (📷) at the top, select the QR photo from your gallery, and pay ₹${total}!`
      );
    } else {
      if (navigator?.clipboard) {
        navigator.clipboard.writeText(upi).catch(() => {});
      }
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 3000);
      setPayHint(
        `Opening ${appName}... If your bank shows "Payment not allowed from website", simply use the "Scan QR Code" or "Pay to Mobile: 9552682389" tab above!`
      );
    }
  }

  function fileToOptimizedScreenshot(file: File, maxDim = 1200, quality = 0.82): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new window.Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(String(e.target?.result));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.onerror = () => resolve(String(e.target?.result));
        img.src = String(e.target?.result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 15_000_000) return setError("Please choose an image smaller than 15 MB.");
    setError("");
    try {
      const optimized = await fileToOptimizedScreenshot(f);
      setShot(optimized);
    } catch {
      const reader = new FileReader();
      reader.onload = () => setShot(String(reader.result));
      reader.readAsDataURL(f);
    }
  }

  async function submit() {
    if (!shot) {
      return setError("⚠️ Please upload your payment screenshot to finalize and place your order.");
    }
    setError("");
    setPhase("burning");

    let finalScreenshot = shot;
    if (isSupabaseConfigured()) {
      try {
        const tempId = `CM-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
        const uploadedUrl = await uploadScreenshotToSupabase(tempId, shot);
        if (uploadedUrl) {
          finalScreenshot = uploadedUrl;
        }
      } catch {
        // Fallback to server-side upload
      }
    }

    const orderItemsSnapshot = [...items];
    const orderTotalSnapshot = total;
    const orderFormSnapshot = { ...form };

    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer: orderFormSnapshot, items: orderItemsSnapshot, screenshot: finalScreenshot }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not place order. Please try again.");
      setPhase("pay");
      return;
    }

    setPlacedOrder({
      id: data.id || "CM-STUDIO",
      customer: orderFormSnapshot,
      items: orderItemsSnapshot,
      total: orderTotalSnapshot,
    });
    setOrder(data);
    clear();
    setTimeout(() => setPhase("done"), 3300);
  }

  // Pre-format WhatsApp Message and Direct Link to +91 9552682389
  const studioWhatsappNumber = "919552682389";
  const orderCandles = placedOrder?.items || order?.items || items;
  const candleListText =
    orderCandles && orderCandles.length > 0
      ? orderCandles
          .map(
            (item: any) =>
              `• ${item.quantity}x ${item.name} (₹${Number(item.price) * Number(item.quantity)})`
          )
          .join("\n")
      : "• Handcrafted Soy Candle";

  const displayTotal = placedOrder?.total ?? order?.total ?? total;
  const displayId = placedOrder?.id || order?.id || "CM-STUDIO";
  const displayName = placedOrder?.customer?.name || form.name;
  const displayPhone = placedOrder?.customer?.phone || form.phone;
  const displayAddress = placedOrder?.customer?.address || form.address;

  const isPhonePePayment =
    (placedOrder?.paymentMethod || order?.paymentMethod) === "PhonePe Gateway" ||
    Boolean(placedOrder?.transactionId || order?.transactionId);

  const paymentProofLine = isPhonePePayment
    ? `⚡ *Payment Status:* Verified automatically via PhonePe Gateway ✓ (Txn ID: ${
        placedOrder?.transactionId || order?.transactionId || "PHONEPE-VERIFIED"
      })`
    : `🖼️ *Payment Screenshot:* Uploaded on website ✓`;

  const whatsappMessage =
    `👋 *Hi Candlemate Studio!* I just placed an order on your website.\n\n` +
    `🧾 *Order ID:* ${displayId}\n` +
    `👤 *Name:* ${displayName}\n` +
    `📞 *Phone:* ${displayPhone}\n` +
    `📍 *Delivery Address:*\n${displayAddress}\n\n` +
    `🕯️ *Ordered Candles:*\n${candleListText}\n\n` +
    `💰 *Order Total:* ₹${displayTotal}\n` +
    `${paymentProofLine}\n\n` +
    `Please confirm my order and start crafting! ✨`;

  const whatsappUrl = `https://api.whatsapp.com/send?phone=${studioWhatsappNumber}&text=${encodeURIComponent(
    whatsappMessage
  )}`;

  // Automatically open WhatsApp when order is finished
  useEffect(() => {
    if (phase === "done" && whatsappUrl && !hasAutoRedirected.current) {
      hasAutoRedirected.current = true;
      const timer = setTimeout(() => {
        try {
          const win = window.open(whatsappUrl, "_blank");
          if (!win || win.closed || typeof win.closed === "undefined") {
            window.location.href = whatsappUrl;
          }
        } catch {
          window.location.href = whatsappUrl;
        }
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [phase, whatsappUrl]);

  return (
    <>
      <Header />
      <main className="mx-auto min-h-[75vh] max-w-5xl px-4 sm:px-6 py-6 sm:py-10">
        {/* Step Progress Tracker */}
        <div className="mb-6 flex items-center justify-between border-b border-[#8a61481a] pb-3 text-xs">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span
              className={`flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full text-[11px] font-bold transition ${
                phase === "details" ? "bg-ink text-white" : "bg-clay text-white"
              }`}
            >
              {phase === "details" ? "1" : "✓"}
            </span>
            <span
              className={`font-semibold uppercase tracking-wider text-[11px] sm:text-xs transition ${
                phase === "details" ? "text-ink" : "text-clay"
              }`}
            >
              Details
            </span>
          </div>

          <span className="h-px flex-1 mx-2 sm:mx-3 bg-[#8a614820] max-w-[35px] sm:max-w-[70px]" />

          <div className="flex items-center gap-1.5 sm:gap-2">
            <span
              className={`flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full text-[11px] font-bold transition ${
                phase === "pay"
                  ? "bg-ink text-white"
                  : phase === "burning" || phase === "done"
                  ? "bg-clay text-white"
                  : "bg-[#8a614820] text-[#765442]"
              }`}
            >
              {phase === "burning" || phase === "done" ? "✓" : "2"}
            </span>
            <span
              className={`font-semibold uppercase tracking-wider text-[11px] sm:text-xs transition ${
                phase === "pay"
                  ? "text-ink"
                  : phase === "burning" || phase === "done"
                  ? "text-clay"
                  : "text-[#765442]/60"
              }`}
            >
              Payment
            </span>
          </div>

          <span className="h-px flex-1 mx-2 sm:mx-3 bg-[#8a614820] max-w-[35px] sm:max-w-[70px]" />

          <div className="flex items-center gap-1.5 sm:gap-2">
            <span
              className={`flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full text-[11px] font-bold transition ${
                phase === "done"
                  ? "bg-clay text-white"
                  : phase === "burning"
                  ? "bg-ink text-white animate-pulse"
                  : "bg-[#8a614820] text-[#765442]"
              }`}
            >
              3
            </span>
            <span
              className={`font-semibold uppercase tracking-wider text-[11px] sm:text-xs transition ${
                phase === "done" || phase === "burning" ? "text-ink" : "text-[#765442]/60"
              }`}
            >
              Confirmation
            </span>
          </div>
        </div>

        {/* Phase 1 & 2: Details and Payment Grid */}
        {(phase === "details" || phase === "pay") && (
          <div className="grid gap-6 sm:gap-8 md:grid-cols-[1fr_320px] items-start">
            <div>
              {/* Step 1: Input details form */}
              {phase === "details" && (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[.2em] text-clay">
                      A little closer to your glow
                    </p>
                    <h1 className="display mt-1.5 text-3xl sm:text-4xl text-ink">
                      Delivery details
                    </h1>
                  </div>

                  <form
                    onSubmit={details}
                    className="paper rounded-3xl p-5 sm:p-7 space-y-4 shadow-sm bg-white/95"
                  >
                    <label className="block text-xs sm:text-sm font-semibold text-[#765442]">
                      Your Full Name
                      <input
                        required
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className="mt-1.5 w-full rounded-xl border border-[#8a61483a] bg-white px-3.5 py-3 text-sm text-ink outline-clay focus:border-clay"
                        placeholder="e.g. Ananya Sharma"
                      />
                    </label>

                    <label className="block text-xs sm:text-sm font-semibold text-[#765442]">
                      Complete Delivery Address
                      <textarea
                        required
                        value={form.address}
                        onChange={(e) => setForm({ ...form, address: e.target.value })}
                        className="mt-1.5 h-24 w-full rounded-xl border border-[#8a61483a] bg-white px-3.5 py-3 text-sm text-ink outline-clay focus:border-clay"
                        placeholder="Flat/House number, Street, Landmark, City and PIN code"
                      />
                    </label>

                    <label className="block text-xs sm:text-sm font-semibold text-[#765442]">
                      Mobile / WhatsApp Number
                      <input
                        required
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        className="mt-1.5 w-full rounded-xl border border-[#8a61483a] bg-white px-3.5 py-3 text-sm text-ink outline-clay focus:border-clay"
                        placeholder="e.g. 98765 43210"
                      />
                    </label>

                    <div className="flex items-center justify-between pt-1 border-t border-[#8a614815]">
                      <span className="text-xs sm:text-sm text-[#765442]">Total Amount:</span>
                      <b className="display text-2xl text-ink">₹{total}</b>
                    </div>

                    {error && (
                      <div className="rounded-xl bg-red-50 p-3 text-xs sm:text-sm text-red-700 border border-red-200">
                        {error}
                      </div>
                    )}

                    <button
                      type="submit"
                      className="w-full rounded-full bg-ink py-3.5 text-sm font-bold text-white hover:bg-clay transition shadow-sm cursor-pointer"
                    >
                      Continue to Payment (₹{total}) →
                    </button>
                  </form>
                </div>
              )}

              {/* Step 2: Payment Section (Clean, Spacious, Uncongested Mobile UI) */}
              {phase === "pay" && (
                <div className="space-y-4">
                  {/* Clean Order Summary Strip */}
                  <div className="flex items-center justify-between rounded-2xl bg-[#f5ebe0]/80 p-3.5 sm:p-4 border border-[#8a61481a]">
                    <div>
                      <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-clay block">
                        Amount to Pay
                      </span>
                      <div className="flex items-baseline gap-2 mt-0.5">
                        <span className="display text-2xl sm:text-4xl text-ink">₹{total}</span>
                        <span className="text-xs text-[#765442]">
                          ({items.length} candle{items.length > 1 ? "s" : ""})
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPhase("details")}
                      className="rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-clay hover:bg-clay hover:text-white transition border border-[#8a614820] shadow-2xs cursor-pointer"
                    >
                      ← Edit details
                    </button>
                  </div>

                  {/* Dynamic Helper Hint Banner when user taps an app or copies info */}
                  {payHint && (
                    <div className="rounded-2xl border border-clay/30 bg-[#fff8ed] p-3.5 text-xs leading-relaxed text-[#765442] shadow-xs flex items-start gap-2.5 animate-in fade-in">
                      <span className="text-base select-none">💡</span>
                      <div className="flex-1">
                        <p className="font-semibold text-ink">{payHint}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPayHint("")}
                        className="text-[#765442]/60 hover:text-ink text-xs font-bold px-1 cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {/* ========================================================================= */}
                  {/* ⚡ 1-CLICK AUTOMATED PHONEPE PAYMENT GATEWAY (RECOMMENDED) */}
                  {/* ========================================================================= */}
                  <div className="rounded-3xl border-2 border-[#5f259f]/40 bg-gradient-to-br from-[#5f259f]/8 via-white to-[#5f259f]/5 p-5 sm:p-6 shadow-md text-left">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#5f259f] text-xl font-bold text-white shadow-sm">
                          पे
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-[#5f259f] px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
                              ⚡ Recommended
                            </span>
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              ✓ Auto-Verified · No Screenshots
                            </span>
                          </div>
                          <h3 className="text-base sm:text-lg font-bold text-ink mt-0.5">
                            PhonePe Payment Gateway
                          </h3>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-[#765442]">Payable</span>
                        <p className="display text-2xl font-bold text-ink leading-tight">₹{total}</p>
                      </div>
                    </div>

                    <p className="mt-3 text-xs sm:text-sm text-[#765442] leading-relaxed">
                      Pay instantly with <b>PhonePe, any UPI App, Debit/Credit Card, or Netbanking</b>. Payment is verified automatically by the gateway in seconds — <b>no manual QR scanning or screenshot upload needed</b>!
                    </p>

                    {phonepeError && (
                      <div className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-700 border border-red-200">
                        {phonepeError}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => payWithPhonePe()}
                      disabled={phonepeLoading}
                      className="mt-4 flex w-full items-center justify-center gap-2.5 rounded-full bg-gradient-to-r from-[#5f259f] via-[#6d2ca8] to-[#5f259f] py-4 px-6 text-sm font-bold text-white shadow-lg hover:shadow-xl hover:opacity-95 transition disabled:opacity-75 cursor-pointer"
                    >
                      {phonepeLoading ? (
                        <>
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          <span>Connecting to PhonePe Gateway...</span>
                        </>
                      ) : (
                        <>
                          <span className="text-lg">⚡</span>
                          <span>Pay ₹{total} with PhonePe (1-Click Auto Launch) →</span>
                        </>
                      )}
                    </button>

                    <div className="mt-3 flex flex-wrap items-center justify-between text-[11px] text-[#765442]/80 gap-2">
                      <span>🔒 Official PhonePe PG · Sandbox / UAT Live Ready</span>
                      <span className="font-semibold text-[#5f259f]">Instant Studio Confirmation ✓</span>
                    </div>
                  </div>

                  {/* Fallback Divider */}
                  <div className="relative my-2 flex items-center justify-center">
                    <div className="border-t border-[#8a614820] w-full" />
                    <span className="bg-[#fffdf9] px-3 text-[11px] uppercase font-bold text-[#765442]/70 tracking-wider">
                      Or Pay Manually via Studio UPI / QR (Screenshot Required)
                    </span>
                  </div>

                  {/* 1. Complete Payment Section with Method Switcher */}
                  <div className="paper rounded-3xl p-5 sm:p-7 shadow-sm bg-white/95 space-y-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-base sm:text-lg font-bold text-ink">1. Complete Payment</h2>
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-extrabold text-emerald-800 uppercase tracking-wide">
                            Updated
                          </span>
                        </div>
                        <p className="text-xs text-[#765442]">Pay Candlemate Studio with any UPI app</p>
                      </div>
                      <span className="rounded-full bg-[#f5ebe0] px-2.5 py-1 text-[10px] sm:text-[11px] font-bold text-clay">
                        Step 1 of 2
                      </span>
                    </div>

                    {/* Method Selector Tabs */}
                    <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#f5ebe0]/80 rounded-2xl border border-[#8a614815]">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("qr")}
                        className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-xl text-center transition cursor-pointer ${
                          paymentMethod === "qr"
                            ? "bg-white text-ink shadow-xs font-bold"
                            : "text-[#765442] hover:text-ink font-medium"
                        }`}
                      >
                        <span className="text-xs sm:text-sm flex items-center gap-1">
                          <span>📷</span>
                          <span>Scan QR</span>
                        </span>
                        <span className="text-[9px] sm:text-[10px] uppercase font-bold text-emerald-700 tracking-tight mt-0.5">
                          ✓ Guaranteed
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod("number")}
                        className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-xl text-center transition cursor-pointer ${
                          paymentMethod === "number"
                            ? "bg-white text-ink shadow-xs font-bold"
                            : "text-[#765442] hover:text-ink font-medium"
                        }`}
                      >
                        <span className="text-xs sm:text-sm flex items-center gap-1">
                          <span>📱</span>
                          <span>To Mobile</span>
                        </span>
                        <span className="text-[9px] sm:text-[10px] uppercase font-bold text-clay tracking-tight mt-0.5">
                          Direct Transfer
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod("app")}
                        className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-xl text-center transition cursor-pointer ${
                          paymentMethod === "app"
                            ? "bg-white text-ink shadow-xs font-bold"
                            : "text-[#765442] hover:text-ink font-medium"
                        }`}
                      >
                        <span className="text-xs sm:text-sm flex items-center gap-1">
                          <span>⚡</span>
                          <span>Auto-Pay</span>
                        </span>
                        <span className="text-[9px] sm:text-[10px] uppercase font-bold text-[#765442]/70 tracking-tight mt-0.5">
                          1-Click Intent
                        </span>
                      </button>
                    </div>

                    {/* METHOD 1: SCAN QR CODE */}
                    {paymentMethod === "qr" && (
                      <div className="space-y-4 animate-in fade-in duration-200">
                        <div className="bg-[#fffdf9] rounded-2xl p-4 sm:p-5 border border-[#8a614820] flex flex-col items-center text-center">
                          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full mb-3 inline-flex items-center gap-1">
                            <span>🛡️</span> Zero Bank Blocks • Approved by All UPI Apps
                          </span>

                          <div className="p-3 bg-white rounded-2xl shadow-sm border border-[#8a614815] flex flex-col items-center">
                            <QRCodeCanvas
                              ref={qrCanvasRef}
                              value={paymentUri}
                              size={175}
                              level="M"
                              marginSize={2}
                            />
                            <div className="mt-2.5 pt-2 border-t border-gray-100 w-full flex items-center justify-between text-[11px] text-[#765442]">
                              <span className="font-semibold text-ink">Candlemate</span>
                              <span className="font-bold text-clay">₹{total}</span>
                            </div>
                          </div>

                          <p className="text-xs font-bold text-ink mt-3">
                            Scan to pay ₹{total}
                          </p>
                          <p className="text-[11px] text-[#765442] mt-0.5 max-w-xs">
                            Take a screenshot or tap below to save QR to your photos, then scan inside your payment app!
                          </p>

                          {/* Save QR Button */}
                          <div className="mt-3.5 w-full max-w-xs flex flex-col gap-2">
                            <button
                              type="button"
                              onClick={saveQrCode}
                              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition shadow-xs flex items-center justify-center gap-2 cursor-pointer ${
                                qrDownloaded
                                  ? "bg-emerald-600 text-white"
                                  : "bg-ink text-white hover:bg-clay"
                              }`}
                            >
                              <span>{qrDownloaded ? "✓" : "📥"}</span>
                              <span>
                                {qrDownloaded ? "QR Code Saved to Gallery! ✓" : "Save QR Code to Photos / Gallery"}
                              </span>
                            </button>
                          </div>
                        </div>

                        {/* Quick App Openers for Scanning */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#765442]/80">
                              {qrDownloaded ? "👉 Step 2: Tap app to open & scan QR:" : "Tap app to open & scan QR:"}
                            </p>
                            {qrDownloaded && (
                              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full animate-pulse">
                                QR in Gallery ✓
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-3 gap-2 sm:gap-3">
                            {/* PhonePe */}
                            <a
                              href={getAppLaunchLink("PhonePe", "scan")}
                              onClick={() => launchUpiApp("PhonePe", "scan")}
                              className={`flex flex-col items-center justify-center rounded-2xl border bg-white p-2.5 sm:p-3 hover:border-clay hover:shadow-xs transition cursor-pointer group text-center ${
                                qrDownloaded ? "border-emerald-500 ring-2 ring-emerald-200/60 shadow-xs" : "border-[#8a614820]"
                              }`}
                            >
                              <div className="h-9 w-9 rounded-xl bg-[#5f259f] flex items-center justify-center text-white font-bold text-sm shadow-2xs mb-1 group-hover:scale-105 transition-transform">
                                पे
                              </div>
                              <span className="text-xs font-bold text-ink">PhonePe</span>
                              <span className="text-[9px] font-semibold text-clay mt-0.5">Open Scanner 📷</span>
                            </a>

                            {/* Google Pay */}
                            <a
                              href={getAppLaunchLink("Google Pay", "scan")}
                              onClick={() => launchUpiApp("Google Pay", "scan")}
                              className={`flex flex-col items-center justify-center rounded-2xl border bg-white p-2.5 sm:p-3 hover:border-clay hover:shadow-xs transition cursor-pointer group text-center ${
                                qrDownloaded ? "border-emerald-500 ring-2 ring-emerald-200/60 shadow-xs" : "border-[#8a614820]"
                              }`}
                            >
                              <div className="h-9 w-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center shadow-2xs mb-1 group-hover:scale-105 transition-transform">
                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                  <path
                                    fill="#4285F4"
                                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                                  />
                                  <path
                                    fill="#34A853"
                                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                                  />
                                  <path
                                    fill="#FBBC05"
                                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                                  />
                                  <path
                                    fill="#EA4335"
                                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                                  />
                                </svg>
                              </div>
                              <span className="text-xs font-bold text-ink">GPay</span>
                              <span className="text-[9px] font-semibold text-clay mt-0.5">Open Scanner 📷</span>
                            </a>

                            {/* Paytm */}
                            <a
                              href={getAppLaunchLink("Paytm", "scan")}
                              onClick={() => launchUpiApp("Paytm", "scan")}
                              className={`flex flex-col items-center justify-center rounded-2xl border bg-white p-2.5 sm:p-3 hover:border-clay hover:shadow-xs transition cursor-pointer group text-center ${
                                qrDownloaded ? "border-emerald-500 ring-2 ring-emerald-200/60 shadow-xs" : "border-[#8a614820]"
                              }`}
                            >
                              <div className="h-9 w-9 rounded-xl bg-[#002970] flex items-center justify-center text-[#00b9f5] font-extrabold text-[10px] tracking-tight shadow-2xs mb-1 group-hover:scale-105 transition-transform">
                                Paytm
                              </div>
                              <span className="text-xs font-bold text-ink">Paytm</span>
                              <span className="text-[9px] font-semibold text-clay mt-0.5">Open Scanner 📷</span>
                            </a>
                          </div>
                        </div>

                        {/* Step-by-step guidance card */}
                        <div className="rounded-2xl bg-[#f5ebe0]/60 p-3.5 border border-[#8a614818] text-xs text-[#765442] space-y-1.5">
                          <p className="font-bold text-ink flex items-center gap-1.5">
                            <span>💡</span> Quick 3-Step Guide:
                          </p>
                          <ol className="list-decimal list-inside space-y-1 pl-1 text-[11px] leading-relaxed">
                            <li>Tap <b>&quot;Save QR Code to Photos&quot;</b> above (or take a screenshot).</li>
                            <li>Open PhonePe, Google Pay, or Paytm.</li>
                            <li>Tap the <b>Scanner icon (📷)</b> → choose <b>Upload from Gallery</b> → Amount ₹{total} fills automatically → Enter PIN & Pay!</li>
                          </ol>
                        </div>
                      </div>
                    )}

                    {/* METHOD 2: PAY TO MOBILE / UPI ID */}
                    {paymentMethod === "number" && (
                      <div className="space-y-4 animate-in fade-in duration-200">
                        {/* Primary Card: Pay to Phone Number */}
                        <div className="rounded-2xl border-2 border-clay/30 bg-[#fffaf3] p-4 sm:p-5 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-clay">
                              PhonePe / Google Pay / Paytm Mobile Number
                            </span>
                            <span className="rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5">
                              ✓ 100% Reliable
                            </span>
                          </div>

                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-[#8a61481a]">
                            <div>
                              <p className="text-xl sm:text-2xl font-black tracking-wide text-ink font-mono">
                                9552682389
                              </p>
                              <p className="text-[11px] text-[#765442] mt-0.5">
                                Recipient: <b>Arnav Parbat (Candlemate)</b>
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={copyPhone}
                              className="rounded-xl bg-clay px-4 py-2.5 text-xs font-bold text-white hover:bg-ink transition shadow-xs cursor-pointer shrink-0"
                            >
                              {copiedPhone ? "✓ Copied 9552682389!" : "📋 Copy Mobile Number"}
                            </button>
                          </div>

                          <div>
                            <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#765442]/80 mb-2">
                              Tap to copy number & open app:
                            </p>
                            <div className="grid grid-cols-3 gap-2 sm:gap-3">
                              <a
                                href={getAppLaunchLink("PhonePe", "mobile")}
                                onClick={() => launchUpiApp("PhonePe", "mobile")}
                                className="flex flex-col items-center justify-center rounded-xl border border-[#8a614820] bg-white p-2 sm:p-2.5 hover:border-clay hover:shadow-2xs transition cursor-pointer text-center"
                              >
                                <span className="text-xs font-bold text-ink">PhonePe</span>
                                <span className="text-[9px] text-[#765442] mt-0.5">To Mobile</span>
                              </a>

                              <a
                                href={getAppLaunchLink("Google Pay", "mobile")}
                                onClick={() => launchUpiApp("Google Pay", "mobile")}
                                className="flex flex-col items-center justify-center rounded-xl border border-[#8a614820] bg-white p-2 sm:p-2.5 hover:border-clay hover:shadow-2xs transition cursor-pointer text-center"
                              >
                                <span className="text-xs font-bold text-ink">GPay</span>
                                <span className="text-[9px] text-[#765442] mt-0.5">Pay Phone</span>
                              </a>

                              <a
                                href={getAppLaunchLink("Paytm", "mobile")}
                                onClick={() => launchUpiApp("Paytm", "mobile")}
                                className="flex flex-col items-center justify-center rounded-xl border border-[#8a614820] bg-white p-2 sm:p-2.5 hover:border-clay hover:shadow-2xs transition cursor-pointer text-center"
                              >
                                <span className="text-xs font-bold text-ink">Paytm</span>
                                <span className="text-[9px] text-[#765442] mt-0.5">To Mobile</span>
                              </a>
                            </div>
                          </div>

                          <p className="text-[11px] text-[#765442] leading-relaxed bg-[#f5ebe0]/60 p-2.5 rounded-lg border border-[#8a614815]">
                            👉 <b>How to pay:</b> Open PhonePe or Google Pay, choose <b>&quot;To Mobile Number&quot;</b>, paste <b>9552682389</b>, enter ₹{total}, and complete payment.
                          </p>
                        </div>

                        {/* Secondary Card: UPI ID */}
                        <div className="rounded-2xl border border-[#8a614820] bg-white p-3.5 sm:p-4 flex items-center justify-between">
                          <div className="min-w-0 pr-2">
                            <span className="text-[10px] uppercase font-bold text-[#765442]/70 block">
                              Studio UPI ID
                            </span>
                            <span className="text-xs sm:text-sm font-bold text-ink truncate block">
                              {upi}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={copyUpiId}
                            className="shrink-0 rounded-lg bg-[#f5ebe0] px-3 py-1.5 text-xs font-semibold text-clay hover:bg-clay hover:text-white transition cursor-pointer border border-[#8a614820]"
                          >
                            {copiedUpi ? "✓ Copied!" : "Copy UPI ID"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* METHOD 3: 1-CLICK UPI INTENT */}
                    {paymentMethod === "app" && (
                      <div className="space-y-4 animate-in fade-in duration-200">
                        {/* Advisory Banner explaining NPCI rules */}
                        <div className="rounded-2xl border border-amber-300/80 bg-amber-50/80 p-3.5 sm:p-4 text-xs leading-relaxed text-amber-950 flex items-start gap-2.5">
                          <span className="text-base select-none">⚠️</span>
                          <div>
                            <p className="font-bold">Notice regarding app payments:</p>
                            <p className="text-[11px] text-amber-900 mt-0.5">
                              Some banking apps block website links to personal UPI accounts. If your app shows <i>&quot;Payment not allowed&quot;</i> or <i>&quot;External links restricted&quot;</i>, please switch to <b>Scan QR</b> or <b>To Mobile (9552682389)</b> above to complete your payment.
                            </p>
                          </div>
                        </div>

                        {/* Primary Universal Button */}
                        <a
                          href={getAppLaunchLink("Universal", "intent")}
                          onClick={() => launchUpiApp("Universal", "intent")}
                          className="w-full rounded-2xl bg-gradient-to-r from-clay to-[#6e4630] p-3.5 sm:p-4 text-white hover:opacity-95 transition shadow-md flex items-center justify-between cursor-pointer"
                        >
                          <div className="flex items-center gap-3 text-left">
                            <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center text-xl shadow-xs shrink-0">
                              ⚡
                            </div>
                            <div>
                              <span className="text-sm sm:text-base font-bold text-white block">
                                Pay ₹{total} via Any UPI App
                              </span>
                              <p className="text-[11px] sm:text-xs text-white/85 mt-0.5">
                                PhonePe, Google Pay, Paytm, Cred, BHIM
                              </p>
                            </div>
                          </div>
                          <span className="text-xs font-bold bg-white/20 rounded-xl px-2.5 py-1 shrink-0">
                            Pay →
                          </span>
                        </a>

                        <div className="grid grid-cols-3 gap-2 sm:gap-3">
                          <a
                            href={getAppLaunchLink("PhonePe", "intent")}
                            onClick={() => launchUpiApp("PhonePe", "intent")}
                            className="flex flex-col items-center justify-center rounded-2xl border border-[#8a614820] bg-white p-2.5 sm:p-3 hover:border-clay hover:shadow-xs transition cursor-pointer group text-center"
                          >
                            <div className="h-9 w-9 rounded-xl bg-[#5f259f] flex items-center justify-center text-white font-bold text-sm shadow-2xs mb-1 group-hover:scale-105 transition-transform">
                              पे
                            </div>
                            <span className="text-xs font-bold text-ink">PhonePe</span>
                          </a>

                          <a
                            href={getAppLaunchLink("Google Pay", "intent")}
                            onClick={() => launchUpiApp("Google Pay", "intent")}
                            className="flex flex-col items-center justify-center rounded-2xl border border-[#8a614820] bg-white p-2.5 sm:p-3 hover:border-clay hover:shadow-xs transition cursor-pointer group text-center"
                          >
                            <div className="h-9 w-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center shadow-2xs mb-1 group-hover:scale-105 transition-transform">
                              <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path
                                  fill="#4285F4"
                                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                                />
                                <path
                                  fill="#34A853"
                                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                                />
                                <path
                                  fill="#FBBC05"
                                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                                />
                                <path
                                  fill="#EA4335"
                                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                                />
                              </svg>
                            </div>
                            <span className="text-xs font-bold text-ink">GPay</span>
                          </a>

                          <a
                            href={getAppLaunchLink("Paytm", "intent")}
                            onClick={() => launchUpiApp("Paytm", "intent")}
                            className="flex flex-col items-center justify-center rounded-2xl border border-[#8a614820] bg-white p-2.5 sm:p-3 hover:border-clay hover:shadow-xs transition cursor-pointer group text-center"
                          >
                            <div className="h-9 w-9 rounded-xl bg-[#002970] flex items-center justify-center text-[#00b9f5] font-extrabold text-[10px] tracking-tight shadow-2xs mb-1 group-hover:scale-105 transition-transform">
                              Paytm
                            </div>
                            <span className="text-xs font-bold text-ink">Paytm</span>
                          </a>
                        </div>
                      </div>
                    )}

                    {/* WhatsApp Help strip */}
                    <div className="pt-2 border-t border-[#8a614815] flex items-center justify-between text-xs text-[#765442]">
                      <span className="text-[11px]">Need assistance with payment?</span>
                      <a
                        href={`https://api.whatsapp.com/send?phone=919552682389&text=${encodeURIComponent(
                          `Hi Candlemate Studio! I need help with my payment of ₹${total}.`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:text-emerald-900 transition underline cursor-pointer text-[11px]"
                      >
                        <span>💬 Chat on WhatsApp</span>
                      </a>
                    </div>
                  </div>

                  {/* 2. Upload Payment Proof Section */}
                  <div className="paper rounded-3xl p-5 sm:p-7 shadow-sm bg-white/95 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-base sm:text-lg font-bold text-ink">2. Upload Payment Proof</h2>
                        <p className="text-xs text-[#765442]">Screenshot of successful payment</p>
                      </div>
                      <span className="rounded-full bg-[#f5ebe0] px-2.5 py-1 text-[10px] sm:text-[11px] font-bold text-clay">
                        Step 2 of 2
                      </span>
                    </div>

                    <label
                      className={`block cursor-pointer rounded-2xl border-2 border-dashed p-4 sm:p-5 text-center transition ${
                        shot
                          ? "border-emerald-600 bg-emerald-50/50 text-emerald-900"
                          : "border-clay/40 bg-[#fffaf3] text-clay hover:bg-[#fff5e6]"
                      }`}
                    >
                      {shot ? (
                        <div className="flex flex-col items-center gap-2">
                          <img
                            src={shot}
                            alt="Payment Screenshot Preview"
                            className="h-28 sm:h-32 w-auto max-w-full rounded-xl object-contain border border-emerald-300 shadow-xs"
                          />
                          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                            <span>✓ Screenshot attached</span>
                            <span className="underline font-normal text-emerald-700">
                              (Tap to change image)
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1.5 py-2">
                          <div className="h-11 w-11 rounded-full bg-[#f5ebe0] flex items-center justify-center text-xl shadow-2xs text-clay">
                            📸
                          </div>
                          <p className="text-xs sm:text-sm font-bold text-ink">
                            Tap to upload payment screenshot
                          </p>
                          <p className="text-[11px] sm:text-xs text-[#765442]">
                            Select from photo gallery or take photo
                          </p>
                        </div>
                      )}
                      <input
                        id="payment-screenshot-input"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={upload}
                      />
                    </label>

                    {error && (
                      <div className="rounded-xl bg-red-50 p-3 text-xs sm:text-sm text-red-700 border border-red-200">
                        {error}
                      </div>
                    )}

                    {/* Finalize Order Button */}
                    <button
                      type="button"
                      onClick={submit}
                      className={`w-full rounded-full py-3.5 sm:py-4 text-sm font-bold transition shadow-md cursor-pointer ${
                        shot
                          ? "bg-ink text-white hover:bg-clay"
                          : "bg-[#765442]/35 text-white hover:bg-[#765442]/50"
                      }`}
                    >
                      {shot
                        ? `Confirm & Place Order (₹${total}) →`
                        : "Upload screenshot above to finalize order"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Dedicated Desktop Studio Crafting Sidebar Card */}
            <aside className="hidden md:flex flex-col items-center paper rounded-3xl p-6 shadow-sm border border-[#8a61481a] sticky top-24 bg-white/90">
              <div className="w-full flex items-center justify-between pb-3 border-b border-[#8a61481a] text-xs font-semibold text-clay uppercase tracking-wider">
                <span>Studio Crafting</span>
                <span>{phase === "details" ? "Step 1 of 3" : "Step 2 of 3"}</span>
              </div>
              <div className="py-5">
                <Candle stage={candleStage} />
              </div>
              <div className="w-full pt-3 border-t border-[#8a61481a] text-center">
                <p className="text-xs text-[#765442] leading-relaxed">
                  {phase === "details" &&
                    "Your amber glass jar is poured with pure soy wax & spiral cotton wick."}
                  {phase === "pay" &&
                    "Wick ember is set — complete UPI payment to ignite your candle order."}
                </p>
                <div className="mt-4 bg-[#fff8ed] rounded-xl p-3 text-xs text-[#765442] flex justify-between items-center border border-[#8a614818]">
                  <span>Order Total:</span>
                  <b className="text-sm font-semibold text-ink">₹{total}</b>
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* Phase 3: Burning / Igniting */}
        {phase === "burning" && (
          <div className="paper mx-auto max-w-lg rounded-3xl p-8 text-center shadow-md flex flex-col items-center bg-white/95">
            <div className="my-2">
              <Candle stage="burning" />
            </div>
            <h2 className="display mt-5 text-3xl text-ink">Igniting your order...</h2>
            <p className="mt-2 text-sm text-[#765442]">
              Your payment proof is on its way to our studio. The flame is lit!
            </p>
            <div className="mt-5 flex items-center gap-2 text-xs font-semibold text-clay bg-[#fff8ed] rounded-full px-4 py-1.5 border border-[#8a614820]">
              <span className="h-2 w-2 rounded-full bg-clay animate-ping" />
              <span>Connecting with candlemate studio...</span>
            </div>
          </div>
        )}

        {/* Phase 4: Order Completed / Done */}
        {phase === "done" && (
          <div className="paper mx-auto max-w-lg rounded-3xl p-8 text-center shadow-md flex flex-col items-center bg-white/95">
            <div className="my-2">
              <Candle stage="done" />
            </div>
            <h2 className="display mt-5 text-3xl text-ink">Thank you, {displayName}!</h2>
            <p className="mt-2 text-[#765442]">We’ve received your order and started crafting.</p>

            {/* Order Confirmation Card with Candle Items Breakdown */}
            <div className="mt-6 rounded-2xl bg-[#fff8ed] p-5 border border-[#8a614820] w-full text-left">
              <div className="flex justify-between items-center pb-3 border-b border-[#8a614815]">
                <div className="flex items-center gap-2">
                  <img src="/logo.png" alt="Candlemate" className="h-6 w-6 object-contain" />
                  <p className="text-xs text-[#765442] uppercase tracking-wider font-semibold">Order ID</p>
                </div>
                <p className="display text-xl font-bold text-clay">{displayId}</p>
              </div>

              <div className="py-3 border-b border-[#8a614815]">
                <p className="text-xs text-[#765442] uppercase tracking-wider font-semibold mb-2">
                  Candles Ordered
                </p>
                <div className="space-y-1.5">
                  {orderCandles.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-xs text-[#765442]">
                      <span>
                        <b className="text-ink font-semibold">{item.quantity}x</b> {item.name}
                      </span>
                      <span className="font-semibold text-ink">
                        ₹{Number(item.price) * Number(item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 flex justify-between items-center text-xs">
                <span className="font-semibold text-[#765442]">Total Paid:</span>
                <span className="display text-lg font-bold text-ink">₹{displayTotal}</span>
              </div>

              {isPhonePePayment && (
                <div className="mt-3 rounded-xl bg-purple-50 border border-purple-200 p-2.5 text-xs text-purple-900 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold">⚡ Payment:</span>
                    <span className="font-semibold text-emerald-800">PhonePe Gateway Verified ✓</span>
                  </div>
                  {(placedOrder?.transactionId || order?.transactionId) && (
                    <span className="text-[10px] font-mono text-purple-800 truncate max-w-[150px]">
                      Txn: {placedOrder?.transactionId || order?.transactionId}
                    </span>
                  )}
                </div>
              )}

              <p className="mt-3 text-xs text-[#765442] leading-relaxed">
                We’ll message delivery updates to <b className="text-ink">{displayPhone}</b> as your candle is poured and packed.
              </p>
            </div>

            {/* Direct 1-Touch WhatsApp Bridge to Studio Phone 9552682389 */}
            <div className="mt-5 w-full">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2.5 w-full rounded-full bg-[#25D366] px-6 py-4 text-sm font-bold text-white hover:bg-[#1faa4b] transition shadow-md cursor-pointer"
              >
                <svg className="h-5 w-5 fill-current shrink-0" viewBox="0 0 24 24">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                </svg>
                <span>Send Order Receipt to Studio WhatsApp ↗</span>
              </a>
              <p className="mt-2.5 text-xs text-[#765442] text-center font-medium">
                Opening WhatsApp automatically… If it didn’t open, tap the green button above to message <b>+91 9552682389</b>!
              </p>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3 w-full">
              <Link
                href={`/track?id=${encodeURIComponent(displayId)}`}
                className="flex items-center justify-center gap-2 w-full sm:w-auto rounded-full border border-[#8a614830] bg-[#fffaf3] px-6 py-3 text-xs sm:text-sm font-semibold text-clay hover:bg-[#8a614815] transition shadow-2xs"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <span>Track Order Live ↗</span>
              </Link>

              <Link
                href="/"
                className="inline-block w-full sm:w-auto text-center rounded-full bg-ink px-6 py-3 text-xs sm:text-sm font-medium text-cream hover:bg-clay transition"
              >
                Browse more candles
              </Link>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
