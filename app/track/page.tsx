"use client";

import { Header } from "@/components/header";
import { Order, OrderStatus } from "@/lib/types";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";

const STATUS_STEPS: Array<{
  status: OrderStatus;
  label: string;
  desc: string;
}> = [
  {
    status: "Order Received",
    label: "Order Received",
    desc: "Payment verified & order registered with studio",
  },
  {
    status: "Preparing",
    label: "Preparing",
    desc: "Hand-pouring natural wax & blending fragrances",
  },
  {
    status: "Out for Delivery",
    label: "Out for Delivery",
    desc: "Packaged securely in gift box and dispatched",
  },
  {
    status: "Delivered",
    label: "Delivered",
    desc: "Arrived at your doorstep for cozy slow moments",
  },
];

function getStatusIndex(status: string): number {
  const norm = (status || "").toLowerCase().trim();
  if (norm.includes("deliv") && !norm.includes("out")) return 3;
  if (norm.includes("out")) return 2;
  if (norm.includes("prep") || norm.includes("craft")) return 1;
  return 0; // Default to Order Received
}

function getStatusBadge(status: OrderStatus) {
  const idx = getStatusIndex(status);
  switch (idx) {
    case 3:
      return {
        bg: "bg-emerald-50 text-emerald-800 border-emerald-200",
        dot: "bg-emerald-500",
        label: "Delivered",
      };
    case 2:
      return {
        bg: "bg-purple-50 text-purple-800 border-purple-200",
        dot: "bg-purple-500 animate-pulse",
        label: "Out for Delivery",
      };
    case 1:
      return {
        bg: "bg-amber-50 text-amber-800 border-amber-200",
        dot: "bg-amber-500 animate-pulse",
        label: "Preparing in Studio",
      };
    default:
      return {
        bg: "bg-sky-50 text-sky-800 border-sky-200",
        dot: "bg-sky-500",
        label: "Order Received",
      };
  }
}

function TrackOrderContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("id") || searchParams.get("phone") || searchParams.get("q") || "";

  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchType, setSearchType] = useState<"phone" | "order_id" | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");
  const [phoneLast10, setPhoneLast10] = useState<string | null>(null);

  // Auto-search if query was present in URL on first mount
  useEffect(() => {
    if (initialQuery.trim()) {
      runSearch(initialQuery.trim());
    }
  }, [initialQuery]);

  async function runSearch(searchTerm: string) {
    const term = searchTerm.trim();
    if (!term) {
      setError("Please enter your 5-character Order ID or 10-digit mobile number.");
      return;
    }

    setLoading(true);
    setError("");
    setHasSearched(true);

    try {
      const res = await fetch(`/api/orders/track?q=${encodeURIComponent(term)}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Could not track order. Please check the details.");
        setOrders([]);
        return;
      }

      setSearchType(data.type);
      setPhoneLast10(data.phoneLast10 || null);
      setOrders(data.orders || []);
    } catch {
      setError("Network issue while looking up order. Please try again.");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    runSearch(query);
  }

  // Real-time detection feedback
  const digitsOnly = query.replace(/\D/g, "");
  const isPhone = digitsOnly.length >= 10;
  const detectedType = isPhone
    ? `📱 Phone Number (matching last 10 digits: ••••••${digitsOnly.slice(-10)})`
    : query.trim().length > 0
    ? `🧾 Order ID: ${query.trim().toUpperCase()}`
    : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-14">
      {/* Page Heading */}
      <div className="text-center max-w-xl mx-auto mb-8 sm:mb-10">
        <div className="inline-flex items-center gap-2 rounded-full bg-[#fffaf3] border border-[#8a614822] px-3.5 py-1 text-xs font-semibold text-clay mb-3">
          <img src="/logo-emblem.png" alt="" className="h-4 w-auto object-contain" />
          <span>Live Studio Order Tracker</span>
        </div>
        <h1 className="display text-3xl sm:text-5xl text-ink font-bold tracking-tight">
          Track your candle order
        </h1>
        <p className="mt-3 text-xs sm:text-base text-[#765442] leading-relaxed">
          Enter your <b>Order ID</b> to see your specific order, or your <b>10-digit phone number</b> to view your complete order history.
        </p>
      </div>

      {/* Interactive Search Card */}
      <div className="paper mx-auto max-w-2xl rounded-3xl p-6 sm:p-8 shadow-warm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="track-input" className="block text-xs font-bold uppercase tracking-wider text-clay mb-2">
              Order ID or Mobile Number
            </label>
            <div className="relative flex flex-col sm:flex-row items-stretch gap-2.5">
              <div className="relative flex-1">
                <input
                  id="track-input"
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="e.g. CM-4TIO3 or 9876543210"
                  className="w-full rounded-2xl border border-[#8a614835] bg-white px-4 py-3.5 text-sm sm:text-base text-ink placeholder:text-[#a5816c]/60 focus:border-clay focus:outline-hidden focus:ring-2 focus:ring-clay/20 transition shadow-inner"
                  autoFocus
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setOrders([]);
                      setHasSearched(false);
                      setError("");
                    }}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-[#a5816c] hover:text-ink transition"
                  >
                    Clear
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="flex items-center justify-center gap-2 rounded-2xl bg-ink px-7 py-3.5 text-sm font-semibold text-cream hover:bg-clay disabled:opacity-50 transition shadow-sm cursor-pointer shrink-0"
              >
                {loading ? (
                  <>
                    <svg className="h-4 w-4 animate-spin text-cream" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <span>Tracking...</span>
                  </>
                ) : (
                  <>
                    <span>Track Order</span>
                    <span>→</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Real-time Detection Helper */}
          {detectedType && (
            <div className="flex items-center gap-2 text-xs text-[#765442] bg-[#fffaf3] border border-[#8a614815] rounded-xl px-3.5 py-2">
              <span className="font-medium">{detectedType}</span>
            </div>
          )}

          {/* Quick Guidance Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-[#8a614812] text-[11px] text-[#765442]/80">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-clay" />
              <span><b>Order ID:</b> Displays the single specified order</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-clay" />
              <span><b>Phone Number:</b> Displays all orders placed with your number</span>
            </div>
          </div>
        </form>

        {error && (
          <div className="mt-4 rounded-2xl bg-rose-50 border border-rose-200 p-4 text-xs sm:text-sm text-rose-800 flex items-start gap-2.5">
            <svg className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-semibold">{error}</p>
              <p className="mt-1 text-xs text-rose-700">
                Please verify your details or message our studio on WhatsApp for immediate help.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Results Section */}
      <div className="mt-10 sm:mt-12">
        {loading && (
          <div className="text-center py-14 paper rounded-3xl max-w-xl mx-auto">
            <div className="inline-block animate-bounce mb-3 text-3xl">🕯️</div>
            <p className="display text-xl text-ink font-semibold">Finding your candle orders...</p>
            <p className="text-xs text-[#765442] mt-1">Connecting to Candlemate studio database...</p>
          </div>
        )}

        {!loading && hasSearched && orders.length === 0 && !error && (
          <div className="paper mx-auto max-w-lg rounded-3xl p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#fffaf3] border border-[#8a614820] text-2xl">
              📦
            </div>
            <h2 className="display text-2xl font-bold text-ink">No orders found</h2>
            <p className="mt-2 text-xs sm:text-sm text-[#765442] leading-relaxed">
              We couldn’t find any orders matching <b>&ldquo;{query}&rdquo;</b>.
              {isPhone
                ? " Please check that your 10-digit number matches the phone provided during checkout."
                : " Please verify your 5-character Order ID (e.g. CM-XXXXX)."}
            </p>
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href={`https://api.whatsapp.com/send?phone=919552682389&text=${encodeURIComponent(
                  `Hi Candlemate Studio! I placed an order with details "${query}" but cannot track it on your website. Could you please help me?`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-[#1faa4b] transition shadow-xs w-full sm:w-auto"
              >
                <span>Ask Studio on WhatsApp ↗</span>
              </a>
              <button
                type="button"
                onClick={() => setQuery("")}
                className="rounded-full border border-[#8a614835] bg-white px-5 py-2.5 text-xs sm:text-sm font-semibold text-ink hover:bg-stone-50 transition w-full sm:w-auto"
              >
                Try Another Search
              </button>
            </div>
          </div>
        )}

        {!loading && orders.length > 0 && (
          <div className="space-y-8">
            {/* Header Summary for Phone vs Order ID */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#8a614820]">
              <div>
                <h2 className="display text-xl sm:text-2xl text-ink font-bold">
                  {searchType === "phone"
                    ? `Order History (${orders.length} ${orders.length === 1 ? "order" : "orders"})`
                    : "Order Details"}
                </h2>
                <p className="text-xs text-[#765442] mt-0.5">
                  {searchType === "phone"
                    ? `Showing all orders linked to phone number ending in ••••••${phoneLast10}`
                    : `Showing details for Order ID: ${orders[0]?.id}`}
                </p>
              </div>
              <span className="text-xs font-semibold text-clay bg-[#fffaf3] border border-[#8a614820] rounded-full px-3 py-1 self-start sm:self-auto">
                Live Studio Sync Active
              </span>
            </div>

            {/* List of Orders */}
            {orders.map((order) => {
              const currentStepIdx = getStatusIndex(order.status);
              const badge = getStatusBadge(order.status);
              const orderDate = new Date(order.createdAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });

              const whatsappHelpUrl = `https://api.whatsapp.com/send?phone=919552682389&text=${encodeURIComponent(
                `Hi Candlemate Studio! I'm checking my order *${order.id}*. Status is currently: *${order.status}*. Could you share any updates? ✨`
              )}`;

              return (
                <div
                  key={order.id}
                  className="paper rounded-3xl p-6 sm:p-8 shadow-warm border border-[#8a614822] bg-white/95"
                >
                  {/* Top Order Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-[#8a614815]">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs uppercase tracking-wider text-[#765442] font-semibold">Order ID</span>
                        <span className="display text-xl sm:text-2xl font-bold text-clay">{order.id}</span>
                      </div>
                      <p className="text-xs text-[#765442]/80 mt-0.5">Placed on {orderDate}</p>
                    </div>

                    {/* Status Pill Badge */}
                    <div className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold border ${badge.bg}`}>
                      <span className={`h-2 w-2 rounded-full ${badge.dot}`} />
                      <span>{badge.label}</span>
                    </div>
                  </div>

                  {/* Visual 4-Step Order Lifecycle Timeline */}
                  <div className="py-6 sm:py-8">
                    <p className="text-xs font-bold uppercase tracking-wider text-clay mb-5">Order Progress</p>

                    <div className="relative">
                      {/* Progress Track Line */}
                      <div className="hidden sm:block absolute top-5 left-[5%] right-[5%] h-1 bg-[#8a614815] -z-0">
                        <div
                          className="h-full bg-clay transition-all duration-700"
                          style={{
                            width: `${(Math.min(currentStepIdx, 3) / 3) * 100}%`,
                          }}
                        />
                      </div>

                      {/* 4 Steps Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 sm:gap-2">
                        {STATUS_STEPS.map((step, idx) => {
                          const isDone = idx < currentStepIdx;
                          const isCurrent = idx === currentStepIdx;
                          const isPending = idx > currentStepIdx;

                          return (
                            <div
                              key={step.status}
                              className={`flex sm:flex-col items-start sm:items-center text-left sm:text-center gap-3 sm:gap-2 relative ${
                                isPending ? "opacity-40" : "opacity-100"
                              }`}
                            >
                              {/* Step Circle Indicator */}
                              <div
                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all ${
                                  isDone
                                    ? "bg-clay text-white shadow-xs"
                                    : isCurrent
                                    ? "bg-ink text-white ring-4 ring-[#8a6148]/30 shadow-md scale-110"
                                    : "bg-white border-2 border-[#8a614830] text-[#765442]"
                                }`}
                              >
                                {isDone ? "✓" : idx + 1}
                              </div>

                              {/* Step Text Info */}
                              <div className="min-w-0">
                                <p
                                  className={`text-xs sm:text-sm font-bold ${
                                    isCurrent ? "text-ink" : isDone ? "text-clay" : "text-[#765442]"
                                  }`}
                                >
                                  {step.label}
                                </p>
                                <p className="text-[11px] text-[#765442]/85 mt-0.5 leading-tight hidden sm:block">
                                  {step.desc}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Order Details Grid: Delivery Info + Items Breakdown */}
                  <div className="grid gap-6 md:grid-cols-2 pt-6 border-t border-[#8a614815] text-xs">
                    {/* Left: Customer & Delivery Details */}
                    <div className="space-y-3 rounded-2xl bg-[#fffaf3] p-4 border border-[#8a614815]">
                      <p className="font-bold uppercase tracking-wider text-clay text-[11px]">Delivery Information</p>
                      <div>
                        <p className="text-[#765442]">Recipient Name:</p>
                        <p className="font-semibold text-ink text-sm">{order.customer?.name || "Customer"}</p>
                      </div>
                      <div>
                        <p className="text-[#765442]">Contact Phone:</p>
                        <p className="font-medium text-ink">{order.customer?.phone || "—"}</p>
                      </div>
                      <div>
                        <p className="text-[#765442]">Shipping Address:</p>
                        <p className="font-medium text-ink whitespace-pre-line leading-relaxed">{order.customer?.address || "—"}</p>
                      </div>
                    </div>

                    {/* Right: Ordered Candles & Payment Total */}
                    <div className="flex flex-col justify-between rounded-2xl bg-[#fffaf3] p-4 border border-[#8a614815]">
                      <div>
                        <p className="font-bold uppercase tracking-wider text-clay text-[11px] mb-2.5">
                          Handcrafted Candles Ordered
                        </p>
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {(Array.isArray(order.items) ? order.items : []).map((item, i) => (
                            <div key={i} className="flex items-center justify-between gap-2 border-b border-[#8a614810] pb-2 last:border-0 last:pb-0">
                              <div className="flex items-center gap-2.5 min-w-0">
                                {item.images && item.images[0] ? (
                                  <img
                                    src={item.images[0]}
                                    alt=""
                                    className="h-9 w-9 rounded-lg object-cover border border-[#8a614820] shrink-0"
                                  />
                                ) : (
                                  <div className="h-9 w-9 rounded-lg bg-[#ead1ad] flex items-center justify-center shrink-0">
                                    🕯️
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="font-semibold text-ink truncate">{item.name}</p>
                                  <p className="text-[11px] text-[#765442]">Qty: {item.quantity}</p>
                                </div>
                              </div>
                              <span className="font-semibold text-ink shrink-0">
                                ₹{Number(item.price || 0) * Number(item.quantity || 1)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Total Amount & WhatsApp Action */}
                      <div className="pt-3 mt-3 border-t border-[#8a614820] flex items-center justify-between">
                        <span className="font-bold text-sm text-[#765442]">Total Amount:</span>
                        <span className="display text-xl font-bold text-ink">₹{order.total}</span>
                      </div>
                    </div>
                  </div>

                  {/* Studio WhatsApp Contact for this Order */}
                  <div className="mt-5 pt-4 border-t border-[#8a614812] flex flex-col sm:flex-row items-center justify-between gap-3">
                    <p className="text-xs text-[#765442]">
                      Have a query about this order? Contact Candlemate Studio:
                    </p>
                    <a
                      href={whatsappHelpUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-2 text-xs font-bold text-white hover:bg-[#1faa4b] transition shadow-xs"
                    >
                      <span>Chat about {order.id} on WhatsApp ↗</span>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function TrackOrderPage() {
  return (
    <>
      <Header />
      <main className="grain min-h-[80vh]">
        <Suspense
          fallback={
            <div className="p-20 text-center text-[#765442]">
              <div className="inline-block animate-bounce mb-2 text-2xl">🕯️</div>
              <p>Loading order tracker...</p>
            </div>
          }
        >
          <TrackOrderContent />
        </Suspense>
      </main>
      <footer className="border-t border-[#5c39271a] bg-[#fffaf3] px-5 py-8 text-center text-xs text-[#765442]">
        <p>candlemate. · hand-poured with love · <Link href="/" className="underline hover:text-ink">home</Link> · <Link href="/#shop" className="underline hover:text-ink">shop candles</Link></p>
      </footer>
    </>
  );
}
