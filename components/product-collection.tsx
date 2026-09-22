"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { Product } from "@/lib/types";
import { ProductCard } from "@/components/product-card";

interface ProductCollectionProps {
  initialProducts: Product[];
  initialCategories?: string[];
}

function getCategoryIcon(categoryName?: string | null): string {
  if (!categoryName || typeof categoryName !== "string") return "✨";
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
  const [products, setProducts] = useState<Product[]>(Array.isArray(initialProducts) ? initialProducts : []);
  const [categories, setCategories] = useState<string[]>(Array.isArray(initialCategories) ? initialCategories : []);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  // Sync category from URL query parameters (e.g. ?category=Sculptural#shop)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const catParam = params.get("category");
      if (catParam) {
        setSelectedCategory(catParam);
        setTimeout(() => {
          const shopEl = document.getElementById("shop");
          if (shopEl) {
            shopEl.scrollIntoView({ behavior: "smooth" });
          }
        }, 150);
      }
    }
  }, []);

  // Touch Swipe Gesture tracking
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
          if (active && Array.isArray(prodsData)) {
            setProducts(prodsData);
          }
        }

        if (catsRes.ok) {
          const catsData = await catsRes.json();
          if (active && Array.isArray(catsData)) {
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

  // Compute all available categories from active categories
  const allCategoryList = useMemo(() => {
    const list = new Set<string>();
    if (Array.isArray(categories)) {
      categories.forEach((c) => {
        if (c && typeof c === "string" && c.trim()) list.add(c.trim());
      });
    }
    return Array.from(list);
  }, [categories]);

  // Reset selected category to "All" if it was deleted
  useEffect(() => {
    if (
      selectedCategory &&
      selectedCategory !== "All" &&
      !allCategoryList.some(
        (c) => typeof c === "string" && c.toLowerCase() === String(selectedCategory).toLowerCase()
      )
    ) {
      setSelectedCategory("All");
    }
  }, [allCategoryList, selectedCategory]);

  // Counts per category
  const categoryCounts = useMemo(() => {
    const prods = Array.isArray(products) ? products : [];
    const counts: Record<string, number> = { All: prods.length };
    prods.forEach((p) => {
      const cat = p && p.category && typeof p.category === "string" ? p.category.trim() : "";
      if (cat) {
        counts[cat] = (counts[cat] || 0) + 1;
      }
    });
    return counts;
  }, [products]);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    const prods = Array.isArray(products) ? products : [];
    if (!selectedCategory || selectedCategory === "All") return prods;
    const selLower = String(selectedCategory).trim().toLowerCase();
    return prods.filter(
      (p) => p && typeof p.category === "string" && p.category.trim().toLowerCase() === selLower
    );
  }, [products, selectedCategory]);

  // Swipe gestures for bottom pill and inline bar (swipe right -> open drawer)
  const handlePillTouchStart = (e: React.TouchEvent) => {
    touchStartPos.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  };

  const handlePillTouchEnd = (e: React.TouchEvent) => {
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
      {/* 1. NON-INTRUSIVE BOTTOM FLOATING PILL                */}
      {/* Sits comfortably centered at bottom with zero       */}
      {/* interference with left or right product columns     */}
      {/* ==================================================== */}
      <div
        onTouchStart={handlePillTouchStart}
        onTouchEnd={handlePillTouchEnd}
        onClick={() => setIsDrawerOpen(true)}
        className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-full bg-[#2d1b16]/95 hover:bg-clay text-cream px-4 py-2.5 shadow-2xl border border-[#8a614850] backdrop-blur-md cursor-pointer select-none transition-all duration-300 active:scale-95 group ${
          isDrawerOpen ? "opacity-0 pointer-events-none translate-y-4" : "opacity-100 translate-y-0"
        }`}
        role="button"
        title="Swipe right or tap to open collections"
        aria-label="Browse candle collections"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-clay/50 text-cream text-xs">
          🕯️
        </span>
        <span className="text-xs font-bold uppercase tracking-wider text-cream font-sans">
          {selectedCategory === "All" ? "Collections" : selectedCategory}
        </span>
        <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[10px] font-mono font-bold text-cream">
          {filteredProducts.length}
        </span>
        <div className="flex items-center gap-1 text-clay text-xs pl-1 border-l border-white/20">
          <span className="text-[10px] text-[#dfb15b] font-mono font-semibold">
            Swipe
          </span>
          <svg
            className="h-3.5 w-3.5 text-[#dfb15b] transform transition-transform group-hover:translate-x-0.5 group-active:translate-x-1 animate-pulse"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>

      {/* ==================================================== */}
      {/* 2. INLINE ARTISANAL COLLECTION BAR (Above Products)  */}
      {/* ==================================================== */}
      <div
        onTouchStart={handlePillTouchStart}
        onTouchEnd={handlePillTouchEnd}
        onClick={() => setIsDrawerOpen(true)}
        className="flex items-center justify-between bg-[#fffaf3] border border-[#8a614828] rounded-2xl p-2.5 sm:p-3.5 shadow-2xs hover:border-clay/60 cursor-pointer transition select-none group"
      >
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-[#8a614815] text-base shrink-0">
            {selectedCategory === "All" ? "✨" : getCategoryIcon(selectedCategory)}
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs sm:text-sm font-bold text-ink">
                {selectedCategory === "All" ? "All Handcrafted Candles" : selectedCategory}
              </span>
              <span className="text-[10px] sm:text-[11px] font-mono font-bold text-[#765442] bg-[#8a614815] px-2 py-0.2 rounded-full">
                {filteredProducts.length} {filteredProducts.length === 1 ? "item" : "items"}
              </span>
            </div>
            <p className="text-[10px] text-[#765442] font-medium mt-0.5 hidden xs:block">
              Swipe right ❯ or tap to view all collections
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedCategory !== "All" && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedCategory("All");
              }}
              className="text-xs text-clay hover:text-ink font-semibold underline cursor-pointer px-1 py-1"
            >
              Reset
            </button>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ink group-hover:bg-clay text-cream px-3 py-1.5 text-xs font-bold transition shadow-2xs">
            <span>Collections</span>
            <span className="text-[#dfb15b] font-bold">›</span>
          </span>
        </div>
      </div>

      {/* ==================================================== */}
      {/* 3. GENTLE SLIDE-IN COLLECTION DRAWER / COLUMNS       */}
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
            if (!cat || typeof cat !== "string") return null;
            const isSelected = String(selectedCategory || "").toLowerCase() === cat.toLowerCase();
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
