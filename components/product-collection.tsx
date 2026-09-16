"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { Product } from "@/lib/types";
import { ProductCard } from "@/components/product-card";

interface ProductCollectionProps {
  initialProducts: Product[];
  initialCategories?: string[];
}

function getCategoryIcon(categoryName: string): string {
  const lower = categoryName.toLowerCase();
  if (lower.includes("jar")) return "🕯️";
  if (lower.includes("sculpt")) return "🗿";
  if (lower.includes("flower") || lower.includes("floral") || lower.includes("rose")) return "🌸";
  if (lower.includes("tin")) return "✨";
  if (lower.includes("melt")) return "🕯️";
  if (lower.includes("aroma") || lower.includes("therapy") || lower.includes("herb")) return "🌿";
  if (lower.includes("gift") || lower.includes("hamper") || lower.includes("box")) return "🎁";
  if (lower.includes("votive") || lower.includes("mini") || lower.includes("pillar")) return "🕯️";
  return "✨";
}

export function ProductCollection({
  initialProducts,
  initialCategories = [],
}: ProductCollectionProps) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [categories, setCategories] = useState<string[]>(initialCategories);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  // Touch Swipe Gesture tracking for floating bar and drawer
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);

  // Sync products and categories in background
  useEffect(() => {
    let active = true;

    async function syncData() {
      try {
        const [prodsRes, catsRes] = await Promise.all([
          fetch("/api/products", { cache: "no-store" }),
          fetch("/api/categories", { cache: "no-store" }),
        ]);

        if (prodsRes.ok) {
          const prodsData = await prodsRes.json();
          if (active && Array.isArray(prodsData) && prodsData.length > 0) {
            setProducts(prodsData);
          }
        }

        if (catsRes.ok) {
          const catsData = await catsRes.json();
          if (active && Array.isArray(catsData) && catsData.length > 0) {
            setCategories(catsData);
          }
        }
      } catch (err) {
        console.warn("[ProductCollection] Background sync notice:", err);
      }
    }

    syncData();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        syncData();
      }
    };

    window.addEventListener("focus", syncData);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      active = false;
      window.removeEventListener("focus", syncData);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  // Lock body scroll and listen for Escape key when drawer is open
  useEffect(() => {
    if (isDrawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsDrawerOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDrawerOpen]);

  // Compute all available categories
  const allCategoryList = useMemo(() => {
    const list = new Set<string>();
    categories.forEach((c) => {
      if (c && c.trim()) list.add(c.trim());
    });
    products.forEach((p) => {
      if (p.category && p.category.trim()) list.add(p.category.trim());
    });
    return Array.from(list);
  }, [categories, products]);

  // Counts per category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: products.length };
    products.forEach((p) => {
      const cat = p.category ? p.category.trim() : "";
      if (cat) {
        counts[cat] = (counts[cat] || 0) + 1;
      }
    });
    return counts;
  }, [products]);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    if (selectedCategory === "All") return products;
    return products.filter(
      (p) => p.category && p.category.trim().toLowerCase() === selectedCategory.toLowerCase()
    );
  }, [products, selectedCategory]);

  // Swipe gestures for floating collection bar (swipe right -> open)
  const handleBarTouchStart = (e: React.TouchEvent) => {
    touchStartPos.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  };

  const handleBarTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartPos.current) return;
    const diffX = e.changedTouches[0].clientX - touchStartPos.current.x;
    const diffY = Math.abs(e.changedTouches[0].clientY - touchStartPos.current.y);

    // Swiped right with horizontal dominance
    if (diffX > 25 && diffX > diffY) {
      setIsDrawerOpen(true);
    }
    touchStartPos.current = null;
  };

  // Swipe gestures on drawer (swipe left -> close)
  const handleDrawerTouchStart = (e: React.TouchEvent) => {
    touchStartPos.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  };

  const handleDrawerTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartPos.current) return;
    const diffX = touchStartPos.current.x - e.changedTouches[0].clientX;
    const diffY = Math.abs(e.changedTouches[0].clientY - touchStartPos.current.y);

    // Swiped left with horizontal dominance
    if (diffX > 35 && diffX > diffY) {
      setIsDrawerOpen(false);
    }
    touchStartPos.current = null;
  };

  const handleSelectCategory = (cat: string) => {
    setSelectedCategory(cat);
    setIsDrawerOpen(false);
    // Smooth scroll to product shop section
    const shopEl = document.getElementById("shop");
    if (shopEl) {
      shopEl.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ==================================================== */}
      {/* 1. MIDDLE-LEFTMOST FLOATING COLLECTION BAR           */}
      {/* ==================================================== */}
      <div
        onTouchStart={handleBarTouchStart}
        onTouchEnd={handleBarTouchEnd}
        onClick={() => setIsDrawerOpen(true)}
        className="fixed left-0 top-1/2 -translate-y-1/2 z-40 flex items-center gap-2 rounded-r-2xl bg-[#2d1b16]/95 hover:bg-clay text-cream pl-2.5 pr-3.5 py-3 shadow-2xl border-y border-r border-[#8a614850] backdrop-blur-md cursor-pointer select-none transition-all duration-200 active:scale-95 group"
        role="button"
        title="Swipe or tap to open collections"
        aria-label="Browse candle collections"
      >
        {/* Animated Arrow Icon pointing right */}
        <div className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-clay/50 text-cream group-hover:bg-cream group-hover:text-ink transition-colors shrink-0">
          <svg
            className="h-3.5 w-3.5 sm:h-4 sm:w-4 transform transition-transform group-hover:translate-x-0.5 group-active:translate-x-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </div>

        {/* Text and swipe hint */}
        <div className="flex flex-col text-left leading-none">
          <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-cream font-sans">
            Collections
          </span>
          <span className="text-[9px] text-[#dfb15b] font-mono font-semibold mt-0.5">
            Swipe ›
          </span>
        </div>
      </div>

      {/* ==================================================== */}
      {/* 2. GENTLE SLIDE-IN COLLECTION DRAWER / COLUMNS       */}
      {/* ==================================================== */}
      {/* Backdrop overlay */}
      {isDrawerOpen && (
        <div
          className="fixed inset-0 bg-black/45 backdrop-blur-xs z-50 transition-opacity duration-300"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}

      {/* Drawer Container */}
      <div
        onTouchStart={handleDrawerTouchStart}
        onTouchEnd={handleDrawerTouchEnd}
        className={`fixed inset-y-0 left-0 z-50 w-80 max-w-[85vw] bg-[#fffaf3] border-r border-[#5c392725] shadow-2xl flex flex-col transform transition-transform duration-300 ease-out ${
          isDrawerOpen ? "translate-x-0" : "-translate-x-full pointer-events-none"
        }`}
        role="dialog"
        aria-label="Candle Collections"
      >
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-[#5c392715] flex items-center justify-between bg-[#fff5e6]/70">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[.2em] text-clay block">
              Handcrafted Batches
            </span>
            <h3 className="font-relaxing italic text-2xl font-bold text-ink mt-0.5">
              The Collections
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setIsDrawerOpen(false)}
            className="h-8 w-8 rounded-full bg-[#8a614815] hover:bg-[#8a614825] text-ink flex items-center justify-center text-sm font-bold transition active:scale-90 cursor-pointer"
            aria-label="Close collections drawer"
          >
            ✕
          </button>
        </div>

        {/* Gentle Columns of Categories */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-2">
          {/* "All Candles" option */}
          <button
            type="button"
            onClick={() => handleSelectCategory("All")}
            className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all text-left cursor-pointer active:scale-[0.99] ${
              selectedCategory === "All"
                ? "bg-ink text-white border-ink shadow-sm"
                : "bg-white text-ink border-[#8a614820] hover:border-clay hover:bg-[#fffdfa]"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">✨</span>
              <div>
                <div className="text-sm font-bold">All Candles</div>
                <div
                  className={`text-[11px] ${
                    selectedCategory === "All" ? "text-cream/80" : "text-[#765442]"
                  }`}
                >
                  Full handcrafted catalog
                </div>
              </div>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-mono font-bold ${
                selectedCategory === "All"
                  ? "bg-white/20 text-white"
                  : "bg-[#8a614815] text-[#765442]"
              }`}
            >
              {products.length}
            </span>
          </button>

          {/* Individual Categories */}
          {allCategoryList.map((cat) => {
            const isSelected = selectedCategory.toLowerCase() === cat.toLowerCase();
            const count = categoryCounts[cat] || 0;
            const icon = getCategoryIcon(cat);

            return (
              <button
                key={cat}
                type="button"
                onClick={() => handleSelectCategory(cat)}
                className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all text-left cursor-pointer active:scale-[0.99] ${
                  isSelected
                    ? "bg-ink text-white border-ink shadow-sm"
                    : "bg-white text-ink border-[#8a614820] hover:border-clay hover:bg-[#fffdfa]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{icon}</span>
                  <div>
                    <div className="text-sm font-bold">{cat}</div>
                    <div
                      className={`text-[11px] ${
                        isSelected ? "text-cream/80" : "text-[#765442]"
                      }`}
                    >
                      {count} {count === 1 ? "candle" : "candles"}
                    </div>
                  </div>
                </div>
                {isSelected ? (
                  <span className="h-6 w-6 rounded-full bg-clay text-white flex items-center justify-center text-xs font-bold">
                    ✓
                  </span>
                ) : (
                  <span className="rounded-full bg-[#8a614815] px-2 py-0.5 text-xs font-mono font-bold text-[#765442]">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Drawer Footer with swipe cue */}
        <div className="p-3 border-t border-[#5c392715] bg-[#fff5e6]/40 flex items-center justify-between text-[11px] text-[#765442]">
          <span className="font-mono text-[10px]">👈 Swipe left to close</span>
          <button
            type="button"
            onClick={() => setIsDrawerOpen(false)}
            className="font-bold underline hover:text-ink cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {/* ==================================================== */}
      {/* 3. CLEAN COLLECTION STATUS & DRAWER TRIGGER          */}
      {/* ==================================================== */}
      <div className="flex items-center justify-between border-b border-[#5c392715] pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm font-bold text-ink">
            {selectedCategory === "All" ? "All Candles" : selectedCategory}
          </span>
          <span className="text-[11px] font-mono text-[#765442] bg-[#8a614815] px-2 py-0.5 rounded-full font-semibold">
            {filteredProducts.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {selectedCategory !== "All" && (
            <button
              type="button"
              onClick={() => setSelectedCategory("All")}
              className="text-xs text-clay hover:text-ink font-semibold underline cursor-pointer active:scale-95"
            >
              Show all
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-white border border-[#8a614830] px-3 py-1.5 text-xs font-bold text-ink hover:bg-[#8a614815] transition active:scale-95 shadow-2xs cursor-pointer"
          >
            <span>☰</span>
            <span>Collections</span>
            <span className="text-clay font-bold">›</span>
          </button>
        </div>
      </div>

      {/* ==================================================== */}
      {/* 4. PRODUCTS GRID (2 per row on mobile, 4 on desktop) */}
      {/* ==================================================== */}
      {filteredProducts.length > 0 ? (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-6 lg:grid-cols-4">
          {filteredProducts.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        /* Empty Category State */
        <div className="rounded-3xl border border-dashed border-[#8a614830] bg-[#fffaf3] p-8 sm:p-14 text-center">
          <span className="text-3xl sm:text-4xl block mb-2">🕯️</span>
          <h3 className="font-relaxing italic text-xl sm:text-2xl font-bold text-ink">
            New candles coming soon
          </h3>
          <p className="mt-1 text-xs sm:text-sm text-[#765442] max-w-sm mx-auto">
            Our studio is handcrafting new natural soy wax candles for the <b>{selectedCategory}</b> collection.
          </p>
          <button
            type="button"
            onClick={() => setSelectedCategory("All")}
            className="mt-4 rounded-full bg-ink px-5 py-2 text-xs font-bold text-cream hover:bg-clay transition active:scale-95 cursor-pointer shadow-2xs"
          >
            ← View All Candles
          </button>
        </div>
      )}
    </div>
  );
}
