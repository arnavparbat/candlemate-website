import { getStore, saveStore } from "@/lib/store";
import { isSupabaseConfigured, fetchProductsFromSupabase, saveProductsToSupabase } from "@/lib/supabase";
import defaultStore from "@/data/store.json";
import { Product } from "@/lib/types";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);
  let products = getStore().products;

  if (isSupabaseConfigured()) {
    try {
      const cloudProducts = await fetchProductsFromSupabase();
      if (cloudProducts && Array.isArray(cloudProducts) && cloudProducts.length > 0) {
        products = cloudProducts;
      }
    } catch {}
  }

  let product = products.find((p) => p.id === id || p.id === decodedId);
  if (!product) {
    product = (defaultStore.products as Product[]).find((p) => p.id === id || p.id === decodedId);
  }

  return product
    ? NextResponse.json(product, {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      })
    : NextResponse.json({ error: "Product not found" }, { status: 404 });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);
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

  let i = products.findIndex((p) => p.id === id || p.id === decodedId);
  if (i < 0) {
    const fallback = (defaultStore.products as Product[]).find((p) => p.id === id || p.id === decodedId);
    if (fallback) {
      products.push(fallback);
      i = products.length - 1;
    } else {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
  }

  const updatedProduct: Product = {
    ...products[i],
    name: body.name !== undefined ? String(body.name).trim() : products[i].name,
    price: !isNaN(Number(body.price)) ? Number(body.price) : products[i].price,
    description: body.description !== undefined ? String(body.description).trim() : products[i].description,
    burnTime: body.burnTime !== undefined ? String(body.burnTime).trim() : products[i].burnTime,
    ingredients: body.ingredients !== undefined ? String(body.ingredients).trim() : products[i].ingredients,
    wickSize: body.wickSize !== undefined ? String(body.wickSize).trim() : products[i].wickSize,
    candleDimensions: body.candleDimensions !== undefined ? String(body.candleDimensions).trim() : products[i].candleDimensions,
    fragrance: body.fragrance !== undefined ? String(body.fragrance).trim() : products[i].fragrance,
    category: body.category !== undefined ? String(body.category).trim() : products[i].category,
    images: Array.isArray(body.images) && body.images.length > 0 ? body.images : products[i].images,
    available: typeof body.available === "boolean" ? body.available : products[i].available,
  };

  products[i] = updatedProduct;
  db.products = products;
  saveStore(db);

  if (isSupabaseConfigured()) {
    await saveProductsToSupabase(products);
  }

  try {
    revalidatePath("/");
    revalidatePath(`/products/${id}`);
    revalidatePath(`/products/${decodedId}`);
  } catch {}

  return NextResponse.json(updatedProduct, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    },
  });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);
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

  products = products.filter((p) => p.id !== id && p.id !== decodedId);
  db.products = products;
  saveStore(db);

  if (isSupabaseConfigured()) {
    await saveProductsToSupabase(products);
  }

  try {
    revalidatePath("/");
    revalidatePath(`/products/${id}`);
    revalidatePath(`/products/${decodedId}`);
  } catch {}

  return NextResponse.json(
    { ok: true },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    }
  );
}
