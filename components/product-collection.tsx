"use client";

import { useEffect, useState } from "react";
import { Product } from "@/lib/types";
import { ProductCard } from "@/components/product-card";

interface ProductCollectionProps {
  initialProducts: Product[];
}

export function ProductCollection({ initialProducts }: ProductCollectionProps) {
  const [products, setProducts] = useState<Product[]>(initialProducts);

  useEffect(() => {
    let active = true;

    async function syncProducts() {
      try {
        const res = await fetch("/api/products", { cache: "no-store" });
        if (res.ok) {
          const cloudData = await res.json();
          if (active && Array.isArray(cloudData) && cloudData.length > 0) {
            setProducts(cloudData);
          }
        }
      } catch (err) {
        console.warn("[ProductCollection] Background sync notice:", err);
      }
    }

    // Immediately check for any studio updates
    syncProducts();

    // Re-check when customer returns to tab
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        syncProducts();
      }
    };

    window.addEventListener("focus", syncProducts);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      active = false;
      window.removeEventListener("focus", syncProducts);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-6 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
