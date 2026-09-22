"use client";

import { Header } from "@/components/header";
import { useCart } from "@/components/cart-context";
import { Product } from "@/lib/types";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import defaultStore from "@/data/store.json";

export default function ProductPage() {
  const params = useParams();
  const rawId = params?.id;
  const id = typeof rawId === "string" ? rawId : Array.isArray(rawId) ? rawId[0] : "";

  // Synchronous lookup from default store ensures instant 0ms render without blank screens
  const fallbackProduct =
    (defaultStore.products as Product[]).find((p) => p.id === id) || null;
  const [product, setProduct] = useState<Product | null>(fallbackProduct);
  const [photo, setPhoto] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const { add } = useCart();

  // Mobile Touch Swipe Gesture States
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchEndX, setTouchEndX] = useState<number | null>(null);
  const minSwipeDistance = 40; // minimum swipe distance in px

  useEffect(() => {
    if (!id) return;

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

  if (!product || !product.images) {
    return (
      <>
        <Header />
        <div className="p-16 sm:p-20 text-center text-[#765442]">
          <p className="text-base font-semibold">Finding your handcrafted candle…</p>
          <Link href="/" className="mt-4 inline-block text-xs font-bold text-clay underline">
            ← Back to collection
          </Link>
        </div>
      </>
    );
  }

  // Touch Swipe Gesture Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEndX(null);
    setTouchStartX(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEndX(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (touchStartX === null || touchEndX === null) return;
    const distance = touchStartX - touchEndX;

    if (product.images.length > 1) {
      if (distance > minSwipeDistance) {
        // Swiped Left -> Show next image
        setPhoto((p) => (p + 1) % product.images.length);
      } else if (distance < -minSwipeDistance) {
        // Swiped Right -> Show previous image
        setPhoto((p) => (p - 1 + product.images.length) % product.images.length);
      }
    }
    setTouchStartX(null);
    setTouchEndX(null);
  };

  const nextPhoto = () => {
    if (product.images.length > 1) {
      setPhoto((p) => (p + 1) % product.images.length);
    }
  };

  const prevPhoto = () => {
    if (product.images.length > 1) {
      setPhoto((p) => (p - 1 + product.images.length) % product.images.length);
    }
  };

  const handleAdd = () => {
    if (!product || !product.available) return;
    for (let i = 0; i < quantity; i++) {
      add(product);
    }
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 2400);
  };

  // Active Specifications List
  const activeSpecs = [
    product.fragrance ? { label: "Scent", value: product.fragrance, icon: "🌸" } : null,
    product.burnTime ? { label: "Burn Time", value: product.burnTime, icon: "⏳" } : null,
    product.wickSize ? { label: "Wick", value: product.wickSize, icon: "🕯️" } : null,
    product.candleDimensions ? { label: "Dimensions", value: product.candleDimensions, icon: "📏" } : null,
    product.ingredients ? { label: "Wax", value: product.ingredients, icon: "🌿" } : null,
  ].filter(Boolean) as { label: string; value: string; icon: string }[];

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-3.5 sm:px-6 py-3.5 sm:py-8">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between gap-2 mb-3 sm:mb-5">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#765442] hover:text-ink transition active:scale-95 py-1"
          >
            <span>←</span>
            <span>Back to collection</span>
          </Link>
          {product.category && (
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-clay bg-[#8a614815] px-2.5 py-0.5 rounded-full">
              {product.category}
            </span>
          )}
        </div>

        {/* ==================================================== */}
        {/* PRODUCT CONTAINER                                    */}
        {/* Mobile: Big visual candle photo with touch swiping   */}
        {/* Desktop: 2-column balanced showcase                  */}
        {/* ==================================================== */}
        <div className="grid gap-4 sm:gap-6 md:grid-cols-2 md:gap-10 items-start">
          {/* ==================================================== */}
          {/* 1. BIG CANDLE IMAGE WITH TOUCH SWIPE GESTURES        */}
          {/* ==================================================== */}
          <div className="w-full max-w-sm sm:max-w-md md:max-w-none mx-auto space-y-2.5">
            <div
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className="relative aspect-square sm:aspect-[4/5] w-full overflow-hidden rounded-3xl bg-[#ead1ad] shadow-md border border-[#5c392718] select-none cursor-grab active:cursor-grabbing"
            >
              <img
                src={product.images[photo]}
                alt={product.name}
                className="h-full w-full object-cover transition-opacity duration-300 pointer-events-none"
                draggable={false}
              />

              {/* Sold out overlay badge */}
              {!product.available && (
                <span className="absolute top-3 left-3 rounded-full bg-ink/90 backdrop-blur-xs px-3 py-1 text-[10px] font-bold text-white uppercase tracking-wider shadow-sm">
                  Sold out
                </span>
              )}

              {/* Photo counter & Mobile Swipe Hint Badge */}
              {product.images.length > 1 && (
                <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-black/50 backdrop-blur-xs text-white px-2.5 py-1 text-[10px] font-mono font-bold shadow-xs">
                  <span>{photo + 1}/{product.images.length}</span>
                  <span className="hidden xs:inline opacity-80">· 👈 Swipe 👉</span>
                </div>
              )}

              {/* Arrow navigation buttons for easy tapping */}
              {product.images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      prevPhoto();
                    }}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-xs text-base font-bold active:scale-90 transition shadow-sm cursor-pointer"
                    aria-label="Previous photo"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      nextPhoto();
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-xs text-base font-bold active:scale-90 transition shadow-sm cursor-pointer"
                    aria-label="Next photo"
                  >
                    ›
                  </button>
                </>
              )}

              {/* Bottom Dot Indicators */}
              {product.images.length > 1 && (
                <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
                  {product.images.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setPhoto(i)}
                      className={`h-1.5 rounded-full transition-all cursor-pointer ${
                        i === photo ? "w-5 bg-white shadow-xs" : "w-1.5 bg-white/60 hover:bg-white/90"
                      }`}
                      aria-label={`View photo ${i + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Thumbnails Gallery Strip */}
            {product.images.length > 1 && (
              <div className="flex items-center justify-center sm:justify-start gap-2 overflow-x-auto pb-1 no-scrollbar">
                {product.images.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setPhoto(idx)}
                    className={`h-12 w-12 sm:h-14 sm:w-14 rounded-2xl overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${
                      idx === photo
                        ? "border-clay shadow-sm scale-105"
                        : "border-transparent opacity-60 hover:opacity-100"
                    }`}
                  >
                    <img src={img} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ==================================================== */}
          {/* 2. PRODUCT DETAILS & ACTION SECTION                  */}
          {/* ==================================================== */}
          <div className="space-y-3.5 sm:space-y-5">
            {/* Header: Title, Category, Price & Live Stock */}
            <div className="space-y-1 sm:space-y-2">
              <div className="flex items-center justify-between gap-2">
                {product.category ? (
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[.18em] text-clay bg-[#8a614815] px-2.5 py-0.5 rounded-full">
                    {product.category}
                  </span>
                ) : <span />}

                {/* Stock Indicator */}
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      product.available ? "bg-emerald-500 animate-pulse" : "bg-stone-400"
                    }`}
                  />
                  <span className={product.available ? "text-emerald-800" : "text-stone-500"}>
                    {product.available ? "In stock" : "Sold out"}
                  </span>
                </span>
              </div>

              <h1 className="display text-xl sm:text-3xl md:text-4xl font-bold text-ink leading-snug tracking-tight">
                {product.name}
              </h1>

              <div className="flex items-baseline gap-2 pt-0.5">
                <span className="text-2xl sm:text-3xl font-black text-clay">
                  ₹{product.price}
                </span>
                <span className="text-xs text-[#765442]/80 font-medium">
                  natural soy wax · incl. taxes
                </span>
              </div>
            </div>

            {/* ACTION ROW: Quantity Selector + High Visibility "+ Add to Bag" */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-2.5">
                {product.available && (
                  <div className="inline-flex items-center rounded-2xl border border-[#8a614830] bg-white p-1 shadow-2xs shrink-0">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      disabled={quantity <= 1}
                      className="h-8 w-8 flex items-center justify-center rounded-xl text-sm font-bold text-[#765442] hover:bg-stone-100 disabled:opacity-30 cursor-pointer active:scale-95"
                    >
                      –
                    </button>
                    <span className="w-8 text-center font-mono font-bold text-sm text-ink">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.min(10, q + 1))}
                      className="h-8 w-8 flex items-center justify-center rounded-xl text-sm font-bold text-[#765442] hover:bg-stone-100 cursor-pointer active:scale-95"
                    >
                      +
                    </button>
                  </div>
                )}

                {/* Main Add to Bag Button */}
                <button
                  type="button"
                  disabled={!product.available}
                  onClick={handleAdd}
                  className={`flex-1 rounded-2xl py-3 px-5 text-sm font-bold transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-2 ${
                    !product.available
                      ? "cursor-not-allowed bg-stone-300 text-stone-600"
                      : justAdded
                      ? "bg-emerald-700 text-white scale-[1.01] ring-4 ring-emerald-600/30 shadow-lg"
                      : "bg-ink hover:bg-clay text-cream hover:shadow-lg"
                  }`}
                >
                  <span>
                    {!product.available
                      ? "Sold out"
                      : justAdded
                      ? "✓ Added to bag!"
                      : "+ Add to bag"}
                  </span>
                  {product.available && !justAdded && (
                    <span className="opacity-90 font-mono text-xs">
                      · ₹{product.price * quantity}
                    </span>
                  )}
                </button>
              </div>

              {/* Added to Bag Confirmation Toast */}
              {justAdded && (
                <div className="flex items-center justify-between gap-2 rounded-2xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900 shadow-sm animate-in fade-in">
                  <div className="flex items-center gap-1.5">
                    <span>✓</span>
                    <span className="font-semibold">
                      <b>{quantity}× {product.name}</b> in your bag
                    </span>
                  </div>
                  <Link
                    href="/cart"
                    className="font-bold underline text-clay hover:text-ink shrink-0 active:scale-95 transition"
                  >
                    View Bag & Checkout →
                  </Link>
                </div>
              )}
            </div>

            {/* ==================================================== */}
            {/* COMPACT DESCRIPTION (Fitted neatly without bloat)    */}
            {/* ==================================================== */}
            {product.description && (
              <div className="rounded-2xl bg-white/80 border border-[#5c392715] p-3.5 text-xs sm:text-sm leading-relaxed text-ink/90 font-serif shadow-2xs space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#765442] block font-sans">
                  Maker&apos;s Scent Notes
                </span>
                <p className="line-clamp-3 sm:line-clamp-none">
                  {product.description}
                </p>
              </div>
            )}

            {/* ==================================================== */}
            {/* COMPACT SPECIFICATIONS PILLS (Micro-badges)          */}
            {/* ==================================================== */}
            {activeSpecs.length > 0 && (
              <div className="space-y-1.5 pt-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#765442] block">
                  Specifications
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {activeSpecs.map((spec, idx) => (
                    <div
                      key={idx}
                      className="inline-flex items-center gap-1 rounded-xl bg-[#fffaf3] border border-[#8a614820] px-2.5 py-1 text-[11px] font-semibold text-ink shadow-2xs"
                    >
                      <span>{spec.icon}</span>
                      <span className="text-[#765442]">{spec.label}:</span>
                      <span className="font-bold text-ink">{spec.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Studio Assurance Badge */}
            <div className="flex items-center justify-between text-[10px] sm:text-xs text-[#765442] pt-2 border-t border-[#8a614815]">
              <span className="flex items-center gap-1 font-medium">
                <span>🌿</span> 100% Plant Soy Wax
              </span>
              <span className="flex items-center gap-1 font-medium">
                <span>🕯️</span> Hand-Poured Batches
              </span>
              <span className="flex items-center gap-1 font-medium">
                <span>📦</span> Protected Transit
              </span>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
