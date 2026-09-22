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

  const handleOpenCollections = () => {
    if (pathname === "/") {
      window.dispatchEvent(new CustomEvent("candlemate-open-collections"));
    } else {
      window.location.href = "/?openCollections=true#shop";
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[#5c39271a] bg-[#fff8ed]/95 backdrop-blur transition-all">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-3.5 sm:px-5 py-3 sm:py-4">
        {/* Left: Collection Button with 3 waving ocean lines + Candlemate Logo */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={handleOpenCollections}
            className="group flex items-center gap-1.5 sm:gap-2 rounded-full border border-[#8a614830] bg-[#fffaf3] sm:bg-transparent px-2.5 py-1.5 sm:px-3 sm:py-1.5 hover:bg-[#8a614815] hover:border-clay/50 text-ink transition text-xs sm:text-sm shrink-0 shadow-2xs sm:shadow-none active:scale-95 cursor-pointer"
            title="Browse candle collections"
            aria-label="Candle Collections"
          >
            <div className="relative w-[22px] h-[16px] flex items-center justify-center overflow-hidden">
              <svg
                viewBox="0 0 24 18"
                className="w-full h-full overflow-hidden text-ink group-hover:text-clay transition-colors"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path
                  d="M -12 3 Q -9 1.8, -6 3 T 0 3 T 6 3 T 12 3 T 18 3 T 24 3 T 30 3 T 36 3"
                  className="animate-ocean-wave-1"
                />
                <path
                  d="M -12 9 Q -9 7.8, -6 9 T 0 9 T 6 9 T 12 9 T 18 9 T 24 9 T 30 9 T 36 9"
                  className="animate-ocean-wave-2"
                />
                <path
                  d="M -12 15 Q -9 13.8, -6 15 T 0 15 T 6 15 T 12 15 T 18 15 T 24 15 T 30 15 T 36 15"
                  className="animate-ocean-wave-3"
                />
              </svg>
            </div>
            <span className="text-[11px] sm:text-xs font-semibold text-ink/90 group-hover:text-clay transition tracking-wide hidden xs:inline">
              Collections
            </span>
          </button>

          <Link href="/" className="flex items-center group shrink-0" title="Candlemate Home">
            <img
              src="/logo-wordmark.png"
              alt="Candlemate"
              className="h-5 sm:h-6 max-h-7 w-auto object-contain transition-opacity duration-300 group-hover:opacity-90"
            />
          </Link>
        </div>

        <nav className="flex items-center gap-2 sm:gap-6 text-sm shrink-0">
          <a href="/#shop" className="hidden md:block hover:text-clay transition font-medium">
            Shop candles
          </a>

          {/* Track order: Compact clickable pill with icon + "Track" visible clearly on mobile */}
          <Link
            href="/track"
            className="flex items-center justify-center gap-1 sm:gap-1.5 rounded-full border border-[#8a614830] bg-[#fffaf3] sm:bg-transparent px-2.5 py-1.5 sm:px-3 sm:py-1.5 hover:bg-[#8a614815] text-ink/90 hover:text-clay transition text-[11px] sm:text-sm shrink-0 shadow-2xs sm:shadow-none active:scale-95"
            title="Track your order status"
            aria-label="Track order"
          >
            <svg
              className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-clay shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
            <span className="font-semibold text-ink/90">Track</span>
          </Link>

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
