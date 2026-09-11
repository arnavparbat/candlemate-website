"use client";

import { Header } from "@/components/header";
import { useCart } from "@/components/cart-context";
import { Candle } from "@/components/candle";
import { QRCodeSVG } from "qrcode.react";
import { FormEvent, useEffect, useState } from "react";

type Phase = "details" | "pay" | "burning" | "done";

export default function Checkout() {
  const { items, total, clear } = useCart();
  const [phase, setPhase] = useState<Phase>("details");
  const [upi, setUpi] = useState("candlemate@upi");
  const [form, setForm] = useState({ name: "", address: "", phone: "" });
  const [error, setError] = useState("");
  const [shot, setShot] = useState("");
  const [order, setOrder] = useState<any>(null);

  useEffect(() => {
    fetch("/api/settings/payment")
      .then((r) => r.json())
      .then((x) => setUpi(x.upiId));
  }, []);

  const paymentUri = `upi://pay?pa=${upi}&pn=Candlemate&am=${total}&cu=INR`;

  function details(e: FormEvent) {
    e.preventDefault();
    if (!items.length) return setError("Your bag is empty.");
    if (!form.name || form.address.length < 8 || !/^\+?[0-9\s-]{8,16}$/.test(form.phone)) {
      return setError("Please enter your name, full address, and a valid contact number.");
    }
    setError("");
    setPhase("pay");
  }

  function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 4_000_000) return setError("Please choose an image smaller than 4 MB.");
    const reader = new FileReader();
    reader.onload = () => setShot(String(reader.result));
    reader.readAsDataURL(f);
  }

  async function submit() {
    if (!shot) return setError("Upload your payment screenshot to place the order.");
    setError("");
    setPhase("burning");

    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer: form, items, screenshot: shot }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      setPhase("pay");
      return;
    }
    setOrder(data);
    clear();
    setTimeout(() => setPhase("done"), 3300);
  }

  return (
    <>
      <Header />
      <main className="relative mx-auto min-h-[75vh] max-w-5xl overflow-hidden px-5 py-12">
        {/* Realistic Animated Candle showcasing the stage */}
        <div className="pointer-events-none absolute right-2 bottom-4 md:right-10 md:top-24 md:bottom-auto opacity-80 md:opacity-100 transition-all duration-500">
          <Candle
            stage={
              phase === "details"
                ? "checkout"
                : phase === "done"
                ? "done"
                : phase === "burning"
                ? "burning"
                : "checkout"
            }
          />
        </div>

        <div className="relative max-w-xl">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-clay">
            A little closer to your glow
          </p>
          <h1 className="display mt-2 text-4xl sm:text-5xl text-ink">
            {phase === "details"
              ? "Delivery details"
              : phase === "pay"
              ? "Finish your payment"
              : "Order received"}
          </h1>

          {phase === "details" && (
            <form onSubmit={details} className="paper mt-8 space-y-4 rounded-3xl p-6 shadow-sm">
              <label className="block text-sm text-[#765442]">
                Your name
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-[#8a61483a] bg-white px-3 py-3 text-ink outline-clay"
                  placeholder="Your full name"
                />
              </label>
              <label className="block text-sm text-[#765442]">
                Delivery address
                <textarea
                  required
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="mt-1 h-24 w-full rounded-xl border border-[#8a61483a] bg-white px-3 py-3 text-ink outline-clay"
                  placeholder="House, street, city and PIN code"
                />
              </label>
              <label className="block text-sm text-[#765442]">
                Phone / WhatsApp
                <input
                  required
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-[#8a61483a] bg-white px-3 py-3 text-ink outline-clay"
                  placeholder="98765 43210"
                />
              </label>
              <p className="text-sm font-semibold text-clay">Order total: ₹{total}</p>
              {error && <p className="text-sm text-red-700">{error}</p>}
              <button className="w-full rounded-full bg-ink py-3 text-sm text-white hover:bg-clay transition">
                Continue to payment
              </button>
            </form>
          )}

          {phase === "pay" && (
            <div className="paper mt-8 rounded-3xl p-6 shadow-sm">
              <div className="flex flex-wrap items-center gap-6">
                <div className="rounded-2xl bg-white p-3 border border-[#8a614820] shadow-sm">
                  <QRCodeSVG value={paymentUri} size={150} />
                </div>
                <div>
                  <p className="text-sm text-[#765442]">Pay exactly</p>
                  <p className="display text-4xl text-ink">₹{total}</p>
                  <p className="mt-2 text-sm text-[#765442]">
                    UPI ID: <b className="text-clay">{upi}</b>
                  </p>
                </div>
              </div>
              <ol className="mt-6 list-decimal space-y-2 pl-5 text-sm leading-6 text-[#765442]">
                <li>Scan this code with any UPI app (GPay, PhonePe, Paytm) and complete your payment.</li>
                <li>Upload a screenshot below so our studio can match it quickly.</li>
              </ol>
              <label className="mt-6 block cursor-pointer rounded-xl border border-dashed border-[#a66a46] p-4 text-center text-sm text-clay hover:bg-[#fff8ed] transition">
                {shot ? "Screenshot added ✓ — tap to change" : "Upload payment screenshot"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={upload}
                />
              </label>
              {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
              <button
                onClick={submit}
                className="mt-4 w-full rounded-full bg-ink py-3 text-sm text-white hover:bg-clay transition"
              >
                I’ve paid — place my order
              </button>
            </div>
          )}

          {phase === "burning" && (
            <div className="mt-8 paper rounded-3xl p-6 shadow-sm">
              <p className="display text-2xl text-ink">Igniting your order...</p>
              <p className="mt-2 text-sm text-[#765442]">
                Your payment proof is on its way to our studio. The flame is lit!
              </p>
            </div>
          )}

          {phase === "done" && (
            <div className="paper mt-8 rounded-3xl p-6 shadow-sm">
              <p className="display text-2xl text-ink">Thank you, {form.name}!</p>
              <p className="mt-2 text-[#765442]">We’ve received your order.</p>
              <p className="mt-3 text-sm text-ink">
                Your order ID: <b className="text-clay">{order?.id}</b>
              </p>
              <p className="mt-1 text-sm text-[#765442]">
                We’ll message you on {form.phone} as it moves through the studio.
              </p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
