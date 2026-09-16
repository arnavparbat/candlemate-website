import { getStore, saveStore } from "@/lib/store";
import {
  isSupabaseConfigured,
  fetchCategoriesFromSupabase,
  saveCategoriesToSupabase,
  fetchProductsFromSupabase,
} from "@/lib/supabase";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_CATEGORIES = [
  "Jar candle",
  "Sculptural",
  "Flower candle",
  "Tin candle",
  "Wax melts",
  "Aromatherapy",
];

export async function GET() {
  let categories: string[] = [...DEFAULT_CATEGORIES];
  const db = getStore();

  if (Array.isArray(db.categories)) {
    categories.push(...db.categories);
  }

  let products = db.products || [];

  if (isSupabaseConfigured()) {
    try {
      const [cloudCats, cloudProds] = await Promise.all([
        fetchCategoriesFromSupabase(),
        fetchProductsFromSupabase(),
      ]);

      if (cloudCats && Array.isArray(cloudCats)) {
        categories.push(...cloudCats);
      }
      if (cloudProds && Array.isArray(cloudProds)) {
        products = cloudProds;
      }
    } catch (err: any) {
      console.warn("[API Categories GET] Cloud sync notice:", err.message);
    }
  }

  // Include categories tagged on any active products
  products.forEach((p) => {
    if (p.category && typeof p.category === "string" && p.category.trim()) {
      categories.push(p.category.trim());
    }
  });

  // Deduplicate while preserving order
  const seen = new Set<string>();
  const uniqueCategories: string[] = [];
  categories.forEach((cat) => {
    const cleaned = cat.trim();
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
    let currentCats: string[] = Array.isArray(db.categories)
      ? [...db.categories]
      : [...DEFAULT_CATEGORIES];

    if (isSupabaseConfigured()) {
      try {
        const cloudCats = await fetchCategoriesFromSupabase();
        if (cloudCats && Array.isArray(cloudCats)) {
          currentCats = Array.from(new Set([...currentCats, ...cloudCats]));
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
    let currentCats: string[] = Array.isArray(db.categories)
      ? [...db.categories]
      : [...DEFAULT_CATEGORIES];

    if (isSupabaseConfigured()) {
      try {
        const cloudCats = await fetchCategoriesFromSupabase();
        if (cloudCats && Array.isArray(cloudCats)) {
          currentCats = cloudCats;
        }
      } catch {}
    }

    currentCats = currentCats.filter(
      (c) => c.toLowerCase() !== name.toLowerCase()
    );

    db.categories = currentCats;
    saveStore(db);

    if (isSupabaseConfigured()) {
      await saveCategoriesToSupabase(currentCats);
    }

    try {
      revalidatePath("/");
      revalidatePath("/admin");
    } catch {}

    return NextResponse.json({ ok: true, categories: currentCats });
  } catch (err: any) {
    console.error("[API Categories DELETE Error]", err);
    return NextResponse.json(
      { error: err.message || "Failed to delete category" },
      { status: 500 }
    );
  }
}
