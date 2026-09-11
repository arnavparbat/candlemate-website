"use client";

import { useEffect, useState } from "react";
import { Order, OrderStatus, Product } from "@/lib/types";
import Link from "next/link";

const statuses: OrderStatus[] = [
  "Order Received",
  "Preparing",
  "Out for Delivery",
  "Delivered",
];
const fields = ["name", "price", "description", "burnTime", "ingredients", "category"];

function fileToOptimizedDataUrl(file: File, maxDim = 1200, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(String(e.target?.result));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => resolve(String(e.target?.result));
      img.src = String(e.target?.result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Admin() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState("All");
  const [upi, setUpi] = useState("");
  const [notice, setNotice] = useState("");
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [draft, setDraft] = useState<any>({
    name: "",
    price: "",
    description: "",
    burnTime: "30–35 hours",
    ingredients: "Soy wax, cotton wick",
    category: "Jar candle",
    images: "",
    available: true,
  });

  async function load() {
    const [o, p, s] = await Promise.all([
      fetch("/api/admin/orders").then((r) => r.json()),
      fetch("/api/products").then((r) => r.json()),
      fetch("/api/settings/payment").then((r) => r.json()),
    ]);
    setOrders(o);
    setProducts(p);
    setUpi(s.upiId);
  }

  useEffect(() => {
    load();
  }, []);

  async function status(id: string, status: OrderStatus) {
    await fetch(`/api/admin/orders/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  async function handleDraftFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setIsProcessingPhoto(true);
    setNotice("Processing photos from your device...");
    try {
      const urls: string[] = [];
      for (const file of files) {
        const optimized = await fileToOptimizedDataUrl(file);
        urls.push(optimized);
      }
      setUploadedPhotos((prev) => [...prev, ...urls]);
      setNotice(`Added ${urls.length} photo(s) from device.`);
    } catch {
      setNotice("Failed to process one or more photos.");
    } finally {
      setIsProcessingPhoto(false);
      e.target.value = "";
    }
  }

  function removeUploadedPhoto(index: number) {
    setUploadedPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const urlImages = draft.images
      .split("\n")
      .map((s: string) => s.trim())
      .filter(Boolean);
    const finalImages = [...uploadedPhotos, ...urlImages];

    if (!finalImages.length) {
      setNotice("Please add at least one product photo (upload from device or enter URL).");
      return;
    }

    await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...draft,
        images: finalImages,
        price: Number(draft.price),
      }),
    });

    setDraft({
      name: "",
      price: "",
      description: "",
      burnTime: "30–35 hours",
      ingredients: "Soy wax, cotton wick",
      category: "Jar candle",
      images: "",
      available: true,
    });
    setUploadedPhotos([]);
    setNotice("Product added to the collection.");
    load();
  }

  async function updateProduct(p: Product, patch: Partial<Product>) {
    await fetch(`/api/products/${p.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...p, ...patch }),
    });
    load();
  }

  async function handleProductImageUpload(p: Product, file: File, replaceIndex = 0) {
    setNotice(`Optimizing and uploading image for ${p.name}...`);
    try {
      const dataUrl = await fileToOptimizedDataUrl(file);
      const newImages = [...(p.images || [])];
      if (replaceIndex < newImages.length) {
        newImages[replaceIndex] = dataUrl;
      } else {
        newImages.push(dataUrl);
      }
      await updateProduct(p, { images: newImages });
      setNotice(`Photo updated for ${p.name}.`);
    } catch {
      setNotice("Failed to update photo.");
    }
  }

  async function handleProductAddImage(p: Product, file: File) {
    setNotice(`Adding photo to ${p.name}...`);
    try {
      const dataUrl = await fileToOptimizedDataUrl(file);
      const newImages = [...(p.images || []), dataUrl];
      await updateProduct(p, { images: newImages });
      setNotice(`New photo added to ${p.name}.`);
    } catch {
      setNotice("Failed to add photo.");
    }
  }

  async function removeProductImage(p: Product, index: number) {
    if ((p.images || []).length <= 1) {
      setNotice("Product must have at least one photo.");
      return;
    }
    const newImages = p.images.filter((_, i) => i !== index);
    await updateProduct(p, { images: newImages });
    setNotice(`Photo removed from ${p.name}.`);
  }

  async function remove(id: string) {
    if (confirm("Remove this product from the collection?")) {
      await fetch(`/api/products/${id}`, { method: "DELETE" });
      load();
    }
  }

  async function payment(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/admin/settings/payment", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ upiId: upi }),
    });
    setNotice(r.ok ? "Payment details saved." : "Please use a valid UPI ID.");
  }

  async function password(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const r = await fetch("/api/admin/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: data.get("currentPassword"),
        newPassword: data.get("newPassword"),
      }),
    });
    setNotice(r.ok ? "Password updated." : "Couldn’t update password.");
    if (r.ok) e.currentTarget.reset();
  }

  const shown = filter === "All" ? orders : orders.filter((o) => o.status === filter);

  return (
    <main className="min-h-screen bg-[#f8f0e3]">
      <header className="border-b bg-[#fff8ed]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Link href="/" className="display text-2xl">
            candlemate<span className="text-gold">.</span>
          </Link>
          <span className="rounded-full bg-[#e9d5b8] px-3 py-1 text-xs">Studio dashboard</span>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-9">
        {notice && <p className="mb-5 rounded-xl bg-[#e5eedc] p-3 text-sm text-moss">{notice}</p>}
        <h1 className="display text-5xl">Good morning, maker.</h1>
        <p className="mt-2 text-[#765442]">Orders, products and payment details in one calm place.</p>

        {/* Incoming Orders Section */}
        <section className="mt-10">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="display text-3xl">Incoming orders</h2>
              <p className="mt-1 text-sm text-[#765442]">
                {orders.length} order{orders.length === 1 ? "" : "s"} received
              </p>
            </div>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="rounded-lg border bg-white px-3 py-2 text-sm"
            >
              <option>All</option>
              {statuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-[#8a61483a] bg-white">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-[#eadcc9] text-xs uppercase tracking-wide text-[#765442]">
                <tr>
                  <th className="p-3">Order</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th>Received</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((o) => (
                  <tr key={o.id} className="border-t border-[#8a61481f]">
                    <td className="p-3 font-medium text-clay">{o.id}</td>
                    <td>
                      <b>{o.customer.name}</b>
                      <br />
                      <span className="text-xs text-[#765442]">
                        {o.customer.phone}
                        <br />
                        {o.customer.address}
                      </span>
                    </td>
                    <td>
                      {o.items.map((i) => (
                        <div key={i.id}>
                          {i.quantity}× {i.name}
                        </div>
                      ))}
                    </td>
                    <td>₹{o.total}</td>
                    <td>
                      {o.screenshot ? (
                        <a className="text-clay underline" target="_blank" href={o.screenshot}>
                          View
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <select
                        value={o.status}
                        onChange={(e) => status(o.id, e.target.value as OrderStatus)}
                        className="rounded border bg-white p-1.5 text-xs"
                      >
                        {statuses.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td className="text-xs text-[#765442]">
                      {new Date(o.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {!shown.length && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-[#765442]">
                      No orders in this view yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Collection & Settings Grid */}
        <section className="mt-14 grid gap-8 lg:grid-cols-2">
          {/* Collection Column */}
          <div>
            <div className="flex items-center justify-between">
              <h2 className="display text-3xl">Collection</h2>
              <span className="text-xs text-[#765442]">{products.length} candles</span>
            </div>

            <div className="mt-4 space-y-4">
              {products.map((p) => (
                <div
                  key={p.id}
                  className="rounded-2xl border border-[#8a614820] bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start gap-4">
                    <img
                      src={p.images?.[0] || "/hero-candle.jpg"}
                      alt=""
                      className="h-16 w-16 rounded-xl object-cover border border-[#8a61481a]"
                    />
                    <div className="flex-1">
                      <b className="text-base text-ink">{p.name}</b>
                      <p className="text-xs text-[#765442]">
                        ₹{p.price} · {p.category}
                      </p>

                      {/* Photo management for existing candle */}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#8a61483a] bg-[#fff8ed] px-2.5 py-1 text-xs font-medium text-clay hover:bg-clay hover:text-white transition">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Change photo
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleProductImageUpload(p, f, 0);
                              e.target.value = "";
                            }}
                          />
                        </label>

                        <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#8a61482a] bg-white px-2 py-1 text-xs text-[#765442] hover:border-clay hover:text-clay transition">
                          + Add photo
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleProductAddImage(p, f);
                              e.target.value = "";
                            }}
                          />
                        </label>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <button
                        onClick={() => updateProduct(p, { available: !p.available })}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                          p.available
                            ? "bg-[#e5eedc] text-moss"
                            : "bg-stone-200 text-stone-600"
                        }`}
                      >
                        {p.available ? "In stock" : "Sold out"}
                      </button>
                      <button
                        onClick={() => remove(p.id)}
                        className="text-xs text-[#a94d3b] hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Gallery thumbnails for candle if multiple */}
                  {p.images && p.images.length > 1 && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#8a61481a] pt-3">
                      <span className="text-[11px] uppercase tracking-wide text-[#765442]">Gallery:</span>
                      {p.images.map((imgUrl, imgIdx) => (
                        <div key={imgIdx} className="group relative h-10 w-10 overflow-hidden rounded-lg border border-[#8a61482a]">
                          <img src={imgUrl} alt="" className="h-full w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeProductImage(p, imgIdx)}
                            className="absolute inset-0 hidden items-center justify-center bg-black/60 text-xs text-white group-hover:flex"
                            title="Remove image"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Add a candle Form */}
            <form onSubmit={add} className="mt-6 rounded-2xl border border-dashed border-[#a66a46] bg-[#fffaf2] p-5 shadow-sm">
              <h3 className="display text-2xl">Add a candle</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {fields.map((f) => (
                  <label key={f} className="text-xs capitalize text-[#765442]">
                    {f.replace(/([A-Z])/g, " $1")}
                    <input
                      required={f !== "ingredients"}
                      value={draft[f]}
                      type={f === "price" ? "number" : "text"}
                      onChange={(e) => setDraft({ ...draft, [f]: e.target.value })}
                      className="mt-1 w-full rounded-lg border bg-white p-2 text-sm text-ink outline-clay"
                    />
                  </label>
                ))}
              </div>

              {/* Product Photos Section */}
              <div className="mt-4">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#765442]">
                  Product Photos
                </label>

                {/* Upload from Device Button */}
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-clay bg-[#f8ede0] px-4 py-2.5 text-xs font-medium text-clay hover:bg-clay hover:text-white transition">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Browse Device Photos
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleDraftFiles}
                      disabled={isProcessingPhoto}
                    />
                  </label>
                  <span className="text-xs text-[#765442]">
                    {isProcessingPhoto ? "Optimizing image..." : "Upload one or multiple images directly from your phone/computer"}
                  </span>
                </div>

                {/* Previews of uploaded images */}
                {uploadedPhotos.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {uploadedPhotos.map((src, i) => (
                      <div
                        key={i}
                        className="group relative h-16 w-16 overflow-hidden rounded-xl border border-[#8a61483a]"
                      >
                        <img src={src} alt="Uploaded preview" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeUploadedPhoto(i)}
                          className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-xs font-bold text-white hover:bg-red-600 transition"
                          title="Remove photo"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Optional Web URL fallback */}
                <label className="mt-3 block text-xs text-[#765442]">
                  Or paste Photo URLs (one per line):
                  <textarea
                    placeholder="https://..."
                    value={draft.images}
                    onChange={(e) => setDraft({ ...draft, images: e.target.value })}
                    className="mt-1 h-14 w-full rounded-lg border bg-white p-2 text-xs text-ink outline-clay"
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={isProcessingPhoto}
                className="mt-4 rounded-full bg-ink px-5 py-2.5 text-sm text-white hover:bg-clay transition disabled:bg-stone-400"
              >
                Add product
              </button>
            </form>
          </div>

          {/* Studio Settings Column */}
          <div>
            <h2 className="display text-3xl">Studio settings</h2>

            {/* Payment QR Settings */}
            <form onSubmit={payment} className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
              <h3 className="font-medium text-ink">Payment QR</h3>
              <p className="mt-1 text-sm text-[#765442]">
                This UPI ID generates each checkout QR code automatically.
              </p>
              <input
                value={upi}
                onChange={(e) => setUpi(e.target.value)}
                className="mt-4 w-full rounded-lg border p-2 text-sm text-ink outline-clay"
                placeholder="name@upi"
              />
              <button className="mt-3 rounded-full bg-ink px-5 py-2.5 text-sm text-white hover:bg-clay transition">
                Save UPI ID
              </button>
            </form>

            {/* Password Settings */}
            <form onSubmit={password} className="mt-5 rounded-2xl bg-white p-5 shadow-sm">
              <h3 className="font-medium text-ink">Change studio password</h3>
              <input
                name="currentPassword"
                type="password"
                required
                className="mt-4 w-full rounded-lg border p-2 text-sm text-ink outline-clay"
                placeholder="Current password"
              />
              <input
                name="newPassword"
                type="password"
                required
                minLength={8}
                className="mt-3 w-full rounded-lg border p-2 text-sm text-ink outline-clay"
                placeholder="New password (8+ characters)"
              />
              <button className="mt-3 rounded-full bg-ink px-5 py-2.5 text-sm text-white hover:bg-clay transition">
                Update password
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
