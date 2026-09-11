"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCart } from "./cart-context";

export function Header() {
  const { items, lastAdded } = useCart();
  const count = items.reduce((s, i) => s + i.quantity, 0);
  const [isVibrating, setIsVibrating] = useState(false);
  const [toast, setToast] = useState<{ name: string; id: number } | null>(null);

  // Trigger vibration, highlight ring, and toast whenever a product is added
  useEffect(() => {
    if (!lastAdded) return;
    setIsVibrating(true);
    setToast({ name: lastAdded.product.name, id: lastAdded.time });

    const vibrateTimer = setTimeout(() => setIsVibrating(false), 1200);
    const toastTimer = setTimeout(() => setToast(null), 3500);

    return () => {
      clearTimeout(vibrateTimer);
      clearTimeout(toastTimer);
    };
  }, [lastAdded]);

  return (
    <header className="sticky top-0 z-40 border-b border-[#5c39271a] bg-[#fff8ed]/95 backdrop-blur transition-all">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 sm:py-4">
        <Link href="/" className="display text-2xl font-bold tracking-tight">
          candlemate<span className="text-gold">.</span>
        </Link>

        <nav className="flex items-center gap-4 sm:gap-6 text-sm">
          <a href="/#shop" className="hidden sm:block hover:text-clay transition font-medium">
            Shop candles
          </a>

          {/* Bag button with vibration animation, count badge, and floating notification */}
          <div className="relative">
            {/* Floating "+1 Added" badge animation */}
            {isVibrating && (
              <span className="animate-float-badge pointer-events-none absolute -top-5 right-2 z-50 flex items-center gap-0.5 rounded-full bg-[#a66a46] px-2 py-0.5 text-[11px] font-bold text-white shadow-md">
                <span>+1</span>
                <span>✨</span>
              </span>
            )}

            <Link
              href="/cart"
              className={`relative flex items-center gap-2 rounded-full px-4 py-2 font-medium transition-all duration-300 shadow-xs ${
                isVibrating
                  ? "animate-bag-vibrate bg-[#a66a46] text-white ring-4 ring-[#a66a46]/50 scale-105 shadow-lg shadow-[#a66a46]/30"
                  : count > 0
                  ? "bg-ink text-white hover:bg-clay"
                  : "bg-ink/90 text-white hover:bg-ink"
              }`}
              title="View your shopping bag"
            >
              {/* Shopping Bag SVG Icon */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`h-4 w-4 transition-transform ${isVibrating ? "scale-110" : ""}`}
              >
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                <path d="M3 6h18" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>

              <span>Bag</span>

              {count > 0 && (
                <span
                  className={`flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-bold transition-all ${
                    isVibrating ? "bg-white text-[#a66a46] scale-110" : "bg-[#dfb15b] text-ink"
                  }`}
                >
                  {count}
                </span>
              )}
            </Link>
          </div>
        </nav>
      </div>

      {/* Floating alert banner below header when item is added */}
      {toast && (
        <div className="absolute left-0 right-0 top-full flex justify-center px-4 pt-2 pointer-events-none">
          <Link
            href="/cart"
            className="pointer-events-auto flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-xs text-white shadow-xl ring-2 ring-clay/40 transition hover:bg-clay hover:scale-[1.02]"
          >
            <span>🕯️</span>
            <span>
              Added <b>{toast.name}</b> to bag!
            </span>
            <span className="ml-1 text-gold underline font-semibold">View Bag →</span>
          </Link>
        </div>
      )}
    </header>
  );
}
