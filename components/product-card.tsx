"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Product } from "@/lib/types";
import { useCart } from "./cart-context";

export function ProductCard({ product }: { product: Product }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const { add } = useCart();

  useEffect(() => {
    if (paused || !product.images || product.images.length < 2) return;
    const timer = setInterval(
      () => setIndex((i) => (i + 1) % product.images.length),
      2700
    );
    return () => clearInterval(timer);
  }, [paused, product.images]);

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!product || !product.available) return;
    add(product);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1800);
  };

  return (
    <Link
      href={`/products/${product.id}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="group flex flex-col justify-between overflow-hidden rounded-2xl sm:rounded-[26px] bg-white/80 border border-[#5c392712] shadow-sm hover:shadow-md transition duration-300"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-[#e8d0ae]">
        <img
          src={product.images?.[index] || "/hero-candle.jpg"}
          alt={product.name}
          className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
        />
        {product.images && product.images.length > 1 && (
          <div className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 flex gap-1">
            {product.images.map((_, i) => (
              <span
                key={i}
                className={`h-1 sm:h-1.5 rounded-full transition-all ${
                  i === index ? "w-3 sm:w-5 bg-white" : "w-1 sm:w-1.5 bg-white/60"
                }`}
              />
            ))}
          </div>
        )}
        {!product.available && (
          <span className="absolute right-2 top-2 sm:right-3 sm:top-3 rounded-full bg-ink px-2 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-xs text-white">
            Sold out
          </span>
        )}
      </div>

      <div className="p-2.5 sm:p-5 flex flex-col flex-1 justify-between">
        <div>
          <div className="flex items-baseline justify-between gap-1 sm:gap-3">
            <h3 className="display text-sm sm:text-xl truncate font-bold text-ink" title={product.name}>
              {product.name}
            </h3>
            <span className="shrink-0 text-xs sm:text-base font-bold text-clay">
              ₹{product.price}
            </span>
          </div>
          <p className="mt-0.5 line-clamp-1 sm:line-clamp-2 text-[11px] sm:text-sm leading-snug sm:leading-6 text-[#765442]">
            {product.description || product.fragrance || (product.candleDimensions ? `Dimensions: ${product.candleDimensions}` : "") || "Handcrafted artisanal candle"}
          </p>
        </div>

        <div className="mt-3 pt-2.5 border-t border-[#8a614812] flex items-center justify-between gap-1.5">
          {product.category ? (
            <span className="text-[9px] sm:text-[11px] font-bold uppercase tracking-[.14em] text-moss truncate">
              {product.category}
            </span>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={handleQuickAdd}
            disabled={!product.available}
            className={`inline-flex items-center justify-center gap-1 rounded-full px-2.5 py-1 sm:px-3.5 sm:py-1.5 text-[11px] sm:text-xs font-semibold transition-all shadow-2xs shrink-0 cursor-pointer ${
              !product.available
                ? "bg-stone-200 text-stone-500 cursor-not-allowed"
                : justAdded
                ? "bg-emerald-700 text-white scale-105 shadow-md"
                : "bg-ink text-cream hover:bg-clay active:scale-95"
            }`}
            title={product.available ? "Add to bag" : "Sold out"}
          >
            {justAdded ? "✓ Added" : !product.available ? "Sold out" : "+ Add to bag"}
          </button>
        </div>
      </div>
    </Link>
  );
}
