"use client";

import { Header } from "@/components/header";
import { useCart } from "@/components/cart-context";
import { Candle, CandleStage } from "@/components/candle";
import { FormEvent, useEffect, useState, useRef } from "react";
import Link from "next/link";
import Script from "next/script";

type Phase = "details" | "pay" | "burning" | "done";

export default function Checkout() {
  const { items, total, clear } = useCart();
  const [phase, setPhase] = useState<Phase>("details");
  const [form, setForm] = useState({ name: "", address: "", phone: "" });
  const [error, setError] = useState("");
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

  // Cashfree Payment Gateway states
  const [cashfreeLoading, setCashfreeLoading] = useState(false);
  const [cashfreeError, setCashfreeError] = useState("");
  const [lastCashfreeOrderId, setLastCashfreeOrderId] = useState<string>("");
  const pendingOrderIdRef = useRef<string>("");
  const hasAutoRedirected = useRef(false);

  useEffect(() => {
    // Auto-detect return from Cashfree Payment Gateway (if redirected or returned from app switch)
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const cfOrderId = params.get("order_id") || params.get("orderId");

      if (cfOrderId) {
        setPhase("burning");
        verifyCashfreePayment(cfOrderId);
      }
    }
  }, []);

  // iOS / Mobile app switch listener: when user returns from PhonePe/GPay to Safari
  useEffect(() => {
    function handleAppReturn() {
      if (
        document.visibilityState === "visible" &&
        pendingOrderIdRef.current &&
        phase === "pay"
      ) {
        console.log(
          "[App Switch] Returned to checkout tab, verifying payment for:",
          pendingOrderIdRef.current
        );
        verifyCashfreePayment(pendingOrderIdRef.current);
      }
    }

    document.addEventListener("visibilitychange", handleAppReturn);
    window.addEventListener("focus", handleAppReturn);
    return () => {
      document.removeEventListener("visibilitychange", handleAppReturn);
      window.removeEventListener("focus", handleAppReturn);
    };
  }, [phase]);

  function loadCashfreeSDK(): Promise<any> {
    return new Promise((resolve, reject) => {
      if ((window as any).Cashfree) {
        resolve((window as any).Cashfree);
        return;
      }
      const existing = document.getElementById("cashfree-sdk-v3") as HTMLScriptElement | null;
      if (existing) {
        existing.addEventListener("load", () => resolve((window as any).Cashfree));
        existing.addEventListener("error", reject);
        return;
      }
      const script = document.createElement("script");
      script.id = "cashfree-sdk-v3";
      script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
      script.async = true;
      script.onload = () => resolve((window as any).Cashfree);
      script.onerror = () => reject(new Error("Unable to load Cashfree checkout SDK."));
      document.body.appendChild(script);
    });
  }

  async function verifyCashfreePayment(orderId: string) {
    try {
      const res = await fetch(`/api/payment/cashfree/verify?orderId=${encodeURIComponent(orderId)}`);
      const data = await res.json();
      if (data.verified) {
        const orderData = data.order || {
          id: orderId,
          customer: form,
          items: items,
          total: total,
          paymentMethod: "Cashfree Gateway",
          transactionId: data.paymentId || "CASHFREE_PAID",
        };
        setPlacedOrder({
          id: orderData.id,
          customer: orderData.customer,
          items: orderData.items?.length ? orderData.items : items,
          total: Number(orderData.total) || total,
          paymentMethod: "Cashfree Gateway",
          transactionId: orderData.transactionId || data.paymentId || "CASHFREE_PAID",
        });
        setOrder(orderData);
        clear();
        pendingOrderIdRef.current = "";
        setTimeout(() => setPhase("done"), 1200);
        return true;
      } else {
        setCashfreeError(
          "Payment is not confirmed yet. If you already completed payment in your UPI app, tap 'Confirm Payment' below to re-check."
        );
        setPhase("pay");
        return false;
      }
    } catch (err: any) {
      console.error("Verification error:", err);
      setCashfreeError(
        "Could not verify payment status immediately. Please tap 'Confirm Payment' to check again."
      );
      setPhase("pay");
      return false;
    }
  }

  async function payWithCashfree(overrideForm?: { name: string; address: string; phone: string }) {
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
    setCashfreeError("");
    setCashfreeLoading(true);

    try {
      // 1. Create order on backend
      const res = await fetch("/api/payment/cashfree/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: activeForm,
          items,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success || !data.paymentSessionId) {
        throw new Error(data.error || "Could not start Cashfree payment session. Please try again.");
      }

      pendingOrderIdRef.current = data.orderId;
      setLastCashfreeOrderId(data.orderId);

      // 2. Load Cashfree JS SDK
      const CashfreeConstructor = await loadCashfreeSDK();
      const cashfree = new CashfreeConstructor({
        mode: data.environment === "production" ? "production" : "sandbox",
      });

      // 3. Launch In-Page Popup Modal Checkout!
      setCashfreeLoading(false);
      cashfree.checkout({
        paymentSessionId: data.paymentSessionId,
        redirectTarget: "_modal",
      }).then(async (result: any) => {
        // When modal finishes or is closed/dismissed after switching back from UPI app on iPhone:
        setPhase("burning");
        const verified = await verifyCashfreePayment(data.orderId);
        if (!verified) {
          if (result?.error) {
            console.warn("Cashfree modal closed with error:", result.error);
          }
          setCashfreeLoading(false);
        }
      });
    } catch (err: any) {
      console.error("[Cashfree Checkout] Initiation error:", err);
      setCashfreeError(err.message || "Failed to initialize Cashfree payment.");
      setCashfreeLoading(false);
    }
  }

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

  const paymentProofLine = `⚡ *Payment Status:* Verified automatically via Cashfree Gateway ✓ (Txn ID: ${
    placedOrder?.transactionId || order?.transactionId || "CASHFREE-PAID"
  })`;

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



                  {/* Minimalist & Aesthetic Online Payment Card */}
                  <div className="paper rounded-3xl p-6 sm:p-8 bg-white/95 border border-[#8a61481a] shadow-warm text-left space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-4 border-b border-[#8a614815]">
                      <div>
                        <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-clay block">
                          Payment
                        </span>
                        <h2 className="display text-xl sm:text-2xl text-ink font-semibold mt-0.5">
                          Instant UPI & Card
                        </h2>
                      </div>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f5ebe0] px-3 py-1 text-[11px] font-semibold text-clay">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                        Auto-Verified
                      </span>
                    </div>

                    {/* Supported UPI & Card Icons (Non-clickable badges) */}
                    <div>
                      <p className="text-xs text-[#765442] mb-3">
                        Accepted payment methods:
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        {/* Google Pay */}
                        <div className="flex items-center gap-2.5 rounded-2xl border border-[#8a61481a] bg-[#fffdfa] px-3.5 py-2.5 shadow-2xs select-none">
                          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                            <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                            <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                            <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                          </svg>
                          <span className="text-xs font-semibold text-ink">Google Pay</span>
                        </div>

                        {/* PhonePe */}
                        <div className="flex items-center gap-2.5 rounded-2xl border border-[#8a61481a] bg-[#fffdfa] px-3.5 py-2.5 shadow-2xs select-none">
                          <div className="h-4 w-4 rounded-full bg-[#5f259f] flex items-center justify-center text-white text-[9px] font-bold shrink-0">
                            पे
                          </div>
                          <span className="text-xs font-semibold text-ink">PhonePe</span>
                        </div>

                        {/* Paytm */}
                        <div className="flex items-center gap-2.5 rounded-2xl border border-[#8a61481a] bg-[#fffdfa] px-3.5 py-2.5 shadow-2xs select-none">
                          <div className="h-4 w-4 rounded-full bg-[#002970] flex items-center justify-center text-[#00b9f5] text-[8px] font-black shrink-0">
                            P
                          </div>
                          <span className="text-xs font-semibold text-ink">Paytm</span>
                        </div>

                        {/* UPI & Cards */}
                        <div className="flex items-center gap-2.5 rounded-2xl border border-[#8a61481a] bg-[#fffdfa] px-3.5 py-2.5 shadow-2xs select-none">
                          <span className="text-[9px] font-black text-emerald-800 bg-emerald-100 px-1 py-0.5 rounded shrink-0">
                            UPI
                          </span>
                          <span className="text-xs font-semibold text-ink">UPI & Cards</span>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-[#765442] leading-relaxed">
                      Tap below to complete your payment. Once done, your order is automatically verified and scheduled for crafting.
                    </p>

                    {cashfreeError && (
                      <div className="rounded-xl bg-red-50 p-3 text-xs text-red-700 border border-red-200">
                        {cashfreeError}
                      </div>
                    )}

                    {lastCashfreeOrderId && (
                      <button
                        type="button"
                        onClick={() => {
                          setPhase("burning");
                          verifyCashfreePayment(lastCashfreeOrderId);
                        }}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-clay/30 bg-[#fffaf3] py-3 px-4 text-xs font-semibold text-clay hover:bg-clay hover:text-white transition cursor-pointer"
                      >
                        <span>Already paid on UPI? Tap to re-confirm order</span>
                      </button>
                    )}

                    {/* Primary Minimalist Button */}
                    <button
                      type="button"
                      onClick={() => payWithCashfree()}
                      disabled={cashfreeLoading}
                      className="w-full rounded-full bg-ink py-4 px-6 text-sm sm:text-base font-semibold text-white hover:bg-clay transition shadow-sm disabled:opacity-70 cursor-pointer flex items-center justify-center gap-2"
                    >
                      {cashfreeLoading ? (
                        <>
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          <span>Opening secure payment...</span>
                        </>
                      ) : (
                        <span>Pay ₹{total} →</span>
                      )}
                    </button>

                    <div className="pt-2 border-t border-[#8a614812] flex items-center justify-center gap-2 text-[11px] text-[#765442]/70">
                      <svg className="w-3.5 h-3.5 text-clay/80 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                      </svg>
                      <span>256-bit encrypted secure checkout · Instant studio confirmation</span>
                    </div>
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
                    "Wick ember is set — complete Cashfree payment to ignite your candle order."}
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
              Your payment is being confirmed with our studio. The flame is lit!
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

              <div className="mt-3 rounded-xl bg-[#f5ebe0]/80 border border-[#8a61481a] p-2.5 text-xs text-[#765442] flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-ink">Payment:</span>
                  <span className="font-semibold text-emerald-800">Verified ✓</span>
                </div>
                {(placedOrder?.transactionId || order?.transactionId) && (
                  <span className="text-[10px] font-mono text-[#765442] truncate max-w-[150px]">
                    Txn: {placedOrder?.transactionId || order?.transactionId}
                  </span>
                )}
              </div>

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
      <Script src="https://sdk.cashfree.com/js/v3/cashfree.js" id="cashfree-sdk-v3" strategy="afterInteractive" />
    </>
  );
}
