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

  // Synchronous lookup from default store ensures instant 0ms render without blank screens
  const fallbackProduct =
    (defaultStore.products as Product[]).find((p) => p.id === id) || null;
  const [product, setProduct] = useState<Product | null>(fallbackProduct);
  const [photo, setPhoto] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const { add } = useCart();

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

  useEffect(() => {
    if (!product || !product.images || product.images.length < 2) return;
    const t = setInterval(() => setPhoto((p) => (p + 1) % product.images.length), 3500);
    return () => clearInterval(t);
  }, [product]);

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
    product.fragrance ? { label: "Fragrance Notes", value: product.fragrance, icon: "🌸" } : null,
    product.wickSize ? { label: "Wick Size", value: product.wickSize, icon: "🕯️" } : null,
    product.candleDimensions ? { label: "Dimensions (L × B)", value: product.candleDimensions, icon: "📏" } : null,
    product.burnTime ? { label: "Burn Time", value: product.burnTime, icon: "⏳" } : null,
    product.ingredients ? { label: "Wax & Ingredients", value: product.ingredients, icon: "🌿" } : null,
  ].filter(Boolean) as { label: string; value: string; icon: string }[];

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-3.5 sm:px-6 py-4 sm:py-8">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between gap-2 mb-3 sm:mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#765442] hover:text-ink transition active:scale-95 py-1"
          >
            <span>←</span>
            <span>Back to collection</span>
          </Link>
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-clay bg-[#8a614815] px-2.5 py-0.5 rounded-full">
            {product.category}
          </span>
        </div>

        {/* ==================================================== */}
        {/* MOBILE & DESKTOP PRODUCT HERO SECTION                */}
        {/* On mobile: compact image on left, buy section on right*/}
        {/* On desktop: balanced 2-column showcase               */}
        {/* ==================================================== */}
        <div className="grid grid-cols-[145px_1fr] xs:grid-cols-[165px_1fr] md:grid-cols-2 gap-3 sm:gap-6 md:gap-10 items-start">
          {/* LEFT: Compact Responsive Image Showcase */}
          <div className="space-y-2">
            <div className="relative aspect-square md:aspect-[4/5] max-h-[320px] md:max-h-[460px] w-full overflow-hidden rounded-2xl sm:rounded-3xl bg-[#ead1ad] shadow-sm border border-[#5c392715]">
              <img
                src={product.images[photo]}
                alt={product.name}
                className="h-full w-full object-cover transition duration-500"
              />

              {/* Sold out badge overlay */}
              {!product.available && (
                <span className="absolute top-2 left-2 sm:top-3 sm:left-3 rounded-full bg-ink/90 backdrop-blur-xs px-2.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                  Sold out
                </span>
              )}

              {/* Photo indicators for multi-images */}
              {product.images.length > 1 && (
                <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5 sm:gap-2">
                  {product.images.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setPhoto(i)}
                      className={`h-1.5 rounded-full transition-all ${
                        i === photo ? "w-4 sm:w-6 bg-white shadow-xs" : "w-1.5 bg-white/60"
                      }`}
                      aria-label={`View photo ${i + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Thumbnail selector gallery (shown on desktop or when multiple photos) */}
            {product.images.length > 1 && (
              <div className="hidden sm:flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                {product.images.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setPhoto(idx)}
                    className={`h-12 w-12 rounded-xl overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${
                      idx === photo
                        ? "border-clay shadow-xs scale-105"
                        : "border-transparent opacity-70 hover:opacity-100"
                    }`}
                  >
                    <img src={img} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT: Product Info & Immediate "Add to Bag" on Right of Image */}
          <div className="flex flex-col justify-between min-w-0">
            <div>
              {/* Category pill (Mobile & Desktop) */}
              <span className="hidden md:inline-block text-[11px] font-bold uppercase tracking-[.18em] text-clay bg-[#8a614815] px-2.5 py-0.5 rounded-full mb-2">
                {product.category}
              </span>

              {/* Title */}
              <h1 className="display text-base xs:text-lg sm:text-2xl md:text-4xl font-bold text-ink leading-tight tracking-tight">
                {product.name}
              </h1>

              {/* Price & Stock status */}
              <div className="mt-1.5 sm:mt-3 flex items-baseline gap-2 flex-wrap">
                <span className="text-lg xs:text-xl sm:text-2xl md:text-3xl font-black text-clay">
                  ₹{product.price}
                </span>
                <span className="text-[10px] sm:text-xs font-semibold text-[#765442]/80">
                  incl. all taxes
                </span>
              </div>

              {/* Live stock badge */}
              <div className="mt-1 sm:mt-2 flex items-center gap-1.5 text-[11px] sm:text-xs">
                <span
                  className={`h-2 w-2 rounded-full ${
                    product.available ? "bg-emerald-500 animate-pulse" : "bg-stone-400"
                  }`}
                />
                <span className={product.available ? "text-emerald-800 font-semibold" : "text-stone-500 font-medium"}>
                  {product.available ? "In stock · Ready to dispatch" : "Currently out of stock"}
                </span>
              </div>
            </div>

            {/* ACTION SECTION: Quantity Selector & "Add to Bag" button right on the right of image */}
            <div className="mt-3 sm:mt-5 space-y-2">
              {product.available && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#765442] hidden xs:inline">
                    Qty:
                  </span>
                  <div className="inline-flex items-center rounded-xl border border-[#8a614830] bg-white p-0.5 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      disabled={quantity <= 1}
                      className="h-7 w-7 flex items-center justify-center rounded-lg text-xs font-bold text-[#765442] hover:bg-stone-100 disabled:opacity-30 cursor-pointer active:scale-95"
                    >
                      –
                    </button>
                    <span className="w-7 text-center font-mono font-bold text-xs text-ink">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.min(10, q + 1))}
                      className="h-7 w-7 flex items-center justify-center rounded-lg text-xs font-bold text-[#765442] hover:bg-stone-100 cursor-pointer active:scale-95"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}

              {/* Direct Add to Bag Button */}
              <button
                type="button"
                disabled={!product.available}
                onClick={handleAdd}
                className={`w-full rounded-2xl py-2.5 sm:py-3.5 px-4 text-xs sm:text-sm font-bold transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 ${
                  !product.available
                    ? "cursor-not-allowed bg-stone-300 text-stone-600"
                    : justAdded
                    ? "bg-emerald-700 text-white scale-[1.02] ring-4 ring-emerald-600/30 shadow-lg"
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
                  <span className="text-xs opacity-90 hidden sm:inline">
                    (₹{product.price * quantity})
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ==================================================== */}
        {/* ADDED TO BAG CONFIRMATION TOAST BANNER               */}
        {/* ==================================================== */}
        {justAdded && (
          <div className="mt-3.5 flex items-center justify-between gap-2 rounded-2xl bg-emerald-50 border border-emerald-200 p-3 sm:p-4 text-xs sm:text-sm text-emerald-900 shadow-sm animate-in fade-in">
            <div className="flex items-center gap-2">
              <span className="text-base">🕯️</span>
              <span className="font-semibold">
                <b>{quantity}× {product.name}</b> added to your bag!
              </span>
            </div>
            <Link
              href="/cart"
              className="font-bold underline text-clay hover:text-ink shrink-0 active:scale-95 transition"
            >
              View bag & checkout →
            </Link>
          </div>
        )}

        {/* ==================================================== */}
        {/* FULL-WIDTH ARTISANAL DETAILS & DESCRIPTION SECTION   */}
        {/* ==================================================== */}
        <div className="mt-5 sm:mt-8 space-y-4 sm:space-y-6">
          {/* Description Card */}
          {product.description && (
            <div className="rounded-2xl sm:rounded-3xl bg-white/85 border border-[#5c392715] p-4 sm:p-6 shadow-2xs space-y-1.5">
              <h3 className="text-xs font-bold uppercase tracking-[.18em] text-[#765442]">
                About this candle
              </h3>
              <p className="text-xs sm:text-base leading-relaxed text-ink/90 font-serif">
                {product.description}
              </p>
            </div>
          )}

          {/* Specifications Grid */}
          {activeSpecs.length > 0 && (
            <div className="rounded-2xl sm:rounded-3xl bg-white/85 border border-[#5c392715] p-4 sm:p-6 shadow-2xs space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-[.18em] text-[#765442]">
                Candle Specifications
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-4">
                {activeSpecs.map((spec, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-[#8a614815] bg-[#fffaf3] p-3 flex items-start gap-2.5"
                  >
                    <span className="text-lg shrink-0">{spec.icon}</span>
                    <div className="min-w-0">
                      <dt className="text-[10px] font-bold uppercase tracking-wider text-[#765442]">
                        {spec.label}
                      </dt>
                      <dd className="mt-0.5 text-xs sm:text-sm font-semibold text-ink break-words">
                        {spec.value}
                      </dd>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Studio Guarantee / Craftsmanship Badge Row */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 pt-1">
            <div className="rounded-2xl border border-[#8a614818] bg-white/70 p-2.5 sm:p-3.5 text-center">
              <span className="text-base sm:text-xl block mb-1">🌿</span>
              <p className="font-bold text-ink text-[11px] sm:text-xs">100% Plant Wax</p>
              <p className="text-[10px] text-[#765442] hidden sm:block mt-0.5">Clean natural soy burn</p>
            </div>
            <div className="rounded-2xl border border-[#8a614818] bg-white/70 p-2.5 sm:p-3.5 text-center">
              <span className="text-base sm:text-xl block mb-1">🕯️</span>
              <p className="font-bold text-ink text-[11px] sm:text-xs">Hand-Poured</p>
              <p className="text-[10px] text-[#765442] hidden sm:block mt-0.5">Crafted in small batches</p>
            </div>
            <div className="rounded-2xl border border-[#8a614818] bg-white/70 p-2.5 sm:p-3.5 text-center">
              <span className="text-base sm:text-xl block mb-1">📦</span>
              <p className="font-bold text-ink text-[11px] sm:text-xs">Careful Transit</p>
              <p className="text-[10px] text-[#765442] hidden sm:block mt-0.5">Eco-friendly protected pack</p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
