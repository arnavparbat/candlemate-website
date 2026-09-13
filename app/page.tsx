import { Header } from "@/components/header";
import { ProductCollection } from "@/components/product-collection";
import { Candle } from "@/components/candle";
import { getStore } from "@/lib/store";
import { isSupabaseConfigured, fetchProductsFromSupabase } from "@/lib/supabase";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  let products = getStore().products;

  if (isSupabaseConfigured()) {
    try {
      const cloudProducts = await fetchProductsFromSupabase();
      if (cloudProducts && Array.isArray(cloudProducts) && cloudProducts.length > 0) {
        products = cloudProducts;
      }
    } catch {}
  }

  return (
    <>
      <Header />
      <main>
        {/* Compact Hero Section: Takes only ~1/3 of the tab on mobile */}
        <section className="grain overflow-hidden border-b border-[#5c39271a]">
          <div className="mx-auto grid max-w-6xl items-center gap-3 px-4 py-3 sm:gap-12 sm:px-5 sm:py-14 grid-cols-[1.2fr_.8fr] md:grid-cols-[1.1fr_.9fr]">
            <div>
              <div className="mb-2 sm:mb-4 flex items-center gap-2">
                <img src="/logo-emblem.png" alt="Candlemate Emblem" className="h-6 w-auto sm:h-7 object-contain opacity-90" />
                <p className="text-[10px] sm:text-xs font-bold uppercase tracking-[.2em] text-clay">
                  Hand-poured in small batches
                </p>
              </div>
              <h1 className="display max-w-xl text-2xl sm:text-6xl sm:leading-[.92] leading-tight text-ink">
                Light a little <i className="font-normal text-clay">slower.</i>
              </h1>
              <p className="mt-1 sm:mt-7 max-w-md text-xs sm:text-base sm:leading-7 text-[#765442] hidden xs:block">
                Natural candles designed for evening rituals, unhurried conversations, and calm spaces.
              </p>
              <div className="mt-2.5 sm:mt-8 flex items-center gap-3 flex-wrap">
                <a
                  href="#shop"
                  className="inline-block rounded-full bg-ink px-3.5 py-1.5 sm:px-7 sm:py-3 text-xs sm:text-sm text-cream transition hover:bg-clay"
                >
                  Find your scent
                </a>
                <Link
                  href="/track"
                  className="sm:hidden inline-flex items-center gap-1 text-xs text-clay font-medium underline py-1"
                >
                  Track order →
                </Link>
              </div>
            </div>

            {/* Handcrafted Animated Candle Jar in Hero (Sleek and non-intrusive for mobile) */}
            <div className="relative mx-auto flex items-center justify-center w-full max-w-[150px] sm:max-w-[280px]">
              {/* Soft warm glow bloom behind jar */}
              <div className="absolute -inset-2 sm:-inset-6 rounded-full bg-[#f8af3c]/25 blur-lg sm:blur-2xl -z-10 pointer-events-none" />
              
              <div className="py-0.5 sm:py-2">
                <Candle stage="burning" compact={true} showBadge={false} />
              </div>
            </div>
          </div>
        </section>

        {/* Collection Section: Exactly 2 products per row on mobile */}
        <section id="shop" className="mx-auto max-w-6xl px-3 sm:px-5 py-5 sm:py-20">
          <div className="mb-3.5 sm:mb-9 flex items-end justify-between">
            <div>
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-[.2em] text-clay">The collection</p>
              <h2 className="display mt-0.5 text-xl sm:text-4xl text-ink">Pouring warm light</h2>
            </div>
            <p className="hidden max-w-xs text-right text-sm leading-6 text-[#765442] md:block">
              Clean-burning plant wax, quiet scents, and forms worth lingering over.
            </p>
          </div>

          <ProductCollection initialProducts={products} />
        </section>
      </main>
      <footer className="border-t border-[#5c39271a] bg-[#fffaf3] px-5 py-10 sm:py-12 text-center text-xs sm:text-sm text-[#765442]">
        <div className="mx-auto flex flex-col items-center justify-center gap-3.5 max-w-md">
          <img
            src="/logo.png"
            alt="Candlemate Logo"
            className="h-20 w-auto sm:h-24 object-contain drop-shadow-xs transition-transform hover:scale-105"
          />
          <img
            src="/logo-wordmark.png"
            alt="Candlemate"
            className="h-7 sm:h-9 w-auto object-contain mx-auto"
          />
          <p className="text-xs text-[#765442]/90 max-w-xs leading-relaxed">
            Natural candles designed for evening rituals, unhurried conversations, and calm spaces.
          </p>
          <div className="pt-3 border-t border-[#5c392715] w-full text-[11px] text-[#765442]/70 flex items-center justify-center gap-2">
            <span>© Candlemate</span>
            <span>·</span>
            <Link href="/track" className="underline hover:text-ink transition">
              track order
            </Link>
            <span>·</span>
            <a href="/admin" className="underline hover:text-ink transition">
              studio login
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}
