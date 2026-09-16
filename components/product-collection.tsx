"use client";

import { useEffect, useState, useMemo } from "react";
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

  // Compute all available categories from both the categories list & current products
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

  // Filtered product items
  const filteredProducts = useMemo(() => {
    if (selectedCategory === "All") return products;
    return products.filter(
      (p) => p.category && p.category.trim().toLowerCase() === selectedCategory.toLowerCase()
    );
  }, [products, selectedCategory]);

  return (
    <div className="space-y-4 sm:space-y-7">
      {/* ==================================================== */}
      {/* MOBILE-FRIENDLY CATEGORY BAR                         */}
      {/* ==================================================== */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[.18em] text-[#765442]/80">
            Browse by category
          </span>
          <span className="text-[11px] text-clay font-medium hidden sm:inline">
            {selectedCategory === "All"
              ? `Showing all ${products.length} candles`
              : `${filteredProducts.length} in ${selectedCategory}`}
          </span>
        </div>

        {/* Scrollable Category Chips on Mobile / Wrapped on Desktop */}
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-2 pt-0.5 no-scrollbar sm:flex-wrap -mx-3 px-3 sm:mx-0 sm:px-0">
          {/* "All" Category Pill */}
          <button
            type="button"
            onClick={() => setSelectedCategory("All")}
            className={`shrink-0 inline-flex items-center gap-1.5 rounded-full py-1.5 px-3 sm:px-4 text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-2xs ${
              selectedCategory === "All"
                ? "bg-ink text-white shadow-xs border border-ink"
                : "bg-white/80 text-[#765442] border border-[#5c39271a] hover:bg-white hover:text-ink"
            }`}
          >
            <span>✨</span>
            <span>All Candles</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono font-black ${
                selectedCategory === "All"
                  ? "bg-white/20 text-white"
                  : "bg-[#8a614815] text-[#765442]"
              }`}
            >
              {products.length}
            </span>
          </button>

          {/* Dynamic Categories List from Admin / Store */}
          {allCategoryList.map((cat) => {
            const isSelected = selectedCategory.toLowerCase() === cat.toLowerCase();
            const count = categoryCounts[cat] || 0;
            const icon = getCategoryIcon(cat);

            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`shrink-0 inline-flex items-center gap-1.5 rounded-full py-1.5 px-3 sm:px-4 text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-2xs ${
                  isSelected
                    ? "bg-ink text-white shadow-xs border border-ink"
                    : "bg-white/80 text-[#765442] border border-[#5c39271a] hover:bg-white hover:text-ink"
                }`}
              >
                <span>{icon}</span>
                <span>{cat}</span>
                {count > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono font-black ${
                      isSelected
                        ? "bg-white/20 text-white"
                        : "bg-[#8a614815] text-[#765442]"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ==================================================== */}
      {/* PRODUCTS GRID (2 per row on mobile, 4 on desktop)    */}
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
          <h3 className="display text-lg sm:text-xl font-bold text-ink">
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
