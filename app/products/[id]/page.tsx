"use client";

import { Header } from "@/components/header";
import { useCart } from "@/components/cart-context";
import { Product } from "@/lib/types";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [photo, setPhoto] = useState(0);
  const [justAdded, setJustAdded] = useState(false);
  const { add } = useCart();

  useEffect(() => {
    fetch(`/api/products/${id}`)
      .then((r) => r.json())
      .then(setProduct);
  }, [id]);

  useEffect(() => {
    if (!product || product.images.length < 2) return;
    const t = setInterval(() => setPhoto((p) => (p + 1) % product.images.length), 3000);
    return () => clearInterval(t);
  }, [product]);

  if (!product)
    return (
      <>
        <Header />
        <div className="p-20 text-center text-[#765442]">Finding your candle…</div>
      </>
    );

  const handleAdd = () => {
    add(product);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 2000);
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
              disabled={!product.available}
              onClick={handleAdd}
              className={`w-full rounded-full px-6 py-4 text-sm font-semibold transition-all duration-300 shadow-md ${
                !product.available
                  ? "cursor-not-allowed bg-stone-300 text-stone-600"
                  : justAdded
                  ? "bg-[#a66a46] text-white scale-[1.02] ring-4 ring-[#a66a46]/30 shadow-lg"
                  : "bg-ink text-cream hover:bg-clay hover:scale-[1.01]"
              }`}
            >
              {!product.available
                ? "Currently sold out"
                : justAdded
                ? "Added to bag"
                : "Add to bag"}
            </button>
          </div>
        </div>
      </main>
    </>
  );
}

