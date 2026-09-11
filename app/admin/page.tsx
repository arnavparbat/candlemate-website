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
  const [selectedScreenshotOrder, setSelectedScreenshotOrder] = useState<Order | null>(null);
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [newOrderAlert, setNewOrderAlert] = useState<Order | null>(null);

  function playOrderChime() {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880, now + 0.14); // A5
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
      osc.start(now);
      osc.stop(now + 0.65);
    } catch {
      // Audio autoplay policy fallback
    }
  }

  function getScreenshotExpiryInfo(createdAt: string, expiresAt?: string) {
    const createdTime = new Date(createdAt).getTime();
    const expiryTime = expiresAt
      ? new Date(expiresAt).getTime()
      : createdTime + 3 * 24 * 60 * 60 * 1000;
    const diff = expiryTime - Date.now();

    if (diff <= 0) {
      return { isExpired: true, timeLeftText: "Expired (3d limit)" };
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;

    if (days > 0) {
      return { isExpired: false, timeLeftText: `${days}d ${remainingHours}h left` };
    } else if (hours > 0) {
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      return { isExpired: false, timeLeftText: `${hours}h ${minutes}m left` };
    } else {
      const minutes = Math.max(1, Math.floor(diff / (1000 * 60)));
      return { isExpired: false, timeLeftText: `${minutes}m left` };
    }
  }

  function openScreenshotInNewWindow(dataUrl: string, orderId: string, customerName: string) {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Payment Screenshot - Order ${orderId} (${customerName})</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <style>
            body {
              margin: 0;
              background: #19120c;
              color: #f5ede0;
              font-family: system-ui, -apple-system, sans-serif;
              min-height: 100vh;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              padding: 20px;
              box-sizing: border-box;
            }
            .card {
              background: #281910;
              border: 1px solid #4a3020;
              border-radius: 16px;
              padding: 20px;
              max-width: 900px;
              width: 100%;
              box-shadow: 0 20px 50px rgba(0,0,0,0.6);
              text-align: center;
            }
            h2 { margin: 0 0 6px 0; font-size: 1.3rem; color: #f5d09b; }
            p { margin: 0 0 16px 0; font-size: 0.85rem; color: #c49c7f; }
            img {
              max-width: 100%;
              max-height: 80vh;
              object-fit: contain;
              border-radius: 8px;
              border: 1px solid #5a3c28;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>Order ${orderId} — Payment Screenshot</h2>
            <p>Customer: ${customerName}</p>
            <img src="${dataUrl}" alt="Payment Screenshot" />
          </div>
        </body>
      </html>
    `);
    win.document.close();
  }

  async function deleteScreenshotEarly(id: string) {
    const res = await fetch(`/api/admin/orders/${id}/screenshot`, {
      method: "DELETE",
    });
    if (res.ok) {
      setNotice(`Payment screenshot for order ${id} deleted to save cloud storage.`);
      setSelectedScreenshotOrder(null);
      load();
    } else {
      setNotice("Failed to delete screenshot.");
    }
  }
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
      fetch(`/api/admin/orders?_t=${Date.now()}`, { cache: "no-store" })
        .then((r) => r.json())
        .catch(() => []),
      fetch("/api/products").then((r) => r.json()),
      fetch(`/api/settings/payment?_t=${Date.now()}`, { cache: "no-store" })
        .then((r) => r.json())
        .catch(() => ({ upiId: "" })),
    ]);

    // Merge server orders and any client-saved orders so orders are never lost
    const localOrders: Order[] =
      typeof window !== "undefined"
        ? JSON.parse(localStorage.getItem("candlemate_orders") || "[]")
        : [];
    const serverOrders: Order[] = Array.isArray(o) ? o : [];

    const orderMap = new Map<string, Order>();
    for (const order of [...localOrders, ...serverOrders]) {
      if (order && order.id) {
        orderMap.set(order.id, order);
      }
    }
    const merged = Array.from(orderMap.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    setOrders(merged);
    setProducts(p);
    const activeUpi =
      (typeof window !== "undefined" && localStorage.getItem("candlemate_upi_id")) ||
      s?.upiId ||
      "";
    if (activeUpi) setUpi(activeUpi);
  }

  useEffect(() => {
    load();

    const handleIncomingNewOrder = (incoming: Order) => {
      if (!incoming || !incoming.id) return;
      setOrders((prev) => {
        if (prev.some((o) => o.id === incoming.id)) return prev;
        playOrderChime();
        setNewOrderAlert(incoming);
        try {
          const stored = JSON.parse(localStorage.getItem("candlemate_orders") || "[]");
          if (!stored.some((o: any) => o.id === incoming.id)) {
            localStorage.setItem("candlemate_orders", JSON.stringify([incoming, ...stored]));
          }
        } catch {}
        return [incoming, ...prev];
      });
    };

    // 1. Instant Tab-to-Tab Broadcast Channel (0ms latency)
    let channel: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      try {
        channel = new BroadcastChannel("candlemate_orders_stream");
        channel.onmessage = (e) => {
          if (e.data?.type === "NEW_ORDER" && e.data.order) {
            handleIncomingNewOrder(e.data.order);
          }
        };
      } catch {}
    }

    // 2. Storage event listener (instant cross-window notification)
    const onStorage = (e: StorageEvent) => {
      if (e.key === "candlemate_latest_order_event" && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed?.order) {
            handleIncomingNewOrder(parsed.order);
          }
        } catch {}
      }
    };
    window.addEventListener("storage", onStorage);

    // 3. Live order stream via Server-Sent Events (SSE)
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource("/api/orders/live");
      eventSource.onopen = () => {
        setIsLiveConnected(true);
      };
      eventSource.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === "NEW_ORDER" && data.order) {
            handleIncomingNewOrder(data.order);
          } else if (data.type === "STATUS_UPDATED") {
            setOrders((prev) =>
              prev.map((o) => (o.id === data.id ? { ...o, status: data.status } : o))
            );
          } else if (data.type === "SCREENSHOT_DELETED") {
            setOrders((prev) =>
              prev.map((o) =>
                o.id === data.id
                  ? { ...o, screenshot: undefined, screenshotExpired: true }
                  : o
              )
            );
          }
        } catch {}
      };
      eventSource.onerror = () => {
        setIsLiveConnected(false);
      };
    } catch {
      setIsLiveConnected(false);
    }

    // 4. Ultra-fast polling heartbeat every 1.5s to ensure orders arrive within 2 seconds across any device
    const pollInterval = setInterval(() => {
      fetch(`/api/admin/orders?_t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      })
        .then((r) => r.json())
        .then((freshOrders) => {
          if (Array.isArray(freshOrders)) {
            setOrders((prev) => {
              const prevMap = new Map(prev.map((o) => [o.id, o]));
              let hasNew = false;
              let newestOrder: Order | null = null;
              for (const fo of freshOrders) {
                if (fo && fo.id && !prevMap.has(fo.id)) {
                  prevMap.set(fo.id, fo);
                  hasNew = true;
                  newestOrder = fo;
                }
              }
              if (hasNew && newestOrder) {
                playOrderChime();
                setNewOrderAlert(newestOrder);
                try {
                  const stored = JSON.parse(localStorage.getItem("candlemate_orders") || "[]");
                  const merged = Array.from(prevMap.values());
                  localStorage.setItem("candlemate_orders", JSON.stringify(merged));
                } catch {}
              }
              return Array.from(prevMap.values()).sort(
                (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              );
            });
          }
        })
        .catch(() => {});
    }, 1500);

    return () => {
      if (eventSource) eventSource.close();
      if (channel) channel.close();
      window.removeEventListener("storage", onStorage);
      clearInterval(pollInterval);
    };
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
    const cleanUpi = upi.trim();
    const r = await fetch("/api/admin/settings/payment", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ upiId: cleanUpi }),
    });
    if (r.ok) {
      if (typeof window !== "undefined") {
        localStorage.setItem("candlemate_upi_id", cleanUpi);
      }
      setNotice("Payment details saved. Checkout QR code updated.");
    } else {
      const data = await r.json().catch(() => ({}));
      setNotice(data.error || "Please use a valid UPI ID.");
    }
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
      <header className="border-b bg-[#fff8ed] sticky top-0 z-30 shadow-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Link href="/" className="display text-2xl">
            candlemate<span className="text-gold">.</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200 shadow-xs">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              {isLiveConnected ? "Studio Live Stream Connected" : "Studio Auto-Sync Active"}
            </span>
            <span className="rounded-full bg-[#e9d5b8] px-3 py-1 text-xs font-medium text-[#765442]">
              Studio dashboard
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-9">
        {/* Real-time New Order Received Banner */}
        {newOrderAlert && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-[#ffeacc] via-[#fedbb3] to-[#ffe5c4] p-4 border-2 border-[#e5832d] shadow-lg animate-pulse">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-ink text-2xl text-white shadow-sm">
                🕯️
              </span>
              <div>
                <p className="text-sm font-bold text-ink flex items-center gap-2">
                  <span>New Customer Order Received!</span>
                  <span className="rounded-full bg-clay text-white text-[11px] px-2 py-0.5 font-semibold">
                    {newOrderAlert.id}
                  </span>
                  <span className="text-xs font-bold text-clay">₹{newOrderAlert.total}</span>
                </p>
                <p className="text-xs text-[#765442] mt-0.5">
                  Customer: <b>{newOrderAlert.customer.name}</b> ({newOrderAlert.customer.phone}) · {newOrderAlert.customer.address}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {newOrderAlert.screenshot && (
                <button
                  type="button"
                  onClick={() => setSelectedScreenshotOrder(newOrderAlert)}
                  className="rounded-xl bg-ink px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-clay transition shadow-sm cursor-pointer"
                >
                  View Payment Proof
                </button>
              )}
              <button
                type="button"
                onClick={() => setNewOrderAlert(null)}
                className="rounded-xl border border-[#8a61483a] bg-white px-3 py-1.5 text-xs font-medium text-[#765442] hover:bg-stone-100 transition cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

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
                        <div className="flex flex-col gap-1 py-1">
                          <button
                            type="button"
                            onClick={() => setSelectedScreenshotOrder(o)}
                            className="group flex items-center gap-2.5 rounded-xl border border-[#8a61482a] bg-[#fffaf3] p-1.5 hover:border-clay hover:shadow-md transition text-left cursor-pointer"
                            title="Click to view full payment screenshot"
                          >
                            <div className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-lg bg-stone-100 border border-[#8a614818]">
                              <img
                                src={o.screenshot}
                                alt="Payment proof thumbnail"
                                className="h-full w-full object-cover group-hover:scale-105 transition"
                              />
                            </div>
                            <div className="min-w-0 pr-1">
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-clay underline">
                                View Proof
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </span>
                              <p className="text-[10px] text-[#8a4e1d] font-medium mt-0.5">
                                ⏱ {getScreenshotExpiryInfo(o.createdAt, o.screenshotExpiresAt).timeLeftText}
                              </p>
                            </div>
                          </button>
                        </div>
                      ) : o.screenshotExpired || getScreenshotExpiryInfo(o.createdAt, o.screenshotExpiresAt).isExpired ? (
                        <div className="inline-flex flex-col text-xs text-[#9a7b6a] py-1">
                          <span className="inline-flex items-center gap-1 rounded-md bg-stone-100 px-2 py-1 font-medium text-stone-500 border border-stone-200">
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Expired (3d limit)
                          </span>
                          <span className="text-[10px] text-stone-400 mt-0.5">Purged from storage</span>
                        </div>
                      ) : (
                        <span className="text-xs text-[#9a7b6a]">—</span>
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
              <p className="mt-2 text-xs text-[#765442]/70">
                Tip: You can also set <code>UPI_ID</code> or <code>NEXT_PUBLIC_UPI_ID</code> in Cloudflare Pages Environment Variables for instant edge deployment.
              </p>
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

      {/* Payment Screenshot Viewer Modal */}
      {selectedScreenshotOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setSelectedScreenshotOrder(null)}
        >
          <div
            className="relative flex max-h-[92vh] w-full max-w-3xl flex-col rounded-3xl bg-[#fff8ed] shadow-2xl border border-[#8a61483a] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#8a614820] bg-[#f5ede0] px-6 py-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="display text-xl text-ink font-bold">
                    Payment Verification: {selectedScreenshotOrder.id}
                  </h3>
                  <span className="rounded-full bg-clay/15 px-2.5 py-0.5 text-xs font-semibold text-clay">
                    {selectedScreenshotOrder.status}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-[#765442]">
                  Customer: <b className="text-ink">{selectedScreenshotOrder.customer.name}</b> · Phone: <b className="text-ink">{selectedScreenshotOrder.customer.phone}</b> · Order Total: <b className="text-clay">₹{selectedScreenshotOrder.total}</b>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedScreenshotOrder(null)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-lg font-bold text-[#765442] hover:bg-clay hover:text-white transition shadow-sm"
                title="Close modal"
              >
                ✕
              </button>
            </div>

            {/* 3-Day Cloud Storage Expiry Notice */}
            <div className="flex items-center justify-between bg-[#fff0db] px-6 py-2.5 text-xs text-[#8a4e1d] border-b border-[#f0cca3]">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#e5832d] animate-pulse" />
                <span>
                  <b>3-Day Cloud Retention:</b> This payment proof will automatically expire and be deleted from cloud storage in <b>{getScreenshotExpiryInfo(selectedScreenshotOrder.createdAt, selectedScreenshotOrder.screenshotExpiresAt).timeLeftText}</b>.
                </span>
              </div>
            </div>

            {/* Image Display Body */}
            <div className="flex-1 overflow-auto bg-[#2b1911] p-4 flex items-center justify-center min-h-[360px]">
              {selectedScreenshotOrder.screenshot ? (
                <img
                  src={selectedScreenshotOrder.screenshot}
                  alt={`Payment screenshot for order ${selectedScreenshotOrder.id}`}
                  className="max-h-[60vh] max-w-full rounded-xl object-contain shadow-2xl border border-white/10"
                />
              ) : (
                <div className="text-center p-12 text-stone-300">
                  <p className="text-base font-semibold">Screenshot Expired</p>
                  <p className="text-xs text-stone-400 mt-1">
                    This payment screenshot was automatically purged after 3 days to preserve cloud storage.
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#f5ede0] px-6 py-3.5 border-t border-[#8a614820]">
              <div className="flex items-center gap-2">
                {selectedScreenshotOrder.screenshot && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        openScreenshotInNewWindow(
                          selectedScreenshotOrder.screenshot!,
                          selectedScreenshotOrder.id,
                          selectedScreenshotOrder.customer.name
                        )
                      }
                      className="rounded-xl border border-[#8a61483a] bg-white px-3.5 py-2 text-xs font-medium text-clay hover:bg-clay hover:text-white transition shadow-sm cursor-pointer"
                    >
                      Open in New Tab ↗
                    </button>
                    <a
                      href={selectedScreenshotOrder.screenshot}
                      download={`payment-order-${selectedScreenshotOrder.id}.jpg`}
                      className="rounded-xl bg-ink px-3.5 py-2 text-xs font-medium text-white hover:bg-clay transition shadow-sm"
                    >
                      Download Proof ↓
                    </a>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                {selectedScreenshotOrder.screenshot && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (
                        confirm(
                          `Delete screenshot for order ${selectedScreenshotOrder.id} early to save cloud storage?`
                        )
                      ) {
                        await deleteScreenshotEarly(selectedScreenshotOrder.id);
                      }
                    }}
                    className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-medium text-red-700 hover:bg-red-600 hover:text-white transition cursor-pointer"
                  >
                    Delete Now (Save Storage)
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedScreenshotOrder(null)}
                  className="rounded-xl border border-[#8a61483a] bg-white px-4 py-2 text-xs font-medium text-ink hover:bg-stone-100 transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
