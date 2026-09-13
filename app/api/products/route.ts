import { getStore, saveStore } from "@/lib/store";
import { isSupabaseConfigured, fetchProductsFromSupabase, saveProductsToSupabase } from "@/lib/supabase";
import { Product } from "@/lib/types";
import { NextResponse } from "next/server";

export async function GET() {
  let products = getStore().products;

  if (isSupabaseConfigured()) {
    try {
      const cloudProducts = await fetchProductsFromSupabase();
      if (cloudProducts && Array.isArray(cloudProducts) && cloudProducts.length > 0) {
        products = cloudProducts;
        const db = getStore();
        db.products = cloudProducts;
      }
    } catch (err: any) {
      console.warn("[API Products GET] Supabase sync fallback:", err.message);
    }
  }

  return NextResponse.json(products);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const db = getStore();
    let currentProducts = [...db.products];

    if (isSupabaseConfigured()) {
      try {
        const cloudProducts = await fetchProductsFromSupabase();
        if (cloudProducts && Array.isArray(cloudProducts) && cloudProducts.length > 0) {
          currentProducts = [...cloudProducts];
        }
      } catch {}
    }

    const newProduct: Product = {
      ...body,
      id:
        body.id ||
        `candle-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: body.name?.trim() || "Handcrafted Soy Candle",
      price: Number(body.price) || 0,
      description: body.description?.trim() || "",
      burnTime: body.burnTime?.trim() || "30–35 hours",
      ingredients: body.ingredients?.trim() || "Soy wax, cotton wick",
      category: body.category?.trim() || "Jar candle",
      images:
        body.images && Array.isArray(body.images) && body.images.length > 0
          ? body.images
          : ["https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&w=900&q=85"],
      available: body.available !== false,
    };

    currentProducts.unshift(newProduct);
    db.products = currentProducts;
    saveStore(db);

    if (isSupabaseConfigured()) {
      await saveProductsToSupabase(currentProducts);
    }

    return NextResponse.json(newProduct, { status: 201 });
  } catch (err: any) {
    console.error("[API Products POST Error]", err);
    return NextResponse.json(
      { error: err.message || "Failed to create product" },
      { status: 500 }
    );
  }
}
