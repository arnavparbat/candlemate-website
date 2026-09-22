import { getStore, saveStore } from "@/lib/store";
import {
  isSupabaseConfigured,
  fetchCategoriesFromSupabase,
  saveCategoriesToSupabase,
  fetchProductsFromSupabase,
  saveProductsToSupabase,
} from "@/lib/supabase";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_CATEGORIES = [
  "Jar candle",
  "Sculptural",
  "Flower candle",
  "Wax melts",
  "Aromatherapy",
];

export async function GET() {
  const db = getStore();
  let categories: string[] =
    Array.isArray(db.categories) && db.categories.length > 0
      ? [...db.categories]
      : [...DEFAULT_CATEGORIES];

  if (isSupabaseConfigured()) {
    try {
      const cloudCats = await fetchCategoriesFromSupabase();
      if (cloudCats && Array.isArray(cloudCats)) {
        // Cloud categories in Supabase is the true source of truth
        categories = cloudCats;
      }
    } catch (err: any) {
      console.warn("[API Categories GET] Cloud sync notice:", err.message);
    }
  }

  // Deduplicate while preserving order
  const seen = new Set<string>();
  const uniqueCategories: string[] = [];
  categories.forEach((cat) => {
    const cleaned = typeof cat === "string" ? cat.trim() : "";
    const lower = cleaned.toLowerCase();
    if (cleaned && !seen.has(lower)) {
      seen.add(lower);
      uniqueCategories.push(cleaned);
    }
  });

  return NextResponse.json(uniqueCategories, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = body?.name ? String(body.name).trim() : "";

    if (!name) {
      return NextResponse.json(
        { error: "Category name is required" },
        { status: 400 }
      );
    }

    const db = getStore();
    let currentCats: string[] =
      Array.isArray(db.categories) && db.categories.length > 0
        ? [...db.categories]
        : [...DEFAULT_CATEGORIES];

    if (isSupabaseConfigured()) {
      try {
        const cloudCats = await fetchCategoriesFromSupabase();
        if (cloudCats && Array.isArray(cloudCats)) {
          currentCats = [...cloudCats];
        }
      } catch {}
    }

    if (!currentCats.some((c) => c.toLowerCase() === name.toLowerCase())) {
      currentCats.push(name);
    }

    db.categories = currentCats;
    saveStore(db);

    if (isSupabaseConfigured()) {
      await saveCategoriesToSupabase(currentCats);
    }

    try {
      revalidatePath("/");
      revalidatePath("/admin");
    } catch {}

    return NextResponse.json(
      { ok: true, category: name, categories: currentCats },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("[API Categories POST Error]", err);
    return NextResponse.json(
      { error: err.message || "Failed to add category" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const name = body?.name ? String(body.name).trim() : "";

    if (!name) {
      return NextResponse.json(
        { error: "Category name is required" },
        { status: 400 }
      );
    }

    const db = getStore();
    let currentCats: string[] =
      Array.isArray(db.categories) && db.categories.length > 0
        ? [...db.categories]
        : [...DEFAULT_CATEGORIES];

    let currentProducts = db.products || [];

    if (isSupabaseConfigured()) {
      try {
        const [cloudCats, cloudProds] = await Promise.all([
          fetchCategoriesFromSupabase(),
          fetchProductsFromSupabase(),
        ]);
        if (cloudCats && Array.isArray(cloudCats)) {
          currentCats = [...cloudCats];
        }
        if (cloudProds && Array.isArray(cloudProds)) {
          currentProducts = [...cloudProds];
        }
      } catch {}
    }

    // Filter out the deleted category (case-insensitive)
    currentCats = currentCats.filter(
      (c) => c.trim().toLowerCase() !== name.toLowerCase()
    );

    // Also unassign this category from any products that currently have it
    let prodsChanged = false;
    currentProducts = currentProducts.map((p) => {
      if (p.category && p.category.trim().toLowerCase() === name.toLowerCase()) {
        prodsChanged = true;
        return { ...p, category: "" };
      }
      return p;
    });

    db.categories = currentCats;
    if (prodsChanged) {
      db.products = currentProducts;
    }
    saveStore(db);

    if (isSupabaseConfigured()) {
      const promises: Promise<any>[] = [saveCategoriesToSupabase(currentCats)];
      if (prodsChanged) {
        promises.push(saveProductsToSupabase(currentProducts));
      }
      await Promise.all(promises);
    }

    try {
      revalidatePath("/");
      revalidatePath("/admin");
    } catch {}

    return NextResponse.json({
      ok: true,
      categories: currentCats,
      products: currentProducts,
    });
  } catch (err: any) {
    console.error("[API Categories DELETE Error]", err);
    return NextResponse.json(
      { error: err.message || "Failed to delete category" },
      { status: 500 }
    );
  }
}
