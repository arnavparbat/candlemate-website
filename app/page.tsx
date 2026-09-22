import { Header } from "@/components/header";
import { ProductCollection } from "@/components/product-collection";
import { HeroCandle } from "@/components/hero-candle";
import { getStore } from "@/lib/store";
import { isSupabaseConfigured, fetchProductsFromSupabase, fetchCategoriesFromSupabase } from "@/lib/supabase";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_CATEGORIES = [
  "Jar candle",
  "Sculptural",
  "Flower candle",
  "Wax melts",
  "Aromatherapy",
];

export default async function Home() {
  const store = getStore();
  let products = store.products || [];
  let categories =
    Array.isArray(store.categories) && store.categories.length > 0
      ? [...store.categories]
      : [...DEFAULT_CATEGORIES];

  if (isSupabaseConfigured()) {
    try {
      const [cloudProducts, cloudCategories] = await Promise.all([
        fetchProductsFromSupabase(),
        fetchCategoriesFromSupabase(),
      ]);
      if (cloudProducts && Array.isArray(cloudProducts)) {
        products = cloudProducts;
      }
      if (cloudCategories && Array.isArray(cloudCategories)) {
        categories = cloudCategories;
      }
    } catch {}
  }

  const uniqueCategories = Array.from(new Set(categories.map((c) => c.trim()).filter(Boolean)));

  return (
    <>
      <Header />
      <main>
        {/* Serene & Minimalist Hero Section: Perfectly aligned thought and living flame candle */}
        <section className="grain overflow-hidden border-b border-[#5c39271a] py-4 sm:py-12">
          <div className="mx-auto grid max-w-5xl items-center gap-3 px-4 sm:gap-8 sm:px-6 grid-cols-[1.15fr_.85fr] sm:grid-cols-2">
            <div className="flex flex-col justify-center pr-1 sm:pr-0">
              <h1 className="font-relaxing italic text-2xl xs:text-3xl sm:text-5xl md:text-6xl font-normal text-ink leading-[1.08] tracking-tight">
                Light a little{" "}
                <span className="text-clay not-italic font-medium">slower.</span>
              </h1>
            </div>

            {/* Candlemate Artisanal Candle with living flame and gentle wink */}
            <div className="flex items-center justify-center">
              <HeroCandle />
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

          <ProductCollection initialProducts={products} initialCategories={uniqueCategories} />
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
