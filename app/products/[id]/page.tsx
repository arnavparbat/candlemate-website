"use client";

import { Header } from "@/components/header";
import { useCart } from "@/components/cart-context";
import { Product } from "@/lib/types";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import defaultStore from "@/data/store.json";

export default function ProductPage() {
  const params = useParams();
  const rawId = params?.id;
  const id = typeof rawId === "string" ? rawId : Array.isArray(rawId) ? rawId[0] : "";

  // Synchronous lookup from default store ensures instant 0ms render without blank screens or API crashes
  const fallbackProduct =
    (defaultStore.products as Product[]).find((p) => p.id === id) || null;
  const [product, setProduct] = useState<Product | null>(fallbackProduct);
  const [photo, setPhoto] = useState(0);
  const [justAdded, setJustAdded] = useState(false);
  const { add } = useCart();

  useEffect(() => {
    if (!id) return;

    // If not found in fallback, try defaultStore again once id is available
    const local = (defaultStore.products as Product[]).find((p) => p.id === id);
    if (local && !product) {
      setProduct(local);
    }

    // Also fetch fresh details from API if product was updated in admin
    fetch(`/api/products/${encodeURIComponent(id)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data && data.id && Array.isArray(data.images) && data.images.length > 0) {
          setProduct(data);
        } else if (local) {
          setProduct(local);
        }
      })
      .catch((err) => {
        console.warn("[ProductPage] Could not fetch product API, using local store:", err);
        if (local) setProduct(local);
      });
  }, [id]);

  useEffect(() => {
    if (!product || !product.images || product.images.length < 2) return;
    const t = setInterval(() => setPhoto((p) => (p + 1) % product.images.length), 3000);
    return () => clearInterval(t);
  }, [product]);

  if (!product || !product.images)
    return (
      <>
        <Header />
        <div className="p-20 text-center text-[#765442]">
          <p className="text-base font-semibold">Finding your candle…</p>
          <Link href="/" className="mt-4 inline-block text-xs font-bold text-clay underline">
            ← Back to collection
          </Link>
        </div>
      </>
    );

  const handleAdd = () => {
    if (!product || !product.available) return;
    add(product);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 2200);
  };

  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-5 py-10">
        <Link href="/" className="text-sm text-clay hover:text-ink transition font-medium">
          ← Back to collection
        </Link>
        <div className="mt-6 grid gap-10 md:grid-cols-2">
          <div className="relative aspect-square overflow-hidden rounded-[32px] bg-[#ead1ad] shadow-sm">
            <img
              src={product.images[photo]}
              alt={product.name}
              className="h-full w-full object-cover"
            />
            <div className="absolute bottom-5 left-0 right-0 flex justify-center gap-2">
              {product.images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPhoto(i)}
                  className={`h-2 rounded-full transition-all ${
                    i === photo ? "w-6 bg-white" : "w-2 bg-white/60"
                  }`}
                />
              ))}
            </div>
          </div>
          <div className="py-4">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-clay">
              {product.category}
            </p>
            <h1 className="display mt-3 text-5xl">{product.name}</h1>
            <p className="mt-5 text-2xl font-semibold text-clay">₹{product.price}</p>
            <p className="mt-7 max-w-lg leading-7 text-[#765442]">{product.description}</p>
            <dl className="my-8 grid grid-cols-2 gap-5 border-y border-[#5c39271a] py-6 text-sm">
              <div>
                <dt className="text-[#765442]">Burn time</dt>
                <dd className="mt-1 font-medium text-ink">{product.burnTime}</dd>
              </div>
              <div>
                <dt className="text-[#765442]">Made with</dt>
                <dd className="mt-1 font-medium text-ink">{product.ingredients}</dd>
              </div>
            </dl>
            <button
              type="button"
              disabled={!product.available}
              onClick={handleAdd}
              className={`w-full rounded-full px-6 py-4 text-sm font-semibold transition-all duration-300 shadow-md cursor-pointer ${
                !product.available
                  ? "cursor-not-allowed bg-stone-300 text-stone-600"
                  : justAdded
                  ? "bg-emerald-700 text-white scale-[1.02] ring-4 ring-emerald-700/30 shadow-lg"
                  : "bg-ink text-cream hover:bg-clay hover:scale-[1.01]"
              }`}
            >
              {!product.available
                ? "Currently sold out"
                : justAdded
                ? "✓ Added to bag!"
                : "Add to bag"}
            </button>

            {justAdded && (
              <div className="mt-3 flex items-center justify-between rounded-2xl bg-emerald-50 p-3.5 text-xs text-emerald-800 border border-emerald-200 animate-in fade-in">
                <span className="font-medium">✓ Candle added to your bag!</span>
                <Link
                  href="/cart"
                  className="font-bold underline text-emerald-900 hover:text-ink transition"
                >
                  View Bag & Checkout →
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}

