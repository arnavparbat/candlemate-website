import { getStore, saveStore } from "@/lib/store";
import { isSupabaseConfigured, fetchProductsFromSupabase, saveProductsToSupabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let products = getStore().products;

  if (isSupabaseConfigured()) {
    try {
      const cloudProducts = await fetchProductsFromSupabase();
      if (cloudProducts && Array.isArray(cloudProducts) && cloudProducts.length > 0) {
        products = cloudProducts;
      }
    } catch {}
  }

  const product = products.find((p) => p.id === id);
  return product
    ? NextResponse.json(product)
    : NextResponse.json({ error: "Product not found" }, { status: 404 });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const db = getStore();
  let products = [...db.products];

  if (isSupabaseConfigured()) {
    try {
      const cloudProducts = await fetchProductsFromSupabase();
      if (cloudProducts && Array.isArray(cloudProducts) && cloudProducts.length > 0) {
        products = [...cloudProducts];
      }
    } catch {}
  }

  const i = products.findIndex((p) => p.id === id);
  if (i < 0) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  products[i] = {
    ...products[i],
    ...body,
    price: Number(body.price) || products[i].price,
  };

  db.products = products;
  saveStore(db);

  if (isSupabaseConfigured()) {
    await saveProductsToSupabase(products);
  }

  return NextResponse.json(products[i]);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getStore();
  let products = [...db.products];

  if (isSupabaseConfigured()) {
    try {
      const cloudProducts = await fetchProductsFromSupabase();
      if (cloudProducts && Array.isArray(cloudProducts) && cloudProducts.length > 0) {
        products = [...cloudProducts];
      }
    } catch {}
  }

  products = products.filter((p) => p.id !== id);
  db.products = products;
  saveStore(db);

  if (isSupabaseConfigured()) {
    await saveProductsToSupabase(products);
  }

  return NextResponse.json({ ok: true });
}
