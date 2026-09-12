"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useCart } from "./cart-context";

export function Header() {
  const { items } = useCart();
  const pathname = usePathname();
  const count = items.reduce((s, i) => s + i.quantity, 0);
  const [isVibrating, setIsVibrating] = useState(false);

  // Trigger shake animation ONLY when a product is explicitly added to the bag
  useEffect(() => {
    // Never shake when on the cart or checkout page
    if (pathname === "/cart" || pathname === "/checkout") return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const handleItemAdded = () => {
      setIsVibrating(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setIsVibrating(false), 900);
    };

    window.addEventListener("candlemate-item-added", handleItemAdded);
    return () => {
      window.removeEventListener("candlemate-item-added", handleItemAdded);
      if (timer) clearTimeout(timer);
    };
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-[#5c39271a] bg-[#fff8ed]/95 backdrop-blur transition-all">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 sm:py-4">
        <Link href="/" className="flex items-center gap-2.5 sm:gap-3.5 group">
          <img
            src="/logo.png"
            alt="Candlemate Logo"
            className="h-12 w-auto sm:h-15 max-h-[58px] object-contain transition-transform duration-300 group-hover:scale-105"
          />
          <img
            src="/logo-wordmark.png"
            alt="Candlemate"
            className="h-6 sm:h-8 w-auto object-contain transition-opacity duration-300 group-hover:opacity-90"
          />
        </Link>

        <nav className="flex items-center gap-4 sm:gap-6 text-sm">
          <a href="/#shop" className="hidden sm:block hover:text-clay transition font-medium">
            Shop candles
          </a>

          {/* Bag button with shake / vibration animation */}
          <div className="relative">
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
    </header>
  );
}
