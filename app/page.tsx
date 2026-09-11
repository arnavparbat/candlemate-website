import { Header } from "@/components/header";
import { ProductCard } from "@/components/product-card";
import { Candle } from "@/components/candle";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default function Home() {
  const products = getStore().products;

  return (
    <>
      <Header />
      <main>
        {/* Compact Hero Section: Takes only ~1/3 of the tab on mobile */}
        <section className="grain overflow-hidden border-b border-[#5c39271a]">
          <div className="mx-auto grid max-w-6xl items-center gap-3 px-4 py-3 sm:gap-12 sm:px-5 sm:py-14 grid-cols-[1.2fr_.8fr] md:grid-cols-[1.1fr_.9fr]">
            <div>
              <p className="mb-1 sm:mb-4 text-[10px] sm:text-xs font-bold uppercase tracking-[.2em] text-clay">
                Hand-poured in small batches
              </p>
              <h1 className="display max-w-xl text-2xl sm:text-6xl sm:leading-[.92] leading-tight text-ink">
                Light a little <i className="font-normal text-clay">slower.</i>
              </h1>
              <p className="mt-1 sm:mt-7 max-w-md text-xs sm:text-base sm:leading-7 text-[#765442] hidden xs:block">
                Natural candles designed for evening rituals, unhurried conversations, and calm spaces.
              </p>
              <a
                href="#shop"
                className="mt-2.5 sm:mt-8 inline-block rounded-full bg-ink px-3.5 py-1.5 sm:px-7 sm:py-3 text-xs sm:text-sm text-cream transition hover:bg-clay"
              >
                Find your scent
              </a>
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

          <div className="grid grid-cols-2 gap-2.5 sm:gap-6 lg:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      </main>
      <footer className="border-t border-[#5c39271a] px-5 py-8 text-center text-xs sm:text-sm text-[#765442]">
        candlemate. made for slow moments · <a href="/admin" className="underline">studio login</a>
      </footer>
    </>
  );
}
