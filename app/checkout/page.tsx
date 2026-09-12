"use client";

import { Header } from "@/components/header";
import { useCart } from "@/components/cart-context";
import { Candle, CandleStage } from "@/components/candle";
import { QRCodeSVG } from "qrcode.react";
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
  } | null>(null);

  // Payment feedback and state
  const [payHint, setPayHint] = useState<string>("");
  const [showQrExpanded, setShowQrExpanded] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const hasAutoRedirected = useRef(false);

  useEffect(() => {
    fetch("/api/settings/payment")
      .then((r) => r.json())
      .then((x) => {
        if (x.upiId) setUpi(x.upiId);
      })
      .catch(() => {});
  }, []);

  // Standard NPCI formatted UPI URI (2 decimal places, clean payee & note)
  const formattedAmount = Number(total).toFixed(2);
  const paymentUri = `upi://pay?pa=${encodeURIComponent(upi)}&pn=${encodeURIComponent(
    "Candlemate"
  )}&am=${encodeURIComponent(formattedAmount)}&cu=INR&tn=${encodeURIComponent("Candlemate")}`;

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

  function triggerUpi(appName?: string) {
    // 1. Copy UPI ID to clipboard as background safety fallback
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(upi).catch(() => {});
    }
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 3000);

    // 2. Set clear, reassuring fail-safe hint in case bank app restricts web-initiated requests
    if (appName) {
      setPayHint(
        `✓ Studio UPI ID (${upi}) copied! Opening ${appName}... If your bank app restricts website payments, simply select "Pay UPI ID / Mobile" inside ${appName} and paste ${upi} or enter 9552682389 to pay ₹${total}.`
      );
    } else {
      setPayHint(
        `✓ Studio UPI ID (${upi}) copied! Opening payment app... If your bank app restricts website payments, simply pay ₹${total} to ${upi} or 9552682389.`
      );
    }

    // 3. Launch clean standard UPI protocol without package-lock restrictions
    window.location.href = paymentUri;
  }

  function copyUpiId() {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(upi).then(() => {
        setCopiedUpi(true);
        setTimeout(() => setCopiedUpi(false), 2500);
      });
    }
  }

  function copyPhone() {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText("9552682389").then(() => {
        setCopiedPhone(true);
        setTimeout(() => setCopiedPhone(false), 2500);
      });
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

  const whatsappMessage =
    `👋 *Hi Candlemate Studio!* I just placed an order on your website.\n\n` +
    `🧾 *Order ID:* ${displayId}\n` +
    `👤 *Name:* ${displayName}\n` +
    `📞 *Phone:* ${displayPhone}\n` +
    `📍 *Delivery Address:*\n${displayAddress}\n\n` +
    `🕯️ *Ordered Candles:*\n${candleListText}\n\n` +
    `💰 *Order Total:* ₹${displayTotal}\n` +
    `🖼️ *Payment Screenshot:* Uploaded on website ✓\n\n` +
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

                  {/* Dynamic Helper Hint Banner when user taps an app */}
                  {payHint && (
                    <div className="rounded-2xl border border-clay/30 bg-[#fff8ed] p-3.5 text-xs leading-relaxed text-[#765442] shadow-xs flex items-start gap-2.5 animate-in fade-in">
                      <span className="text-base select-none">💡</span>
                      <p className="font-semibold text-ink flex-1">{payHint}</p>
                    </div>
                  )}

                  {/* 1. Pay with UPI App Section */}
                  <div className="paper rounded-3xl p-5 sm:p-7 shadow-sm bg-white/95 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-base sm:text-lg font-bold text-ink">1. Pay with UPI App</h2>
                        <p className="text-xs text-[#765442]">Instant payment on your phone</p>
                      </div>
                      <span className="rounded-full bg-[#f5ebe0] px-2.5 py-1 text-[10px] sm:text-[11px] font-bold text-clay">
                        Step 1 of 2
                      </span>
                    </div>

                    {/* Primary Hero Universal UPI Button */}
                    <button
                      type="button"
                      onClick={() => triggerUpi()}
                      className="w-full rounded-2xl bg-gradient-to-r from-clay to-[#6e4630] p-3.5 sm:p-4 text-white hover:opacity-95 transition shadow-md flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-3 text-left">
                        <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center text-xl shadow-xs shrink-0">
                          ⚡
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm sm:text-base font-bold text-white">
                              Pay ₹{total} via Any UPI App
                            </span>
                            <span className="rounded-full bg-white/25 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-white">
                              Recommended
                            </span>
                          </div>
                          <p className="text-[11px] sm:text-xs text-white/85 mt-0.5">
                            Google Pay, PhonePe, Paytm, Cred, BHIM
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-bold bg-white/20 rounded-xl px-2.5 py-1 shrink-0">
                        Pay →
                      </span>
                    </button>

                    {/* App Quick Launcher Cards in 3 Columns */}
                    <div>
                      <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#765442]/70 mb-2">
                        Or open your app directly
                      </p>
                      <div className="grid grid-cols-3 gap-2 sm:gap-3">
                        {/* PhonePe */}
                        <button
                          type="button"
                          onClick={() => triggerUpi("PhonePe")}
                          className="flex flex-col items-center justify-center rounded-2xl border border-[#8a614820] bg-white p-2.5 sm:p-3 hover:border-clay hover:shadow-xs transition cursor-pointer group"
                        >
                          <div className="h-9 w-9 rounded-xl bg-[#5f259f] flex items-center justify-center text-white font-bold text-sm shadow-2xs mb-1 group-hover:scale-105 transition-transform">
                            पे
                          </div>
                          <span className="text-xs font-bold text-ink">PhonePe</span>
                        </button>

                        {/* Google Pay */}
                        <button
                          type="button"
                          onClick={() => triggerUpi("Google Pay")}
                          className="flex flex-col items-center justify-center rounded-2xl border border-[#8a614820] bg-white p-2.5 sm:p-3 hover:border-clay hover:shadow-xs transition cursor-pointer group"
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
                        </button>

                        {/* Paytm */}
                        <button
                          type="button"
                          onClick={() => triggerUpi("Paytm")}
                          className="flex flex-col items-center justify-center rounded-2xl border border-[#8a614820] bg-white p-2.5 sm:p-3 hover:border-clay hover:shadow-xs transition cursor-pointer group"
                        >
                          <div className="h-9 w-9 rounded-xl bg-[#002970] flex items-center justify-center text-[#00b9f5] font-extrabold text-[10px] tracking-tight shadow-2xs mb-1 group-hover:scale-105 transition-transform">
                            Paytm
                          </div>
                          <span className="text-xs font-bold text-ink">Paytm</span>
                        </button>
                      </div>
                    </div>

                    {/* Quick 1-Tap Copy Rows for Studio UPI ID & Phone */}
                    <div className="pt-1 space-y-2">
                      <div className="flex items-center justify-between rounded-xl bg-[#f5ebe0]/70 px-3 py-2 border border-[#8a614818]">
                        <div className="text-left min-w-0 pr-2">
                          <span className="text-[10px] uppercase font-bold text-[#765442]/70 block">
                            Studio UPI ID
                          </span>
                          <span className="text-xs font-bold text-ink truncate block">{upi}</span>
                        </div>
                        <button
                          type="button"
                          onClick={copyUpiId}
                          className="shrink-0 rounded-lg bg-clay px-3 py-1 text-xs font-semibold text-white hover:bg-ink transition shadow-2xs cursor-pointer"
                        >
                          {copiedUpi ? "Copied! ✓" : "Copy ID"}
                        </button>
                      </div>

                      <div className="flex items-center justify-between rounded-xl bg-[#f5ebe0]/70 px-3 py-2 border border-[#8a614818]">
                        <div className="text-left min-w-0 pr-2">
                          <span className="text-[10px] uppercase font-bold text-[#765442]/70 block">
                            Studio Mobile (GPay / PhonePe)
                          </span>
                          <span className="text-xs font-bold text-ink truncate block">+91 9552682389</span>
                        </div>
                        <button
                          type="button"
                          onClick={copyPhone}
                          className="shrink-0 rounded-lg bg-white px-3 py-1 text-xs font-semibold text-[#765442] hover:bg-clay hover:text-white transition shadow-2xs cursor-pointer border border-[#8a614820]"
                        >
                          {copiedPhone ? "Copied! ✓" : "Copy Number"}
                        </button>
                      </div>
                    </div>

                    {/* QR Code Collapsible Drawer */}
                    <div className="pt-2 border-t border-[#8a614815]">
                      <button
                        type="button"
                        onClick={() => setShowQrExpanded(!showQrExpanded)}
                        className="w-full py-2.5 rounded-xl bg-[#fffaf3] border border-[#8a614820] text-xs font-semibold text-clay hover:text-ink transition flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <span>📷</span>
                        <span>
                          {showQrExpanded
                            ? "Hide Payment QR Code ▲"
                            : "Show QR Code to Scan / Screenshot ▼"}
                        </span>
                      </button>

                      {showQrExpanded && (
                        <div className="mt-3 p-4 bg-[#fffaf3] rounded-2xl border border-[#8a614820] flex flex-col items-center text-center animate-in fade-in">
                          <div className="p-2.5 bg-white rounded-xl shadow-xs border border-[#8a614815]">
                            <QRCodeSVG value={paymentUri} size={150} />
                          </div>
                          <p className="mt-2 text-xs font-bold text-ink">Scan to pay ₹{total}</p>
                          <p className="text-[11px] text-[#765442] mt-0.5 max-w-xs">
                            Take a screenshot to use <b>&quot;Scan from Photo / Gallery&quot;</b> inside PhonePe or Google Pay!
                          </p>
                        </div>
                      )}
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
