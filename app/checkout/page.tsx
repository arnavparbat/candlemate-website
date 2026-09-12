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
  const [upi, setUpi] = useState("candlemate@upi");
  const [form, setForm] = useState({ name: "", address: "", phone: "" });
  const [error, setError] = useState("");
  const [shot, setShot] = useState("");
  const [order, setOrder] = useState<any>(null);

  // Snapshot of order details preserved when cart items are cleared on order placement
  const [placedOrder, setPlacedOrder] = useState<{
    id: string;
    customer: { name: string; address: string; phone: string };
    items: Array<{ name: string; quantity: number; price: number }>;
    total: number;
  } | null>(null);

  // UPI Pop-up and Payment States
  const [showUpiModal, setShowUpiModal] = useState(false);
  const [appLaunched, setAppLaunched] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const hasAutoRedirected = useRef(false);

  useEffect(() => {
    fetch("/api/settings/payment")
      .then((r) => r.json())
      .then((x) => {
        if (x.upiId) setUpi(x.upiId);
      })
      .catch(() => {});

    if (typeof navigator !== "undefined") {
      setIsIos(/iPad|iPhone|iPod/.test(navigator.userAgent));
    }
  }, []);

  const paymentUri = `upi://pay?pa=${encodeURIComponent(upi)}&pn=Candlemate&am=${total}&cu=INR&tn=${encodeURIComponent(
    "Candlemate Order"
  )}`;

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
    setAppLaunched(false);
    setShowUpiModal(true);
  }

  function getUpiAppUri(app: "gpay" | "phonepe" | "paytm" | "bhim" | "generic") {
    const params = `pa=${encodeURIComponent(upi)}&pn=${encodeURIComponent(
      "Candlemate"
    )}&am=${encodeURIComponent(total)}&cu=INR&tn=${encodeURIComponent("Candlemate Order")}`;

    if (typeof navigator === "undefined") {
      return `upi://pay?${params}`;
    }

    const ua = navigator.userAgent || "";
    const isIosDevice = /iPad|iPhone|iPod/.test(ua);
    const isAndroidDevice = /Android/.test(ua);

    // iOS handles registered custom URL schemes directly without delegating upi:// to WhatsApp
    if (isIosDevice) {
      switch (app) {
        case "gpay":
          return `gpay://upi/pay?${params}`;
        case "phonepe":
          return `phonepe://pay?${params}`;
        case "paytm":
          return `paytmmp://pay?${params}`;
        case "bhim":
          return `bhim://pay?${params}`;
        default:
          return `upi://pay?${params}`;
      }
    }

    // Android Chrome can direct-intent to specific apps to bypass app chooser
    if (isAndroidDevice) {
      switch (app) {
        case "gpay":
          return `intent://pay?${params}#Intent;scheme=upi;package=com.google.android.apps.nbu.paisa.user;end`;
        case "phonepe":
          return `intent://pay?${params}#Intent;scheme=upi;package=com.phonepe.app;end`;
        case "paytm":
          return `intent://pay?${params}#Intent;scheme=upi;package=net.one97.paytm;end`;
        case "bhim":
          return `intent://pay?${params}#Intent;scheme=upi;package=in.org.npci.upiapp;end`;
        default:
          return `upi://pay?${params}`;
      }
    }

    return `upi://pay?${params}`;
  }

  function openUpiApp(app: "gpay" | "phonepe" | "paytm" | "bhim" | "generic") {
    const uri = getUpiAppUri(app);
    setAppLaunched(true);
    window.location.href = uri;
  }

  function copyUpiId() {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(upi).then(() => {
        setCopiedUpi(true);
        setTimeout(() => setCopiedUpi(false), 2200);
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
      // Compress client-side so it uploads fast and uses minimal storage
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

    // Save snapshot of order with candle names, quantities, and total so receipt stays complete after clearing cart
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

  // Automatically open WhatsApp directly when order is completed
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
      <main className="mx-auto min-h-[75vh] max-w-5xl px-5 py-8 sm:py-12">
        {/* Step Progress Tracker */}
        <div className="mb-6 flex items-center justify-between border-b border-[#8a61481a] pb-4">
          <div className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition ${
                phase === "details" ? "bg-ink text-white" : "bg-clay text-white"
              }`}
            >
              {phase === "details" ? "1" : "✓"}
            </span>
            <span
              className={`text-xs font-semibold uppercase tracking-wider transition ${
                phase === "details" ? "text-ink" : "text-clay"
              }`}
            >
              Delivery Details
            </span>
          </div>

          <span className="h-px flex-1 mx-3 bg-[#8a614820] max-w-[50px] sm:max-w-[90px]" />

          <div className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition ${
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
              className={`text-xs font-semibold uppercase tracking-wider transition ${
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

          <span className="h-px flex-1 mx-3 bg-[#8a614820] max-w-[50px] sm:max-w-[90px]" />

          <div className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition ${
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
              className={`text-xs font-semibold uppercase tracking-wider transition ${
                phase === "done" || phase === "burning" ? "text-ink" : "text-[#765442]/60"
              }`}
            >
              Ignition & Glow
            </span>
          </div>
        </div>

        {/* Phase 1 & 2: Details and Payment */}
        {(phase === "details" || phase === "pay") && (
          <div className="grid gap-8 md:grid-cols-[1fr_330px] items-start">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.2em] text-clay">
                A little closer to your glow
              </p>
              <h1 className="display mt-2 text-3xl sm:text-5xl text-ink">
                {phase === "details" ? "Delivery details" : "Finish your payment"}
              </h1>

              {/* Mobile Dedicated Candle Card */}
              <div className="md:hidden mt-4 rounded-2xl border border-[#8a614822] bg-[#fffaf3] p-3.5 shadow-sm">
                <div className="flex items-center gap-3.5">
                  <div className="flex-shrink-0 w-20 h-24 rounded-xl bg-[#f5ebe0]/80 border border-[#8a614818] flex items-center justify-center overflow-hidden">
                    <div className="scale-[0.52] origin-center -my-14 -mx-10">
                      <Candle stage={candleStage} showBadge={false} />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-clay animate-pulse" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-clay">
                        {phase === "details" ? "Step 1 of 3 · Crafting" : "Step 2 of 3 · Payment"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm font-semibold text-ink truncate">
                      {phase === "details" ? "Spiral wick set in soy wax" : "Ember ready · Awaiting flame"}
                    </p>
                    <p className="mt-0.5 text-xs text-[#765442] line-clamp-1">
                      {phase === "details"
                        ? "Enter your delivery details below"
                        : "Pay ₹" + total + " via UPI app or scan QR below"}
                    </p>
                    <div className="mt-2">
                      <span className="inline-block text-[11px] font-medium text-clay bg-[#f5ebe0] rounded-full px-2.5 py-0.5">
                        {phase === "details" ? "✓ Wax poured in studio" : "✓ Delivery details set"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 1: Input details form */}
              {phase === "details" && (
                <form
                  onSubmit={details}
                  className="paper mt-5 space-y-4 rounded-3xl p-6 sm:p-8 shadow-sm bg-white/95"
                >
                  <label className="block text-sm text-[#765442]">
                    Your name
                    <input
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="mt-1.5 w-full rounded-xl border border-[#8a61483a] bg-white px-3.5 py-3 text-ink outline-clay focus:border-clay"
                      placeholder="Your full name"
                    />
                  </label>
                  <label className="block text-sm text-[#765442]">
                    Delivery address
                    <textarea
                      required
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      className="mt-1.5 h-24 w-full rounded-xl border border-[#8a61483a] bg-white px-3.5 py-3 text-ink outline-clay focus:border-clay"
                      placeholder="House, street, city and PIN code"
                    />
                  </label>
                  <label className="block text-sm text-[#765442]">
                    Phone / WhatsApp
                    <input
                      required
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="mt-1.5 w-full rounded-xl border border-[#8a61483a] bg-white px-3.5 py-3 text-ink outline-clay focus:border-clay"
                      placeholder="98765 43210"
                    />
                  </label>
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-sm text-[#765442]">Order total:</span>
                    <b className="display text-2xl text-ink">₹{total}</b>
                  </div>
                  {error && (
                    <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700 border border-red-200">
                      {error}
                    </div>
                  )}
                  <button
                    type="submit"
                    className="w-full rounded-full bg-ink py-3.5 text-sm font-medium text-white hover:bg-clay transition shadow-sm cursor-pointer"
                  >
                    Continue to payment →
                  </button>
                </form>
              )}

              {/* Step 2: Payment Section */}
              {phase === "pay" && (
                <div className="paper mt-5 rounded-3xl p-6 sm:p-8 shadow-sm bg-white/95">
                  {/* Quick Action Button: Re-open UPI Apps Modal */}
                  <button
                    type="button"
                    onClick={() => {
                      setAppLaunched(false);
                      setShowUpiModal(true);
                    }}
                    className="mb-5 flex items-center justify-between w-full rounded-2xl bg-gradient-to-r from-clay to-[#8a6148] px-5 py-3.5 text-white shadow-md hover:opacity-95 transition"
                  >
                    <div className="flex items-center gap-2.5 text-left">
                      <span className="text-xl">⚡</span>
                      <div>
                        <p className="text-xs uppercase tracking-wider font-bold text-white/85">Instant Pay on Mobile</p>
                        <p className="text-sm font-semibold">Pay ₹{total} via Google Pay, PhonePe, or Paytm</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold bg-white/20 rounded-xl px-2.5 py-1">Open Apps →</span>
                  </button>

                  {/* HIGH-VISIBILITY MANDATORY SCREENSHOT NOTICE */}
                  <div className="mb-6 rounded-2xl border-2 border-amber-300 bg-amber-50/90 p-4 sm:p-5 shadow-sm text-left">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl select-none">⚠️</span>
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-amber-950">
                          Mandatory Note: Upload Screenshot in Website to Finalize Order
                        </h4>
                        <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-amber-900 font-medium">
                          After paying through your UPI app or scanning the QR code, please <b>take a screenshot of your payment confirmation</b> and <b>upload it below</b>. Your handcrafted candle order is only confirmed once this screenshot is uploaded!
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* QR Code & UPI Information */}
                  <div className="flex flex-wrap items-center gap-6">
                    <div className="rounded-2xl bg-white p-3 border border-[#8a614820] shadow-sm">
                      <QRCodeSVG value={paymentUri} size={150} />
                    </div>
                    <div className="flex-1 min-w-[200px]">
                      <p className="text-sm text-[#765442]">Pay exactly</p>
                      <p className="display text-4xl text-ink">₹{total}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="text-sm text-[#765442]">UPI ID:</span>
                        <b className="text-clay text-sm">{upi}</b>
                        <button
                          type="button"
                          onClick={copyUpiId}
                          className="rounded-lg bg-[#f5ebe0] px-2.5 py-1 text-xs font-semibold text-clay hover:bg-clay hover:text-white transition cursor-pointer"
                        >
                          {copiedUpi ? "Copied! ✓" : "Copy"}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPhase("details")}
                        className="mt-3 text-xs text-clay underline hover:text-ink block"
                      >
                        ← Edit delivery details
                      </button>
                    </div>
                  </div>

                  {/* Steps Checklist */}
                  <div className="mt-6 rounded-2xl bg-[#fffaf3] border border-[#8a614815] p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-clay mb-2">How to complete your order:</p>
                    <ol className="list-decimal space-y-1.5 pl-4 text-xs sm:text-sm leading-relaxed text-[#765442]">
                      <li>Pay ₹{total} via Google Pay, PhonePe, Paytm, or scan the QR code above.</li>
                      <li>Take a screenshot of the successful payment confirmation.</li>
                      <li>Upload your screenshot below and click &quot;Finalize my order&quot;.</li>
                    </ol>
                  </div>

                  {/* Screenshot Upload Zone */}
                  <label
                    className={`mt-6 block cursor-pointer rounded-2xl border-2 border-dashed p-5 text-center transition ${
                      shot
                        ? "border-green-600 bg-green-50/70 text-green-900"
                        : "border-[#a66a46] bg-[#fffaf3] text-clay hover:bg-[#fff8ed]"
                    }`}
                  >
                    {shot ? (
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xl">✅</span>
                        <span className="text-sm font-bold text-green-900">Payment screenshot attached!</span>
                        <span className="text-xs text-green-800 underline">Tap to change or re-upload image</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1.5">
                        <span className="text-2xl">📸</span>
                        <span className="text-sm font-bold text-clay">Upload payment screenshot</span>
                        <span className="text-xs text-[#765442]">
                          Required to finalize order · Tap to choose from photo gallery or camera
                        </span>
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
                    <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700 border border-red-200">
                      {error}
                    </div>
                  )}

                  <button
                    onClick={submit}
                    className={`mt-5 w-full rounded-full py-4 text-sm font-semibold transition shadow-sm ${
                      shot
                        ? "bg-ink text-white hover:bg-clay cursor-pointer"
                        : "bg-ink text-white hover:bg-clay cursor-pointer opacity-90"
                    }`}
                  >
                    {shot ? "I’ve paid — finalize my order →" : "Upload screenshot above to finalize order"}
                  </button>
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
                  {phase === "details" && "Your amber glass jar is poured with pure soy wax & spiral cotton wick."}
                  {phase === "pay" && "Wick ember is set — complete UPI payment to ignite your candle order."}
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
                <p className="text-xs text-[#765442] uppercase tracking-wider font-semibold mb-2">Candles Ordered</p>
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

            <Link
              href="/"
              className="mt-6 inline-block rounded-full bg-ink px-8 py-3 text-sm font-medium text-cream hover:bg-clay transition"
            >
              Browse more candles
            </Link>
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* AUTOMATIC POP-UP MODAL: UPI APPS SELECTION & PAYMENT ROUTING */}
      {/* ========================================================================= */}
      {showUpiModal && phase === "pay" && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowUpiModal(false);
          }}
        >
          <div className="relative w-full max-w-md rounded-3xl bg-[#fffdf9] p-6 sm:p-7 shadow-2xl border border-[#8a614825] max-h-[92vh] overflow-y-auto">
            {/* Close Modal Button */}
            <button
              type="button"
              onClick={() => setShowUpiModal(false)}
              className="absolute top-4 right-4 h-8 w-8 rounded-full bg-[#f5ebe0] text-clay hover:bg-clay hover:text-white flex items-center justify-center transition cursor-pointer font-bold text-sm"
              aria-label="Close modal"
            >
              ✕
            </button>

            {/* Modal Header */}
            <div className="text-center pr-6">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#f5ebe0] px-3 py-1 text-xs font-semibold text-clay">
                <span>⚡ Instant UPI Payment</span>
              </div>
              <h3 className="display mt-2 text-2xl text-ink">Choose UPI App to Pay</h3>
              <p className="mt-1 text-xs text-[#765442]">
                Paying <b className="text-ink">₹{total}</b> to <span className="text-clay font-medium">Candlemate</span>
              </p>
            </div>

            {/* HIGH-VISIBILITY MANDATORY SCREENSHOT INSTRUCTION */}
            <div className="mt-4 rounded-2xl border-2 border-amber-300 bg-amber-50 p-3.5 text-left shadow-xs">
              <div className="flex items-start gap-2.5">
                <span className="text-xl select-none leading-none">⚠️</span>
                <div>
                  <p className="text-[11px] font-bold text-amber-950 uppercase tracking-wide">
                    Mandatory: Upload Screenshot to Finalize Order
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-amber-900 font-medium">
                    After paying in your app, please <b>take a screenshot</b> and <b>upload it on this website</b> to finalize your order.
                  </p>
                </div>
              </div>
            </div>

            {/* Specific iOS Notice: Explaining direct buttons to avoid WhatsApp redirect */}
            {isIos && (
              <div className="mt-2.5 rounded-xl border border-blue-200 bg-blue-50/90 p-2.5 text-left flex items-start gap-2">
                <span className="text-sm">💡</span>
                <p className="text-[11px] leading-snug text-blue-900 font-medium">
                  <b>iPhone tip:</b> Tap <b>Google Pay</b>, <b>PhonePe</b>, or <b>Paytm</b> directly below to open your app without being redirected to WhatsApp!
                </p>
              </div>
            )}

            {/* Modal Body: Either App Launcher Buttons or Post-Launch Instructions */}
            {appLaunched ? (
              <div className="mt-5 rounded-2xl bg-[#fff8ed] border border-[#8a614825] p-5 text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-[#f5ebe0] flex items-center justify-center text-2xl mb-2.5 shadow-xs">
                  📸
                </div>
                <h4 className="text-sm font-bold text-ink uppercase tracking-wide">
                  Payment App Opened
                </h4>
                <p className="mt-1.5 text-xs text-[#765442] leading-relaxed">
                  Once your payment of <b className="text-ink">₹{total}</b> is done:
                </p>
                <div className="mt-3 text-left space-y-1 text-xs text-ink/80 bg-white/80 rounded-xl p-3 border border-[#8a614815]">
                  <p>1. Take a screenshot of the payment receipt.</p>
                  <p>2. Tap below to upload it and finalize your order.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowUpiModal(false);
                    const input = document.getElementById("payment-screenshot-input");
                    if (input) input.click();
                  }}
                  className="mt-4 w-full rounded-full bg-ink py-3 text-xs font-bold text-white hover:bg-clay transition shadow-sm cursor-pointer"
                >
                  📸 Upload Payment Screenshot Now →
                </button>
                <button
                  type="button"
                  onClick={() => setAppLaunched(false)}
                  className="mt-2.5 text-[11px] text-clay underline hover:text-ink cursor-pointer block w-full"
                >
                  ← Choose a different payment app
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-2.5">
                {/* 1. Google Pay */}
                <button
                  type="button"
                  onClick={() => openUpiApp("gpay")}
                  className="w-full flex items-center justify-between rounded-2xl border border-[#8a614820] bg-white p-3.5 hover:border-clay hover:shadow-md transition group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center shadow-xs">
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
                    <div className="text-left">
                      <p className="text-sm font-bold text-ink group-hover:text-clay">Google Pay</p>
                      <p className="text-[11px] text-[#765442]">Pay ₹{total} directly via GPay</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-clay group-hover:translate-x-0.5 transition-transform">
                    Pay →
                  </span>
                </button>

                {/* 2. PhonePe */}
                <button
                  type="button"
                  onClick={() => openUpiApp("phonepe")}
                  className="w-full flex items-center justify-between rounded-2xl border border-[#8a614820] bg-white p-3.5 hover:border-clay hover:shadow-md transition group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-[#5f259f] flex items-center justify-center text-white font-bold text-base shadow-xs">
                      पे
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-ink group-hover:text-clay">PhonePe</p>
                      <p className="text-[11px] text-[#765442]">Pay ₹{total} directly via PhonePe</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-clay group-hover:translate-x-0.5 transition-transform">
                    Pay →
                  </span>
                </button>

                {/* 3. Paytm */}
                <button
                  type="button"
                  onClick={() => openUpiApp("paytm")}
                  className="w-full flex items-center justify-between rounded-2xl border border-[#8a614820] bg-white p-3.5 hover:border-clay hover:shadow-md transition group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-[#002970] flex items-center justify-center text-[#00b9f5] font-extrabold text-[11px] tracking-tight shadow-xs">
                      Paytm
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-ink group-hover:text-clay">Paytm</p>
                      <p className="text-[11px] text-[#765442]">Pay ₹{total} directly via Paytm</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-clay group-hover:translate-x-0.5 transition-transform">
                    Pay →
                  </span>
                </button>

                {/* 4. BHIM / Other UPI */}
                <button
                  type="button"
                  onClick={() => openUpiApp(isIos ? "gpay" : "generic")}
                  className="w-full flex items-center justify-between rounded-2xl border border-[#8a614820] bg-white p-3.5 hover:border-clay hover:shadow-md transition group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#f37021] to-[#007a3d] flex items-center justify-center text-white font-bold text-xs shadow-xs">
                      UPI
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-ink group-hover:text-clay">
                        {isIos ? "Other UPI / Scan QR" : "BHIM / Any Other UPI"}
                      </p>
                      <p className="text-[11px] text-[#765442]">Pay ₹{total} with your preferred UPI app</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-clay group-hover:translate-x-0.5 transition-transform">
                    Pay →
                  </span>
                </button>
              </div>
            )}

            {/* Copy UPI ID Box */}
            <div className="mt-4 flex items-center justify-between rounded-xl bg-[#f5ebe0]/70 px-3.5 py-2.5 border border-[#8a614818]">
              <div className="text-left min-w-0 pr-2">
                <span className="text-[10px] uppercase font-bold text-[#765442]/70 block">Studio UPI ID</span>
                <span className="text-xs font-bold text-ink truncate block">{upi}</span>
              </div>
              <button
                type="button"
                onClick={copyUpiId}
                className="shrink-0 rounded-lg bg-clay px-3 py-1 text-xs font-semibold text-white hover:bg-ink transition shadow-xs cursor-pointer"
              >
                {copiedUpi ? "Copied! ✓" : "Copy ID"}
              </button>
            </div>

            {/* Dismiss Modal & Show QR Code Option */}
            <button
              type="button"
              onClick={() => setShowUpiModal(false)}
              className="mt-4 w-full py-2 text-xs font-medium text-[#765442] hover:text-ink transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>📷</span>
              <span>Prefer scanning QR code on desktop/another phone? Click here</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
