"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Product } from "@/lib/types";

export function ProductCard({ product }: { product: Product }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || !product.images || product.images.length < 2) return;
    const timer = setInterval(
      () => setIndex((i) => (i + 1) % product.images.length),
      2700
    );
    return () => clearInterval(timer);
  }, [paused, product.images]);

  return (
    <Link
      href={`/products/${product.id}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="group block overflow-hidden rounded-2xl sm:rounded-[26px] bg-white/80 border border-[#5c392712] shadow-sm hover:shadow-md transition duration-300"
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
      <div className="p-2.5 sm:p-5">
        <div className="flex items-baseline justify-between gap-1 sm:gap-3">
          <h3 className="display text-sm sm:text-xl truncate" title={product.name}>
            {product.name}
          </h3>
          <span className="shrink-0 text-xs sm:text-base font-semibold text-clay">
            ₹{product.price}
          </span>
        </div>
        <p className="mt-0.5 line-clamp-1 sm:line-clamp-2 text-[11px] sm:text-sm leading-snug sm:leading-6 text-[#765442]">
          {product.description}
        </p>
        <p className="mt-1.5 sm:mt-3 text-[9px] sm:text-[11px] font-bold uppercase tracking-[.14em] text-moss">
          {product.category}
        </p>
      </div>
    </Link>
  );
}
