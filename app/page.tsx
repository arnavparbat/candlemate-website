import { Header } from "@/components/header";
import { ProductCard } from "@/components/product-card";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default function Home() {
  const products = getStore().products;

  return (
    <>
      <Header />
      <main>
        <section className="grain overflow-hidden border-b border-[#5c39271a]">
          <div className="mx-auto grid min-h-[560px] max-w-6xl items-center gap-12 px-5 py-16 md:grid-cols-[1.1fr_.9fr]">
            <div>
              <p className="mb-5 text-xs font-bold uppercase tracking-[.24em] text-clay">
                Hand-poured in small batches
              </p>
              <h1 className="display max-w-xl text-6xl leading-[.92] sm:text-7xl">
                Light a little <i className="font-normal text-clay">slower.</i>
              </h1>
              <p className="mt-7 max-w-md leading-7 text-[#765442]">
                Natural candles designed for evening rituals, unhurried conversations, and homes that feel like you.
              </p>
              <a
                href="#shop"
                className="mt-9 inline-block rounded-full bg-ink px-7 py-3 text-sm text-cream transition hover:bg-clay"
              >
                Find your scent
              </a>
            </div>

            <div className="relative mx-auto w-full max-w-[360px] sm:max-w-[400px]">
              {/* Warm atmospheric glow behind the candle */}
              <div className="absolute -inset-4 rounded-[42px] bg-[#e7c498]/50 blur-2xl -z-10" />
              <div className="group relative overflow-hidden rounded-[36px] border border-[#5c39271f] bg-[#fff8ed] p-2 shadow-2xl shadow-[#b56b43]/25">
                <img
                  src="/hero-candle.jpg"
                  alt="Lit handmade soy candle with glowing flame"
                  className="h-[420px] w-full rounded-[28px] object-cover transition duration-700 ease-out group-hover:scale-105"
                />
              </div>
            </div>
          </div>
        </section>

        <section id="shop" className="mx-auto max-w-6xl px-5 py-20">
          <div className="mb-9 flex items-end justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.2em] text-clay">The collection</p>
              <h2 className="display mt-2 text-4xl">Pouring warm light</h2>
            </div>
            <p className="hidden max-w-xs text-right text-sm leading-6 text-[#765442] md:block">
              Clean-burning plant wax, quiet scents, and forms worth lingering over.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      </main>
      <footer className="border-t border-[#5c39271a] px-5 py-10 text-center text-sm text-[#765442]">
        candlemate. made for slow moments · <a href="/admin" className="underline">studio login</a>
      </footer>
    </>
  );
}
