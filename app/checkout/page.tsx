"use client";

import { Header } from "@/components/header";
import { useCart } from "@/components/cart-context";
import { Candle, CandleStage } from "@/components/candle";
import { QRCodeSVG } from "qrcode.react";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

type Phase = "details" | "pay" | "burning" | "done";

export default function Checkout() {
  const { items, total, clear } = useCart();
  const [phase, setPhase] = useState<Phase>("details");
  const [upi, setUpi] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("candlemate_upi_id");
      if (saved) return saved;
    }
    return process.env.NEXT_PUBLIC_UPI_ID || "9552682389@ybl";
  });
  const [form, setForm] = useState({ name: "", address: "", phone: "" });
  const [error, setError] = useState("");
  const [shot, setShot] = useState("");
  const [order, setOrder] = useState<any>(null);

  useEffect(() => {
    // 1. Immediately read any studio-saved UPI from localStorage
    const saved = localStorage.getItem("candlemate_upi_id");
    if (saved) {
      setUpi(saved);
    }

    // 2. Fetch fresh live payment settings bypassing all CDN & browser caching
    fetch(`/api/settings/payment?_t=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((x) => {
        if (x && x.upiId) {
          setUpi(x.upiId);
          localStorage.setItem("candlemate_upi_id", x.upiId);
        }
      })
      .catch((err) => {
        console.warn("Could not fetch payment settings:", err);
      });
  }, []);

  const paymentNote = encodeURIComponent("Attach screenshot on website to finalize order");
  const paymentUri = `upi://pay?pa=${upi}&pn=Candlemate&am=${total}&cu=INR&tn=${paymentNote}`;

  const candleStage: CandleStage =
    phase === "details"
      ? "checkout"
      : phase === "pay"
      ? "lighting"
      : phase === "burning"
      ? "burning"
      : "done";

  function triggerUpiRedirect(uri?: string) {
    if (typeof window === "undefined") return;
    const target = uri || paymentUri;
    try {
      window.location.href = target;
    } catch (err) {
      console.warn("Could not trigger UPI intent:", err);
    }
  }

  function details(e: FormEvent) {
    e.preventDefault();
    if (!items.length) return setError("Your bag is empty.");
    if (!form.name || form.address.length < 8 || !/^\+?[0-9\s-]{8,16}$/.test(form.phone)) {
      return setError("Please enter your name, full address, and a valid contact number.");
    }
    setError("");
    setPhase("pay");

    // Automatically prompt/open preferred UPI app (GPay, PhonePe, Paytm, etc.) on mobile devices
    if (typeof window !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      setTimeout(() => {
        triggerUpiRedirect(`upi://pay?pa=${upi}&pn=Candlemate&am=${total}&cu=INR&tn=${paymentNote}`);
      }, 350);
    }
  }

  function fileToOptimizedScreenshot(file: File, maxDim = 800, quality = 0.72): Promise<string> {
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
      // Compress and optimize screenshot client-side so it uploads quickly in <200ms
      const optimized = await fileToOptimizedScreenshot(f);
      setShot(optimized);
    } catch {
      const reader = new FileReader();
      reader.onload = () => setShot(String(reader.result));
      reader.readAsDataURL(f);
    }
  }

  async function submit() {
    if (!shot) return setError("Upload your payment screenshot to place the order.");
    setError("");
    setPhase("burning");

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer: form, items, screenshot: shot }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not complete order. Please try again.");
        setPhase("pay");
        return;
      }
      setOrder(data);

      // Instantaneous Broadcast & Local Persistence for Studio (0ms latency)
      if (typeof window !== "undefined") {
        try {
          const stored = JSON.parse(localStorage.getItem("candlemate_orders") || "[]");
          if (!stored.some((o: any) => o.id === data.id)) {
            localStorage.setItem("candlemate_orders", JSON.stringify([data, ...stored]));
          }
          if ("BroadcastChannel" in window) {
            const bc = new BroadcastChannel("candlemate_orders_stream");
            bc.postMessage({ type: "NEW_ORDER", order: data });
            bc.close();
          }
          localStorage.setItem(
            "candlemate_latest_order_event",
            JSON.stringify({ order: data, timestamp: Date.now() })
          );
        } catch {}
      }

      clear();
      setTimeout(() => setPhase("done"), 3300);
    } catch (err) {
      console.error("Order submit failed:", err);
      setError("Network error while completing order. Please try again.");
      setPhase("pay");
    }
  }

  return (
    <>
      <Header />
      <main className="mx-auto min-h-[75vh] max-w-5xl px-5 py-8 sm:py-12">
        {/* Step Progress Tracker */}
        <div className="mb-6 flex items-center justify-between border-b border-[#8a61481a] pb-4">
          <div className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition ${
                phase === "details"
                  ? "bg-ink text-white"
                  : "bg-clay text-white"
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

        {/* Phase 1 & 2: Details and Payment (2-column layout on desktop, clean stacked layout on mobile) */}
        {(phase === "details" || phase === "pay") && (
          <div className="grid gap-8 md:grid-cols-[1fr_330px] items-start">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.2em] text-clay">
                A little closer to your glow
              </p>
              <h1 className="display mt-2 text-3xl sm:text-5xl text-ink">
                {phase === "details" ? "Delivery details" : "Finish your payment"}
              </h1>

              {/* Mobile Dedicated Candle Card — Cleanly placed ABOVE input fields, never in the background! */}
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
                        : "Scan QR below to ignite the flame"}
                    </p>
                    <div className="mt-2">
                      <span className="inline-block text-[11px] font-medium text-clay bg-[#f5ebe0] rounded-full px-2.5 py-0.5">
                        {phase === "details" ? "✓ Wax poured in studio" : "✓ Delivery details set"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 1: Input details form with solid background — completely clean and unobstructed */}
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
                  <button className="w-full rounded-full bg-ink py-3.5 text-sm font-medium text-white hover:bg-clay transition shadow-sm">
                    Continue to payment →
                  </button>
                </form>
              )}

              {/* Step 2: Payment Section */}
              {phase === "pay" && (
                <div className="paper mt-5 rounded-3xl p-6 sm:p-8 shadow-sm bg-white/95 space-y-5">
                  {/* Direct Pay with UPI App (Automatic on mobile + Direct Tap Button) */}
                  <div className="rounded-2xl border border-emerald-200 bg-[#f4fbf7] p-4">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-base">⚡</span>
                      <div>
                        <p className="text-sm font-semibold text-emerald-950">
                          Pay Directly via UPI App
                        </p>
                        <p className="text-xs text-emerald-800">
                          GPay, PhonePe, Paytm, BHIM, Cred
                        </p>
                      </div>
                    </div>
                    <a
                      href={paymentUri}
                      onClick={() => triggerUpiRedirect()}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-emerald-700 py-3 text-center text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 transition"
                    >
                      <span>Open UPI App to Pay ₹{total} →</span>
                    </a>
                  </div>

                  {/* QR Code and Details (Always preserved) */}
                  <div className="flex flex-wrap items-center gap-6 pt-1">
                    <div className="rounded-2xl bg-white p-3 border border-[#8a614820] shadow-sm">
                      <QRCodeSVG value={paymentUri} size={150} />
                    </div>
                    <div>
                      <p className="text-sm text-[#765442]">Pay exactly</p>
                      <p className="display text-4xl text-ink">₹{total}</p>
                      <p className="mt-2 text-sm text-[#765442]">
                        UPI ID: <b className="text-clay">{upi}</b>
                      </p>
                      <button
                        type="button"
                        onClick={() => setPhase("details")}
                        className="mt-2 text-xs text-clay underline hover:text-ink"
                      >
                        ← Edit delivery details
                      </button>
                    </div>
                  </div>

                  {/* Step instructions with payment note reminder */}
                  <div className="rounded-2xl bg-[#fff8ed] p-4 text-xs leading-relaxed text-[#765442] border border-[#8a614828]">
                    <p className="font-semibold text-ink flex items-center gap-1.5 mb-1.5 text-sm">
                      <span>📸</span> Important payment steps:
                    </p>
                    <ol className="list-decimal space-y-1.5 pl-4">
                      <li>Pay ₹{total} via UPI app or scan the QR code above.</li>
                      <li>In your UPI app, you will see the pre-filled note: <b className="text-ink">"Attach screenshot on website to finalize order"</b>.</li>
                      <li>Take a screenshot of the successful payment screen and upload it below so our studio can verify and dispatch your order.</li>
                    </ol>
                  </div>

                  {/* Screenshot upload */}
                  <label className="block cursor-pointer rounded-xl border border-dashed border-[#a66a46] p-4 text-center text-sm text-clay hover:bg-[#fff8ed] transition">
                    {shot ? "Screenshot added ✓ — tap to change" : "Upload payment screenshot"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={upload}
                    />
                  </label>
                  {error && (
                    <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700 border border-red-200">
                      {error}
                    </div>
                  )}
                  <button
                    onClick={submit}
                    className="w-full rounded-full bg-ink py-3.5 text-sm font-medium text-white hover:bg-clay transition shadow-sm"
                  >
                    I’ve paid — place my order
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
                  {phase === "pay" && "Wick ember is set — scan UPI code to ignite your candle order."}
                </p>
                <div className="mt-4 bg-[#fff8ed] rounded-xl p-3 text-xs text-[#765442] flex justify-between items-center border border-[#8a614818]">
                  <span>Order Total:</span>
                  <b className="text-sm font-semibold text-ink">₹{total}</b>
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* Phase 3: Burning / Igniting (Clean centered atmospheric experience) */}
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
            <h2 className="display mt-5 text-3xl text-ink">Thank you, {form.name}!</h2>
            <p className="mt-2 text-[#765442]">We’ve received your order and started crafting.</p>
            <div className="mt-6 rounded-2xl bg-[#fff8ed] p-5 border border-[#8a614820] w-full text-left">
              <p className="text-xs text-[#765442] uppercase tracking-wider font-semibold">Order Confirmation ID</p>
              <p className="display mt-1 text-2xl font-bold text-clay">{order?.id || "CM-STUDIO"}</p>
              <p className="mt-3 text-xs text-[#765442] leading-relaxed">
                We’ll message updates to <b className="text-ink">{form.phone}</b> as your candle moves through our studio.
              </p>
            </div>

            {/* Direct WhatsApp Bridge from Customer to Studio */}
            <a
              href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                `👋 Hi Candlemate Studio! I just placed an order on your website.\n\n` +
                  `🧾 Order ID: ${order?.id || "CM-STUDIO"}\n` +
                  `👤 Name: ${form.name}\n` +
                  `📞 Phone: ${form.phone}\n` +
                  `📍 Delivery Address:\n${form.address}\n\n` +
                  `🕯️ Ordered Candles:\n${items
                    .map((item) => `• ${item.quantity}x ${item.name} (₹${item.price * item.quantity})`)
                    .join("\n")}\n\n` +
                  `💰 Order Total: ₹${total}\n` +
                  `🖼️ Payment screenshot uploaded on site.\n\n` +
                  `Please confirm receipt and start crafting my order!`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex items-center justify-center gap-2.5 w-full rounded-full bg-[#25D366] px-6 py-3.5 text-sm font-semibold text-white hover:bg-[#1faa4b] transition shadow-md cursor-pointer"
            >
              <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
              </svg>
              Send Order Receipt on WhatsApp ↗
            </a>

            <Link
              href="/"
              className="mt-4 inline-block rounded-full bg-ink px-8 py-3 text-sm font-medium text-cream hover:bg-clay transition"
            >
              Browse more candles
            </Link>
          </div>
        )}
      </main>
    </>
  );
}
