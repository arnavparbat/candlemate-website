"use client";

import { Header } from "@/components/header";
import { useCart } from "@/components/cart-context";
import { Candle } from "@/components/candle";
import Link from "next/link";

export default function Cart() {
  const { items, total, update, remove } = useCart();

  return (
    <>
      <Header />
      <main className="relative mx-auto min-h-[70vh] max-w-5xl px-5 py-8 sm:py-12">
        <h1 className="display text-4xl sm:text-5xl text-ink">Your candle bag</h1>

        {!items.length ? (
          <div className="mt-10 paper max-w-lg rounded-3xl p-8 shadow-sm flex flex-col items-center text-center mx-auto sm:mx-0">
            <div className="mb-4">
              <Candle stage="empty" compact={true} />
            </div>
            <p className="text-[#765442]">Your bag is waiting for a little glow.</p>
            <Link
              href="/"
              className="mt-5 inline-block rounded-full bg-ink px-6 py-3 text-sm text-white hover:bg-clay transition"
            >
              Browse candles
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-8 md:grid-cols-[1fr_320px] items-start">
            <div className="space-y-4">
              {items.map((item) => (
                <div key={item.id} className="paper flex gap-4 rounded-2xl p-4 shadow-sm">
                  <img
                    className="h-24 w-20 rounded-xl object-cover border border-[#8a61481a]"
                    src={item.images?.[0] || "/hero-candle.jpg"}
                    alt={item.name}
                  />
                  <div className="flex-1">
                    <div className="flex justify-between gap-2">
                      <h2 className="display text-xl text-ink">{item.name}</h2>
                      <b className="text-clay">₹{item.price * item.quantity}</b>
                    </div>
                    <div className="mt-4 flex items-center gap-3 text-sm">
                      <button
                        className="rounded-full border border-[#8a61483a] px-2.5 py-0.5 hover:bg-clay hover:text-white transition"
                        onClick={() => update(item.id, item.quantity - 1)}
                      >
                        −
                      </button>
                      <span className="font-medium text-ink">{item.quantity}</span>
                      <button
                        className="rounded-full border border-[#8a61483a] px-2.5 py-0.5 hover:bg-clay hover:text-white transition"
                        onClick={() => update(item.id, item.quantity + 1)}
                      >
                        +
                      </button>
                      <button
                        className="ml-auto text-xs text-[#9e4d39] hover:underline"
                        onClick={() => remove(item.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Sidebar Summary with Contained Animated Candle */}
            <aside className="paper h-fit rounded-3xl p-6 shadow-sm flex flex-col items-center">
              <div className="mb-3">
                <Candle stage="filled" compact={true} />
              </div>
              <div className="w-full pt-3 border-t border-[#8a61481a]">
                <p className="text-sm text-[#765442]">Subtotal</p>
                <p className="display mt-1 text-4xl text-ink">₹{total}</p>
                <p className="mt-2 text-xs text-[#765442]">Shipping is confirmed with your order.</p>
                <Link
                  href="/checkout"
                  className="mt-6 block rounded-full bg-ink px-5 py-3.5 text-center text-sm font-medium text-white hover:bg-clay transition shadow-sm"
                >
                  Continue to checkout →
                </Link>
              </div>
            </aside>
          </div>
        )}
      </main>
    </>
  );
}
