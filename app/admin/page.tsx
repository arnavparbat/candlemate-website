"use client";

import { useEffect, useState } from "react";
import { Order, OrderStatus, Product } from "@/lib/types";
import { supabase, getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import Link from "next/link";

const statuses: OrderStatus[] = [
  "Payment Pending",
  "Order Received",
  "Preparing",
  "Out for Delivery",
  "Delivered",
];

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

  // Product Edit State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    price: string | number;
    description: string;
    burnTime: string;
    ingredients: string;
    wickSize: string;
    candleDimensions: string;
    fragrance: string;
    category: string;
    images: string[];
    available: boolean;
  }>({
    name: "",
    price: "",
    description: "",
    burnTime: "",
    ingredients: "",
    wickSize: "",
    candleDimensions: "",
    fragrance: "",
    category: "Jar candle",
    images: [],
    available: true,
  });
  const [editSpecsEnabled, setEditSpecsEnabled] = useState<{
    wickSize: boolean;
    candleDimensions: boolean;
    fragrance: boolean;
    burnTime: boolean;
    ingredients: boolean;
    description: boolean;
  }>({
    wickSize: false,
    candleDimensions: false,
    fragrance: false,
    burnTime: false,
    ingredients: false,
    description: false,
  });
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [editNewImageUrl, setEditNewImageUrl] = useState("");
  const [isProcessingEditPhoto, setIsProcessingEditPhoto] = useState(false);

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
  const [draft, setDraft] = useState<{
    name: string;
    price: string | number;
    category: string;
    images: string;
    available: boolean;
    wickSize: string;
    candleDimensions: string;
    fragrance: string;
    burnTime: string;
    ingredients: string;
    description: string;
  }>({
    name: "",
    price: "",
    category: "Jar candle",
    images: "",
    available: true,
    wickSize: "",
    candleDimensions: "",
    fragrance: "",
    burnTime: "",
    ingredients: "",
    description: "",
  });

  const [draftSpecsEnabled, setDraftSpecsEnabled] = useState<{
    wickSize: boolean;
    candleDimensions: boolean;
    fragrance: boolean;
    burnTime: boolean;
    ingredients: boolean;
    description: boolean;
  }>({
    wickSize: false,
    candleDimensions: false,
    fragrance: false,
    burnTime: false,
    ingredients: false,
    description: false,
  });

  async function load() {
    let o: Order[] = [];
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .neq("id", "__SYSTEM_STORE_PRODUCTS__")
        .neq("status", "SYSTEM_INTERNAL")
        .order("created_at", { ascending: false });

      if (!error && data) {
        o = data.map((row: any): Order => {
          const isCashfree = row.payment_method === "Cashfree Gateway" || row.screenshot?.startsWith("CASHFREE_");
          const isPaid =
            row.status === "Order Received" &&
            (row.payment_status === "SUCCESS" || row.screenshot?.startsWith("CASHFREE_AUTO_VERIFIED"));
          const cfPaymentId = row.screenshot?.startsWith("CASHFREE_AUTO_VERIFIED:")
            ? row.screenshot.split(":")[1]
            : undefined;

          return {
            id: row.id,
            customer: {
              name: row.customer_name,
              phone: row.customer_phone,
              address: row.customer_address,
            },
            items: row.items || [],
            total: Number(row.total),
            status: row.status,
            screenshot: row.screenshot,
            screenshotExpired: !row.screenshot && Boolean(row.screenshot_expired),
            screenshotExpiresAt: row.screenshot_expires_at,
            createdAt: row.created_at,
            paymentMethod: isCashfree ? "Cashfree Gateway" : undefined,
            paymentStatus: isPaid ? "SUCCESS" : row.status === "Payment Pending" ? "PENDING" : undefined,
            cashfreePaymentId: cfPaymentId,
            transactionId: cfPaymentId,
          };
        });
      } else {
        o = await fetch("/api/admin/orders").then((r) => r.json());
      }
    } else {
      o = await fetch("/api/admin/orders").then((r) => r.json());
    }

    const [p, s] = await Promise.all([
      fetch("/api/products").then((r) => r.json()),
      fetch("/api/settings/payment").then((r) => r.json()),
    ]);
    setOrders(o);
    setProducts(p);
    setUpi(s.upiId);

    // Background auto-reconciliation: Automatically re-check any pending Cashfree orders
    if (Array.isArray(o)) {
      const pendingCfOrders = o.filter(
        (order) =>
          (order.status === "Payment Pending" || order.paymentStatus === "PENDING") &&
          (order.paymentMethod === "Cashfree Gateway" || order.screenshot?.startsWith("CASHFREE_"))
      );
      if (pendingCfOrders.length > 0) {
        pendingCfOrders.forEach((pendingOrder) => {
          fetch(`/api/payment/cashfree/verify?orderId=${encodeURIComponent(pendingOrder.id)}`)
            .then((r) => r.json())
            .then((res) => {
              if (res.verified) {
                setOrders((prev) =>
                  prev.map((ord) =>
                    ord.id === pendingOrder.id
                      ? {
                          ...ord,
                          status: "Order Received",
                          paymentStatus: "SUCCESS",
                          screenshot: `CASHFREE_AUTO_VERIFIED:${res.paymentId || "PAID"}`,
                          transactionId: res.paymentId || "PAID",
                          cashfreePaymentId: res.paymentId || "PAID",
                        }
                      : ord
                  )
                );
              }
            })
            .catch(() => {});
        });
      }
    }
  }

  useEffect(() => {
    load();

    // 1. Supabase Realtime WebSockets: Instant <50ms push with ZERO serverless timeouts
    let supabaseChannel: any = null;
    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      if (supabase) {
        supabaseChannel = supabase
          .channel("studio-orders-realtime")
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "orders" },
            (payload) => {
              const row = payload.new;
              if (row.id === "__SYSTEM_STORE_PRODUCTS__" || row.status === "SYSTEM_INTERNAL") return;
              const newOrder: Order = {
                id: row.id,
                customer: {
                  name: row.customer_name,
                  phone: row.customer_phone,
                  address: row.customer_address,
                },
                items: row.items || [],
                total: Number(row.total),
                status: row.status,
                screenshot: row.screenshot,
                screenshotExpired: !row.screenshot && Boolean(row.screenshot_expired),
                screenshotExpiresAt: row.screenshot_expires_at,
                createdAt: row.created_at,
              };

              setOrders((prev) => {
                if (prev.some((o) => o.id === newOrder.id)) return prev;
                return [newOrder, ...prev];
              });
              setNewOrderAlert(newOrder);
              playOrderChime();
            }
          )
          .on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "orders" },
            (payload) => {
              const row = payload.new;
              if (row.id === "__SYSTEM_STORE_PRODUCTS__" || row.status === "SYSTEM_INTERNAL") return;
              setOrders((prev) =>
                prev.map((o) =>
                  o.id === row.id
                    ? {
                        ...o,
                        status: row.status,
                        screenshot: row.screenshot,
                        screenshotExpired: !row.screenshot && Boolean(row.screenshot_expired),
                      }
                    : o
                )
              );
            }
          )
          .subscribe((status) => {
            if (status === "SUBSCRIBED") {
              setIsLiveConnected(true);
            }
          });
      }
    }

    // 2. Server-Sent Events (SSE) stream fallback (for dedicated order server or local dev)
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
            setOrders((prev) => {
              if (prev.some((o) => o.id === data.order.id)) return prev;
              return [data.order, ...prev];
            });
            setNewOrderAlert(data.order);
            playOrderChime();
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
        if (!isSupabaseConfigured()) {
          setIsLiveConnected(false);
        }
      };
    } catch {
      if (!isSupabaseConfigured()) {
        setIsLiveConnected(false);
      }
    }

    // 3. Heartbeat polling every 10 seconds to ensure no order is ever missed under any network condition
    const pollInterval = setInterval(() => {
      fetch("/api/admin/orders")
        .then((r) => r.json())
        .then((freshOrders) => {
          if (Array.isArray(freshOrders)) {
            setOrders((prev) => {
              if (freshOrders.length > prev.length && prev.length > 0) {
                const newest = freshOrders[0];
                if (!prev.some((o) => o.id === newest.id)) {
                  playOrderChime();
                  setNewOrderAlert(newest);
                }
              }
              return freshOrders;
            });
          }
        })
        .catch(() => {});
    }, 10000);

    return () => {
      if (supabaseChannel) {
        const supabase = getSupabase();
        supabase?.removeChannel(supabaseChannel);
      }
      if (eventSource) eventSource.close();
      clearInterval(pollInterval);
    };
  }, []);

  async function status(id: string, newStatus: OrderStatus) {
    // Optimistic UI update so studio admin sees immediate change
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: newStatus } : o))
    );
    if (isSupabaseConfigured()) {
      await supabase.from("orders").update({ status: newStatus }).eq("id", id);
    }
    await fetch(`/api/admin/orders/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setNotice(`Updated order ${id} to "${newStatus}"`);
    load();
  }

  async function verifyGatewayOrder(orderId: string) {
    setNotice(`Querying Cashfree API for order ${orderId}...`);
    try {
      const res = await fetch(`/api/payment/cashfree/verify?orderId=${encodeURIComponent(orderId)}`);
      const data = await res.json();
      if (data.verified) {
        setNotice(`✓ Order ${orderId} is CONFIRMED PAID by Cashfree!`);
        playOrderChime();
        load();
      } else {
        setNotice(`Cashfree reports order ${orderId} status: ${data.status || "PENDING"}`);
      }
    } catch (err: any) {
      setNotice(`Failed to check Cashfree: ${err.message}`);
    }
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

    if (!draft.name.trim()) {
      setNotice("Please enter a candle name.");
      return;
    }

    const numPrice = Number(draft.price);
    if (isNaN(numPrice) || numPrice < 0) {
      setNotice("Please enter a valid candle price in ₹.");
      return;
    }

    const urlImages = draft.images
      .split("\n")
      .map((s: string) => s.trim())
      .filter(Boolean);
    const finalImages = [...uploadedPhotos, ...urlImages];

    if (!finalImages.length) {
      setNotice("Please add at least one product photo (upload from device or enter URL).");
      return;
    }

    // Strict validation for ticked specifications: if ticked, MUST be filled!
    if (draftSpecsEnabled.wickSize && !draft.wickSize.trim()) {
      setNotice("Please fill in Wick Size or untick the checkbox to exclude it.");
      return;
    }
    if (draftSpecsEnabled.candleDimensions && !draft.candleDimensions.trim()) {
      setNotice("Please fill in Candle Length & Breadth or untick the checkbox to exclude it.");
      return;
    }
    if (draftSpecsEnabled.fragrance && !draft.fragrance.trim()) {
      setNotice("Please fill in Fragrance or untick the checkbox to exclude it.");
      return;
    }
    if (draftSpecsEnabled.burnTime && !draft.burnTime.trim()) {
      setNotice("Please fill in Burn Time or untick the checkbox to exclude it.");
      return;
    }
    if (draftSpecsEnabled.ingredients && !draft.ingredients.trim()) {
      setNotice("Please fill in Ingredients or untick the checkbox to exclude it.");
      return;
    }
    if (draftSpecsEnabled.description && !draft.description.trim()) {
      setNotice("Please fill in Description or untick the checkbox to exclude it.");
      return;
    }

    await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: draft.name.trim(),
        price: numPrice,
        category: draft.category || "Jar candle",
        available: draft.available !== false,
        images: finalImages,
        wickSize: draftSpecsEnabled.wickSize ? draft.wickSize.trim() : "",
        candleDimensions: draftSpecsEnabled.candleDimensions ? draft.candleDimensions.trim() : "",
        fragrance: draftSpecsEnabled.fragrance ? draft.fragrance.trim() : "",
        burnTime: draftSpecsEnabled.burnTime ? draft.burnTime.trim() : "",
        ingredients: draftSpecsEnabled.ingredients ? draft.ingredients.trim() : "",
        description: draftSpecsEnabled.description ? draft.description.trim() : "",
      }),
    });

    setDraft({
      name: "",
      price: "",
      category: "Jar candle",
      images: "",
      available: true,
      wickSize: "",
      candleDimensions: "",
      fragrance: "",
      burnTime: "",
      ingredients: "",
      description: "",
    });
    setDraftSpecsEnabled({
      wickSize: false,
      candleDimensions: false,
      fragrance: false,
      burnTime: false,
      ingredients: false,
      description: false,
    });
    setUploadedPhotos([]);
    setNotice("Product added to the collection.");
    load();
  }

  function startEditingProduct(p: Product) {
    setEditingProduct(p);
    const hasWick = Boolean(p.wickSize && p.wickSize.trim());
    const hasDimensions = Boolean(p.candleDimensions && p.candleDimensions.trim());
    const hasFragrance = Boolean(p.fragrance && p.fragrance.trim());
    const hasBurnTime = Boolean(p.burnTime && p.burnTime.trim());
    const hasIngredients = Boolean(p.ingredients && p.ingredients.trim());
    const hasDescription = Boolean(p.description && p.description.trim());

    setEditSpecsEnabled({
      wickSize: hasWick,
      candleDimensions: hasDimensions,
      fragrance: hasFragrance,
      burnTime: hasBurnTime,
      ingredients: hasIngredients,
      description: hasDescription,
    });

    setEditForm({
      name: p.name || "",
      price: p.price ?? "",
      category: p.category || "Jar candle",
      images: Array.isArray(p.images) ? [...p.images] : [],
      available: p.available !== false,
      wickSize: p.wickSize || "",
      candleDimensions: p.candleDimensions || "",
      fragrance: p.fragrance || "",
      burnTime: p.burnTime || "",
      ingredients: p.ingredients || "",
      description: p.description || "",
    });
    setEditNewImageUrl("");
  }

  function closeEditingProduct() {
    if (isSavingProduct) return;
    setEditingProduct(null);
  }

  async function handleEditProductPhotoFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setIsProcessingEditPhoto(true);
    setNotice("Processing photos from your device...");
    try {
      const urls: string[] = [];
      for (const file of files) {
        const optimized = await fileToOptimizedDataUrl(file);
        urls.push(optimized);
      }
      setEditForm((prev) => ({
        ...prev,
        images: [...prev.images, ...urls],
      }));
      setNotice(`Added ${urls.length} photo(s) to ${editForm.name || "candle"}.`);
    } catch {
      setNotice("Failed to process one or more photos.");
    } finally {
      setIsProcessingEditPhoto(false);
      e.target.value = "";
    }
  }

  function addEditImageUrl() {
    const trimmed = editNewImageUrl.trim();
    if (!trimmed) return;
    setEditForm((prev) => ({
      ...prev,
      images: [...prev.images, trimmed],
    }));
    setEditNewImageUrl("");
  }

  function removeEditPhoto(index: number) {
    if (editForm.images.length <= 1) {
      setNotice("Product must have at least one photo.");
      return;
    }
    setEditForm((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  }

  function makeCoverPhoto(index: number) {
    if (index === 0) return;
    setEditForm((prev) => {
      const selected = prev.images[index];
      const rest = prev.images.filter((_, i) => i !== index);
      return {
        ...prev,
        images: [selected, ...rest],
      };
    });
  }

  async function saveEditedProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!editingProduct) return;

    if (!editForm.name.trim()) {
      setNotice("Please enter a candle name.");
      return;
    }

    const numPrice = Number(editForm.price);
    if (isNaN(numPrice) || numPrice < 0) {
      setNotice("Please enter a valid price in rupees.");
      return;
    }

    if (!editForm.images || !editForm.images.length) {
      setNotice("The candle must have at least one photo.");
      return;
    }

    // Strict validation for ticked specifications: if ticked, MUST be filled!
    if (editSpecsEnabled.wickSize && !editForm.wickSize.trim()) {
      setNotice("Please fill in Wick Size or untick the checkbox to exclude it.");
      return;
    }
    if (editSpecsEnabled.candleDimensions && !editForm.candleDimensions.trim()) {
      setNotice("Please fill in Candle Length & Breadth or untick the checkbox to exclude it.");
      return;
    }
    if (editSpecsEnabled.fragrance && !editForm.fragrance.trim()) {
      setNotice("Please fill in Fragrance or untick the checkbox to exclude it.");
      return;
    }
    if (editSpecsEnabled.burnTime && !editForm.burnTime.trim()) {
      setNotice("Please fill in Burn Time or untick the checkbox to exclude it.");
      return;
    }
    if (editSpecsEnabled.ingredients && !editForm.ingredients.trim()) {
      setNotice("Please fill in Ingredients or untick the checkbox to exclude it.");
      return;
    }
    if (editSpecsEnabled.description && !editForm.description.trim()) {
      setNotice("Please fill in Description or untick the checkbox to exclude it.");
      return;
    }

    setIsSavingProduct(true);
    setNotice(`Saving changes for "${editForm.name}"...`);

    try {
      const payload: Product = {
        id: editingProduct.id,
        name: editForm.name.trim(),
        price: numPrice,
        category: editForm.category.trim(),
        images: editForm.images,
        available: editForm.available,
        wickSize: editSpecsEnabled.wickSize ? editForm.wickSize.trim() : "",
        candleDimensions: editSpecsEnabled.candleDimensions ? editForm.candleDimensions.trim() : "",
        fragrance: editSpecsEnabled.fragrance ? editForm.fragrance.trim() : "",
        burnTime: editSpecsEnabled.burnTime ? editForm.burnTime.trim() : "",
        ingredients: editSpecsEnabled.ingredients ? editForm.ingredients.trim() : "",
        description: editSpecsEnabled.description ? editForm.description.trim() : "",
      };

      const res = await fetch(`/api/products/${encodeURIComponent(editingProduct.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }

      const updated = await res.json();

      // Immediately update local admin state so UI reflects edits instantly
      setProducts((prev) =>
        prev.map((item) => (item.id === editingProduct.id ? updated : item))
      );

      setNotice(`✓ "${updated.name}" updated! Changes are now live on the customer store.`);
      setEditingProduct(null);
      load(); // re-verify in background
    } catch (err: any) {
      setNotice(`Failed to save changes: ${err.message}`);
    } finally {
      setIsSavingProduct(false);
    }
  }

  async function updateProduct(p: Product, patch: Partial<Product>) {
    await fetch(`/api/products/${encodeURIComponent(p.id)}`, {
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
      await fetch(`/api/products/${encodeURIComponent(id)}`, { method: "DELETE" });
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
      <header className="border-b bg-[#fff8ed] sticky top-0 z-30 shadow-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-3.5 sm:px-5 py-3 sm:py-4">
          <Link href="/" className="flex items-center gap-2 group">
            <img
              src="/logo.png"
              alt="Candlemate"
              className="h-7 w-auto object-contain sm:hidden"
            />
            <img
              src="/logo-wordmark.png"
              alt="Candlemate"
              className="h-5 sm:h-7 w-auto object-contain"
            />
          </Link>
          <div className="flex items-center gap-1.5 sm:gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-semibold text-emerald-800 border border-emerald-200 shadow-xs">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="hidden sm:inline">{isLiveConnected ? "Studio Live Stream Connected" : "Studio Auto-Sync Active"}</span>
              <span className="sm:hidden">{isLiveConnected ? "Live" : "Synced"}</span>
            </span>
            <span className="rounded-full bg-[#e9d5b8] px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-medium text-[#765442]">
              <span className="hidden sm:inline">Studio dashboard</span>
              <span className="sm:hidden">Studio</span>
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-3.5 py-6 sm:px-5 sm:py-9">
        {/* Real-time New Order Received Banner */}
        {newOrderAlert && (
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-[#ffeacc] via-[#fedbb3] to-[#ffe5c4] p-3.5 sm:p-4 border-2 border-[#e5832d] shadow-lg animate-pulse">
            <div className="flex items-start sm:items-center gap-3">
              <span className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-2xl bg-ink text-xl sm:text-2xl text-white shadow-sm shrink-0">
                🕯️
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-ink flex items-center gap-1.5 flex-wrap">
                  <span>New Customer Order Received!</span>
                  <span className="rounded-full bg-clay text-white text-[10px] sm:text-[11px] px-2 py-0.5 font-semibold">
                    {newOrderAlert.id}
                  </span>
                  <span className="text-xs font-bold text-clay">₹{newOrderAlert.total}</span>
                </p>
                <p className="text-xs text-[#765442] mt-0.5 break-words">
                  Customer: <b>{newOrderAlert.customer.name}</b> (<a href={`tel:${newOrderAlert.customer.phone}`} className="underline">{newOrderAlert.customer.phone}</a>) · {newOrderAlert.customer.address}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap pt-2 sm:pt-0 border-t border-[#e5832d]/30 sm:border-t-0">
              {newOrderAlert.screenshot && !newOrderAlert.screenshot.startsWith("PHONEPE_") && !newOrderAlert.screenshot.startsWith("CASHFREE_") && (
                <button
                  type="button"
                  onClick={() => setSelectedScreenshotOrder(newOrderAlert)}
                  className="rounded-xl bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-clay transition shadow-sm cursor-pointer active:scale-95"
                >
                  View Payment Proof
                </button>
              )}
              {(newOrderAlert.screenshot?.startsWith("CASHFREE_") || newOrderAlert.paymentMethod === "Cashfree Gateway") && (
                <span className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
                  ⚡ Cashfree Auto-Verified
                </span>
              )}
              {newOrderAlert.screenshot?.startsWith("PHONEPE_") && (
                <span className="inline-flex items-center gap-1 rounded-xl bg-purple-700 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
                  ⚡ PhonePe Auto-Verified
                </span>
              )}
              <button
                type="button"
                onClick={() => setNewOrderAlert(null)}
                className="rounded-xl border border-[#8a61483a] bg-white px-3 py-1.5 text-xs font-medium text-[#765442] hover:bg-stone-100 transition cursor-pointer active:scale-95"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {notice && <p className="mb-5 rounded-xl bg-[#e5eedc] p-3 text-sm text-moss border border-[#c4dcbc]">{notice}</p>}
        <h1 className="display text-3xl sm:text-5xl font-bold text-ink tracking-tight">Good morning, maker.</h1>
        <p className="mt-1.5 text-xs sm:text-sm text-[#765442]">Orders, products and payment details in one calm place.</p>

        {/* Incoming Orders Section */}
        <section className="mt-8 sm:mt-10">
          <div className="mb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <h2 className="display text-2xl sm:text-3xl text-ink font-bold">Incoming orders</h2>
              <p className="mt-1 text-xs sm:text-sm text-[#765442]">
                {orders.length} order{orders.length === 1 ? "" : "s"} received
              </p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#765442] shrink-0 sm:hidden">Filter:</span>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full sm:w-auto rounded-xl border border-[#8a614830] bg-white px-3.5 py-2 text-base sm:text-sm text-ink outline-clay shadow-2xs font-medium cursor-pointer"
              >
                <option>All</option>
                {statuses.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Mobile Order Cards View (< md) - No horizontal scrolling */}
          <div className="space-y-3.5 md:hidden">
            {shown.map((o) => (
              <div
                key={o.id}
                className="rounded-2xl border border-[#8a614822] bg-white p-4 shadow-sm"
              >
                {/* Card Top: Order ID, Date, Amount */}
                <div className="flex items-start justify-between gap-2 border-b border-[#8a614815] pb-2.5">
                  <div>
                    <span className="font-mono text-xs font-bold text-clay bg-[#8a614810] px-2 py-0.5 rounded-md">
                      {o.id}
                    </span>
                    <p className="text-[11px] text-[#765442] mt-1">
                      📅 {new Date(o.createdAt).toLocaleDateString()} · {new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black text-clay">
                      ₹{o.total}
                    </span>
                  </div>
                </div>

                {/* Customer Details */}
                <div className="mt-3 rounded-xl bg-[#fffaf4] border border-[#8a614815] p-3 text-xs">
                  <p className="font-bold text-ink text-sm flex items-center gap-1.5">
                    <span>👤</span> {o.customer.name}
                  </p>
                  <p className="mt-1">
                    <a
                      href={`tel:${o.customer.phone}`}
                      className="inline-flex items-center gap-1 font-semibold text-clay underline hover:text-ink transition"
                    >
                      <span>📞</span> {o.customer.phone}
                    </a>
                  </p>
                  <p className="text-[#765442] mt-1 text-[11px] flex items-start gap-1 break-words">
                    <span>📍</span> <span>{o.customer.address}</span>
                  </p>
                </div>

                {/* Items Ordered */}
                <div className="mt-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#765442] mb-1">
                    Ordered Candles ({o.items.reduce((sum, item) => sum + (item.quantity || 1), 0)})
                  </p>
                  <div className="space-y-1">
                    {o.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs py-1 border-b border-[#8a61480f] last:border-0"
                      >
                        <span className="font-medium text-ink">
                          {item.quantity}× {item.name}
                        </span>
                        <span className="text-[#765442] font-semibold">
                          ₹{item.price * item.quantity}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payment Status & Proof */}
                <div className="mt-3 pt-2.5 border-t border-[#8a614815] flex items-center justify-between flex-wrap gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[#765442]">
                    Payment:
                  </span>
                  <div>
                    {o.paymentMethod === "Cashfree Gateway" || (o.screenshot && o.screenshot.startsWith("CASHFREE_")) ? (
                      o.paymentStatus === "FAILED" || o.status === "Payment Failed" ? (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-rose-50 border border-rose-200 px-2 py-0.5 text-xs font-semibold text-rose-700">
                          ✕ Cashfree Failed
                        </span>
                      ) : o.paymentStatus === "PENDING" || o.status === "Payment Pending" ? (
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-700">
                            ⏳ Cashfree Pending
                          </span>
                          <button
                            type="button"
                            onClick={() => verifyGatewayOrder(o.id)}
                            className="rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 px-2 py-0.5 text-[10px] font-bold"
                          >
                            🔄 Check
                          </button>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs font-bold text-blue-900">
                          ⚡ Cashfree Verified ✓
                        </span>
                      )
                    ) : o.paymentMethod === "PhonePe Gateway" || (o.screenshot && o.screenshot.startsWith("PHONEPE_")) ? (
                      o.paymentStatus === "FAILED" || o.status === "Payment Failed" ? (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-rose-50 border border-rose-200 px-2 py-0.5 text-xs font-semibold text-rose-700">
                          ✕ PhonePe Failed
                        </span>
                      ) : o.paymentStatus === "PENDING" || o.status === "Payment Pending" ? (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-700">
                          ⏳ PhonePe Pending
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-purple-50 border border-purple-200 px-2 py-0.5 text-xs font-bold text-purple-900">
                          ⚡ PhonePe Verified ✓
                        </span>
                      )
                    ) : o.screenshot ? (
                      <button
                        type="button"
                        onClick={() => setSelectedScreenshotOrder(o)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-clay/30 bg-[#fff8ed] px-2.5 py-1 text-xs font-semibold text-clay hover:bg-clay hover:text-white transition shadow-2xs active:scale-95"
                      >
                        <img src={o.screenshot} alt="" className="h-5 w-5 rounded object-cover" />
                        <span>View Proof Photo</span>
                        <span className="text-[10px] opacity-75">↗</span>
                      </button>
                    ) : o.screenshotExpired || getScreenshotExpiryInfo(o.createdAt, o.screenshotExpiresAt).isExpired ? (
                      <span className="text-[11px] text-stone-500 bg-stone-100 px-2 py-0.5 rounded">
                        Expired (Purged)
                      </span>
                    ) : (
                      <span className="text-xs text-[#9a7b6a]">—</span>
                    )}
                  </div>
                </div>

                {/* Order Status Selector */}
                <div className="mt-3 pt-2.5 border-t border-[#8a614815]">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#765442] mb-1">
                    Update Order Status
                  </label>
                  <select
                    value={o.status}
                    onChange={(e) => status(o.id, e.target.value as OrderStatus)}
                    className={`w-full rounded-xl border font-bold p-2.5 text-xs transition cursor-pointer shadow-2xs ${
                      o.status === "Delivered"
                        ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                        : o.status === "Out for Delivery"
                        ? "bg-purple-50 text-purple-800 border-purple-300"
                        : o.status === "Preparing"
                        ? "bg-amber-50 text-amber-800 border-amber-300"
                        : o.status === "Payment Pending"
                        ? "bg-orange-50 text-orange-800 border-orange-300"
                        : o.status === "Payment Failed"
                        ? "bg-rose-50 text-rose-800 border-rose-300"
                        : "bg-sky-50 text-sky-800 border-sky-300"
                    }`}
                  >
                    {statuses.map((s) => (
                      <option key={s} value={s}>
                        {s === "Delivered"
                          ? "✓ Delivered"
                          : s === "Out for Delivery"
                          ? "🚚 Out for Delivery"
                          : s === "Preparing"
                          ? "🕯️ Preparing"
                          : s === "Payment Pending"
                          ? "⏳ Payment Pending"
                          : s === "Payment Failed"
                          ? "✕ Payment Failed"
                          : "📋 Order Received"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
            {!shown.length && (
              <div className="rounded-2xl border border-[#8a614825] bg-white p-8 text-center text-xs text-[#765442]">
                No orders in this view yet.
              </div>
            )}
          </div>

          {/* Desktop Table View (>= md) */}
          <div className="hidden md:block overflow-x-auto rounded-2xl border border-[#8a61483a] bg-white">
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
                        <a href={`tel:${o.customer.phone}`} className="underline hover:text-ink">{o.customer.phone}</a>
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
                      {o.paymentMethod === "Cashfree Gateway" || (o.screenshot && o.screenshot.startsWith("CASHFREE_")) ? (
                        <div className="flex flex-col gap-1 py-1">
                          {o.paymentStatus === "FAILED" || o.status === "Payment Failed" ? (
                            <span className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 shadow-2xs">
                              <span className="h-2 w-2 rounded-full bg-rose-500" />
                              Cashfree Failed
                            </span>
                          ) : o.paymentStatus === "PENDING" || o.status === "Payment Pending" ? (
                            <div className="flex flex-col items-start gap-1">
                              <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-700 shadow-2xs">
                                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                                Cashfree Pending
                              </span>
                              <button
                                type="button"
                                onClick={() => verifyGatewayOrder(o.id)}
                                className="inline-flex items-center gap-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 px-2 py-0.5 text-[10px] font-bold transition cursor-pointer shadow-2xs"
                                title="Query Cashfree API to verify if customer payment was completed"
                              >
                                🔄 Check Status
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex flex-col gap-1 rounded-xl border border-blue-200 bg-blue-50/90 p-2 text-xs shadow-2xs">
                              <div className="flex items-center gap-1.5 font-bold text-blue-900">
                                <span className="flex h-2 w-2 relative">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
                                </span>
                                <span>⚡ Cashfree Verified ✓</span>
                              </div>
                              <div className="text-[10px] text-blue-800 font-mono break-all select-all">
                                {o.transactionId || o.cashfreePaymentId || (o.screenshot?.includes(":") ? o.screenshot.split(":")[1] : "CF-VERIFIED")}
                              </div>
                              <span className="text-[9px] text-blue-600 font-medium">Gateway S2S Confirmed</span>
                            </div>
                          )}
                        </div>
                      ) : o.paymentMethod === "PhonePe Gateway" || (o.screenshot && o.screenshot.startsWith("PHONEPE_")) ? (
                        <div className="flex flex-col gap-1 py-1">
                          {o.paymentStatus === "FAILED" || o.status === "Payment Failed" ? (
                            <span className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 shadow-2xs">
                              <span className="h-2 w-2 rounded-full bg-rose-500" />
                              PhonePe Failed
                            </span>
                          ) : o.paymentStatus === "PENDING" || o.status === "Payment Pending" ? (
                            <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-700 shadow-2xs">
                              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                              PhonePe Pending
                            </span>
                          ) : (
                            <div className="inline-flex flex-col gap-1 rounded-xl border border-purple-200 bg-purple-50/90 p-2 text-xs shadow-2xs">
                              <div className="flex items-center gap-1.5 font-bold text-purple-900">
                                <span className="flex h-2 w-2 relative">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-600"></span>
                                </span>
                                <span>⚡ PhonePe Verified ✓</span>
                              </div>
                              <div className="text-[10px] text-purple-700 font-mono break-all select-all">
                                {o.transactionId || (o.screenshot?.includes(":") ? o.screenshot.split(":")[1] : o.phonepeTransactionId || "S2S Verified")}
                              </div>
                              <span className="text-[9px] text-purple-500 font-medium">Gateway S2S Confirmed</span>
                            </div>
                          )}
                        </div>
                      ) : o.screenshot ? (
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
                      <div className="flex flex-col gap-1 py-1">
                        <select
                          value={o.status}
                          onChange={(e) => status(o.id, e.target.value as OrderStatus)}
                          className={`rounded-xl border font-semibold p-2 text-xs transition cursor-pointer shadow-2xs ${
                            o.status === "Delivered"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                              : o.status === "Out for Delivery"
                              ? "bg-purple-50 text-purple-800 border-purple-300"
                              : o.status === "Preparing"
                              ? "bg-amber-50 text-amber-800 border-amber-300"
                              : o.status === "Payment Pending"
                              ? "bg-orange-50 text-orange-800 border-orange-300"
                              : o.status === "Payment Failed"
                              ? "bg-rose-50 text-rose-800 border-rose-300"
                              : "bg-sky-50 text-sky-800 border-sky-300"
                          }`}
                        >
                          {statuses.map((s) => (
                            <option key={s} value={s}>
                              {s === "Delivered"
                                ? "✓ Delivered"
                                : s === "Out for Delivery"
                                ? "🚚 Out for Delivery"
                                : s === "Preparing"
                                ? "🕯️ Preparing"
                                : s === "Payment Pending"
                                ? "⏳ Payment Pending"
                                : s === "Payment Failed"
                                ? "✕ Payment Failed"
                                : "📋 Order Received"}
                            </option>
                          ))}
                        </select>
                      </div>
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
        <section className="mt-10 sm:mt-14 grid gap-8 lg:grid-cols-2">
          {/* Collection Column */}
          <div>
            <div className="flex items-center justify-between">
              <h2 className="display text-2xl sm:text-3xl font-bold text-ink">Collection</h2>
              <span className="text-xs font-semibold text-[#765442] bg-[#8a614815] px-2.5 py-1 rounded-full">
                {products.length} candle{products.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="mt-4 space-y-4">
              {products.map((p) => (
                <div
                  key={p.id}
                  className="rounded-2xl border border-[#8a614820] bg-white p-3.5 sm:p-4 shadow-sm"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
                    {/* Top Row for Mobile: Image + Details + Stock */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <img
                        src={p.images?.[0] || "/hero-candle.jpg"}
                        alt={p.name}
                        className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl object-cover border border-[#8a61481a] shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <b className="text-sm sm:text-base text-ink truncate font-bold">{p.name}</b>
                          <span className="rounded-full bg-[#8a614815] px-2 py-0.5 text-[10px] font-bold text-clay shrink-0">
                            {p.category}
                          </span>
                        </div>
                        <p className="text-sm font-extrabold text-clay mt-0.5">₹{p.price}</p>

                        {/* Active specifications badges */}
                        <div className="mt-1.5 flex flex-wrap gap-1 text-[10px]">
                          {p.fragrance && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-[#f4ece3] px-2 py-0.5 text-[#6c4832] font-medium">
                              🌸 {p.fragrance}
                            </span>
                          )}
                          {p.wickSize && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-[#f4ece3] px-2 py-0.5 text-[#6c4832] font-medium">
                              🕯️ Wick: {p.wickSize}
                            </span>
                          )}
                          {p.candleDimensions && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-[#f4ece3] px-2 py-0.5 text-[#6c4832] font-medium">
                              📏 {p.candleDimensions}
                            </span>
                          )}
                          {p.burnTime && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-[#f4ece3] px-2 py-0.5 text-[#6c4832] font-medium">
                              ⏳ {p.burnTime}
                            </span>
                          )}
                          {p.ingredients && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-[#f4ece3] px-2 py-0.5 text-[#6c4832] font-medium">
                              🌿 {p.ingredients}
                            </span>
                          )}
                        </div>

                        {p.description && (
                          <p className="text-xs text-[#765442]/80 line-clamp-2 mt-1.5 leading-relaxed">
                            {p.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 pt-2 sm:pt-0 border-t border-[#8a614810] sm:border-t-0 shrink-0">
                      <button
                        type="button"
                        onClick={() => updateProduct(p, { available: !p.available })}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition active:scale-95 cursor-pointer shadow-2xs ${
                          p.available
                            ? "bg-[#e5eedc] text-moss hover:bg-[#d5e4cc]"
                            : "bg-stone-200 text-stone-600 hover:bg-stone-300"
                        }`}
                      >
                        {p.available ? "✓ In stock" : "✕ Sold out"}
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(p.id)}
                        className="text-xs font-medium text-[#a94d3b] hover:underline p-1 active:scale-95 cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Action buttons: Edit, Photo, etc */}
                  <div className="mt-3 flex flex-wrap items-center gap-2 pt-2.5 border-t border-[#8a614812]">
                    <button
                      type="button"
                      onClick={() => startEditingProduct(p)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-ink text-white px-3.5 py-2 text-xs font-semibold hover:bg-clay transition shadow-2xs cursor-pointer active:scale-95"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <span>Edit Candle</span>
                    </button>

                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#8a61483a] bg-[#fff8ed] px-3 py-2 text-xs font-medium text-clay hover:bg-clay hover:text-white transition active:scale-95 shadow-2xs">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2 2v12a2 2 0 002 2z" />
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

                    <label className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-[#8a61482a] bg-white px-2.5 py-2 text-xs text-[#765442] hover:border-clay hover:text-clay transition active:scale-95 shadow-2xs">
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

                  {/* Gallery thumbnails for candle if multiple */}
                  {p.images && p.images.length > 1 && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#8a61481a] pt-2.5">
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
            <form onSubmit={add} className="mt-6 rounded-3xl border border-dashed border-[#a66a46] bg-[#fffaf2] p-4 sm:p-6 shadow-sm">
              <h3 className="display text-2xl sm:text-3xl font-bold text-ink">Add a candle</h3>
              <p className="mt-1 text-xs sm:text-sm text-[#765442]">
                Create a new candle for your storefront collection.
              </p>

              <div className="mt-4 grid gap-3.5 sm:grid-cols-3">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#765442]">
                  Candle Name *
                  <input
                    required
                    value={draft.name}
                    type="text"
                    placeholder="e.g. Amber & Sandalwood"
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-[#8a614830] bg-white p-3 text-base sm:text-sm text-ink outline-clay shadow-2xs font-medium"
                  />
                </label>
                <label className="text-xs font-semibold uppercase tracking-wider text-[#765442]">
                  Price (₹ INR) *
                  <div className="relative mt-1">
                    <span className="absolute left-3.5 top-3 text-sm font-bold text-[#765442]">₹</span>
                    <input
                      required
                      min="0"
                      step="1"
                      value={draft.price}
                      type="number"
                      placeholder="e.g. 649"
                      onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                      className="w-full rounded-xl border border-[#8a614830] bg-white pl-8 pr-3 py-3 text-base sm:text-sm font-bold text-ink outline-clay shadow-2xs"
                    />
                  </div>
                </label>
                <label className="text-xs font-semibold uppercase tracking-wider text-[#765442]">
                  Category *
                  <select
                    value={draft.category}
                    onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-[#8a614830] bg-white p-3 text-base sm:text-sm text-ink outline-clay shadow-2xs"
                  >
                    <option value="Jar candle">Jar candle</option>
                    <option value="Sculptural">Sculptural</option>
                    <option value="Flower candle">Flower candle</option>
                    <option value="Tin candle">Tin candle</option>
                    <option value="Wax melts">Wax melts</option>
                    <option value="Aromatherapy">Aromatherapy</option>
                  </select>
                </label>
              </div>

              {/* Removable / Tickable Specifications Section */}
              <div className="mt-5 rounded-2xl border border-[#8a614825] bg-[#fff6eb]/60 p-3.5 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[#8a614815] pb-2.5 mb-3">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-ink flex items-center gap-1.5">
                      <span>⚙️</span> Candle Specifications & Details (Tick to Include)
                    </h4>
                    <p className="text-[11px] text-[#765442] mt-0.5">
                      Tick to include a detail for this candle. If ticked, it <b>must be filled</b>. If unticked, you cannot write in it and it won&apos;t appear on the store.
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {/* 1. Wick Size (Wink size) */}
                  <div
                    className={`rounded-xl border p-3 transition-all ${
                      draftSpecsEnabled.wickSize
                        ? "border-emerald-300 bg-white shadow-2xs"
                        : "border-stone-200 bg-stone-100/70"
                    }`}
                  >
                    <label className="flex items-center justify-between cursor-pointer select-none py-0.5">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={draftSpecsEnabled.wickSize}
                          onChange={(e) =>
                            setDraftSpecsEnabled((p) => ({ ...p, wickSize: e.target.checked }))
                          }
                          className="h-4 w-4 rounded accent-[#9b4a1b] cursor-pointer"
                        />
                        <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                          <span>🕯️</span> Wick Size <span className="text-[10px] font-normal text-[#765442]">(Wink size)</span>
                        </span>
                      </div>
                      {draftSpecsEnabled.wickSize ? (
                        <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          ✓ Ticked (Must fill)
                        </span>
                      ) : (
                        <span className="rounded-md bg-stone-200 px-2 py-0.5 text-[10px] font-medium text-stone-600">
                          ✕ Unticked (Excluded)
                        </span>
                      )}
                    </label>
                    <div className="mt-2">
                      <input
                        type="text"
                        disabled={!draftSpecsEnabled.wickSize}
                        required={draftSpecsEnabled.wickSize}
                        value={draftSpecsEnabled.wickSize ? draft.wickSize : ""}
                        onChange={(e) => setDraft({ ...draft, wickSize: e.target.value })}
                        placeholder={
                          draftSpecsEnabled.wickSize
                            ? "e.g. 24-ply braided cotton wick or Double wood wick (Required)"
                            : "✕ Unticked - You cannot write here"
                        }
                        className={`w-full rounded-lg px-3 py-2.5 text-base sm:text-sm transition-all ${
                          draftSpecsEnabled.wickSize
                            ? "border border-[#8a614830] bg-white text-ink outline-clay"
                            : "border border-dashed border-stone-300 bg-stone-100/90 text-stone-400 cursor-not-allowed select-none"
                        }`}
                      />
                    </div>
                  </div>

                  {/* 2. Candle Length & Breadth (Dimensions) */}
                  <div
                    className={`rounded-xl border p-3 transition-all ${
                      draftSpecsEnabled.candleDimensions
                        ? "border-emerald-300 bg-white shadow-2xs"
                        : "border-stone-200 bg-stone-100/70"
                    }`}
                  >
                    <label className="flex items-center justify-between cursor-pointer select-none py-0.5">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={draftSpecsEnabled.candleDimensions}
                          onChange={(e) =>
                            setDraftSpecsEnabled((p) => ({ ...p, candleDimensions: e.target.checked }))
                          }
                          className="h-4 w-4 rounded accent-[#9b4a1b] cursor-pointer"
                        />
                        <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                          <span>📏</span> Candle Length & Breadth <span className="text-[10px] font-normal text-[#765442]">(Dimensions)</span>
                        </span>
                      </div>
                      {draftSpecsEnabled.candleDimensions ? (
                        <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          ✓ Ticked (Must fill)
                        </span>
                      ) : (
                        <span className="rounded-md bg-stone-200 px-2 py-0.5 text-[10px] font-medium text-stone-600">
                          ✕ Unticked (Excluded)
                        </span>
                      )}
                    </label>
                    <div className="mt-2">
                      <input
                        type="text"
                        disabled={!draftSpecsEnabled.candleDimensions}
                        required={draftSpecsEnabled.candleDimensions}
                        value={draftSpecsEnabled.candleDimensions ? draft.candleDimensions : ""}
                        onChange={(e) => setDraft({ ...draft, candleDimensions: e.target.value })}
                        placeholder={
                          draftSpecsEnabled.candleDimensions
                            ? "e.g. 7.5 cm (L) × 7.5 cm (B) × 9 cm (H) (Required)"
                            : "✕ Unticked - You cannot write here"
                        }
                        className={`w-full rounded-lg px-3 py-2.5 text-base sm:text-sm transition-all ${
                          draftSpecsEnabled.candleDimensions
                            ? "border border-[#8a614830] bg-white text-ink outline-clay"
                            : "border border-dashed border-stone-300 bg-stone-100/90 text-stone-400 cursor-not-allowed select-none"
                        }`}
                      />
                    </div>
                  </div>

                  {/* 3. Fragrance */}
                  <div
                    className={`rounded-xl border p-3 transition-all ${
                      draftSpecsEnabled.fragrance
                        ? "border-emerald-300 bg-white shadow-2xs"
                        : "border-stone-200 bg-stone-100/70"
                    }`}
                  >
                    <label className="flex items-center justify-between cursor-pointer select-none py-0.5">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={draftSpecsEnabled.fragrance}
                          onChange={(e) =>
                            setDraftSpecsEnabled((p) => ({ ...p, fragrance: e.target.checked }))
                          }
                          className="h-4 w-4 rounded accent-[#9b4a1b] cursor-pointer"
                        />
                        <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                          <span>🌸</span> Fragrance <span className="text-[10px] font-normal text-[#765442]">(Scent notes)</span>
                        </span>
                      </div>
                      {draftSpecsEnabled.fragrance ? (
                        <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          ✓ Ticked (Must fill)
                        </span>
                      ) : (
                        <span className="rounded-md bg-stone-200 px-2 py-0.5 text-[10px] font-medium text-stone-600">
                          ✕ Unticked (Excluded)
                        </span>
                      )}
                    </label>
                    <div className="mt-2">
                      <input
                        type="text"
                        disabled={!draftSpecsEnabled.fragrance}
                        required={draftSpecsEnabled.fragrance}
                        value={draftSpecsEnabled.fragrance ? draft.fragrance : ""}
                        onChange={(e) => setDraft({ ...draft, fragrance: e.target.value })}
                        placeholder={
                          draftSpecsEnabled.fragrance
                            ? "e.g. French Vanilla, Lavender & Sandalwood (Required)"
                            : "✕ Unticked - You cannot write here"
                        }
                        className={`w-full rounded-lg px-3 py-2.5 text-base sm:text-sm transition-all ${
                          draftSpecsEnabled.fragrance
                            ? "border border-[#8a614830] bg-white text-ink outline-clay"
                            : "border border-dashed border-stone-300 bg-stone-100/90 text-stone-400 cursor-not-allowed select-none"
                        }`}
                      />
                    </div>
                  </div>

                  {/* 4. Burn Time */}
                  <div
                    className={`rounded-xl border p-3 transition-all ${
                      draftSpecsEnabled.burnTime
                        ? "border-emerald-300 bg-white shadow-2xs"
                        : "border-stone-200 bg-stone-100/70"
                    }`}
                  >
                    <label className="flex items-center justify-between cursor-pointer select-none py-0.5">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={draftSpecsEnabled.burnTime}
                          onChange={(e) =>
                            setDraftSpecsEnabled((p) => ({ ...p, burnTime: e.target.checked }))
                          }
                          className="h-4 w-4 rounded accent-[#9b4a1b] cursor-pointer"
                        />
                        <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                          <span>⏳</span> Burn Time <span className="text-[10px] font-normal text-[#765442]">(Hours)</span>
                        </span>
                      </div>
                      {draftSpecsEnabled.burnTime ? (
                        <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          ✓ Ticked (Must fill)
                        </span>
                      ) : (
                        <span className="rounded-md bg-stone-200 px-2 py-0.5 text-[10px] font-medium text-stone-600">
                          ✕ Unticked (Excluded)
                        </span>
                      )}
                    </label>
                    <div className="mt-2">
                      <input
                        type="text"
                        disabled={!draftSpecsEnabled.burnTime}
                        required={draftSpecsEnabled.burnTime}
                        value={draftSpecsEnabled.burnTime ? draft.burnTime : ""}
                        onChange={(e) => setDraft({ ...draft, burnTime: e.target.value })}
                        placeholder={
                          draftSpecsEnabled.burnTime
                            ? "e.g. 35–40 hours (Required)"
                            : "✕ Unticked - You cannot write here"
                        }
                        className={`w-full rounded-lg px-3 py-2.5 text-base sm:text-sm transition-all ${
                          draftSpecsEnabled.burnTime
                            ? "border border-[#8a614830] bg-white text-ink outline-clay"
                            : "border border-dashed border-stone-300 bg-stone-100/90 text-stone-400 cursor-not-allowed select-none"
                        }`}
                      />
                    </div>
                  </div>

                  {/* 5. Ingredients */}
                  <div
                    className={`rounded-xl border p-3 transition-all ${
                      draftSpecsEnabled.ingredients
                        ? "border-emerald-300 bg-white shadow-2xs"
                        : "border-stone-200 bg-stone-100/70"
                    }`}
                  >
                    <label className="flex items-center justify-between cursor-pointer select-none py-0.5">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={draftSpecsEnabled.ingredients}
                          onChange={(e) =>
                            setDraftSpecsEnabled((p) => ({ ...p, ingredients: e.target.checked }))
                          }
                          className="h-4 w-4 rounded accent-[#9b4a1b] cursor-pointer"
                        />
                        <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                          <span>🌿</span> Ingredients <span className="text-[10px] font-normal text-[#765442]">(Made with)</span>
                        </span>
                      </div>
                      {draftSpecsEnabled.ingredients ? (
                        <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          ✓ Ticked (Must fill)
                        </span>
                      ) : (
                        <span className="rounded-md bg-stone-200 px-2 py-0.5 text-[10px] font-medium text-stone-600">
                          ✕ Unticked (Excluded)
                        </span>
                      )}
                    </label>
                    <div className="mt-2">
                      <input
                        type="text"
                        disabled={!draftSpecsEnabled.ingredients}
                        required={draftSpecsEnabled.ingredients}
                        value={draftSpecsEnabled.ingredients ? draft.ingredients : ""}
                        onChange={(e) => setDraft({ ...draft, ingredients: e.target.value })}
                        placeholder={
                          draftSpecsEnabled.ingredients
                            ? "e.g. 100% Pure Soy Wax, Organic Essential Oils (Required)"
                            : "✕ Unticked - You cannot write here"
                        }
                        className={`w-full rounded-lg px-3 py-2.5 text-base sm:text-sm transition-all ${
                          draftSpecsEnabled.ingredients
                            ? "border border-[#8a614830] bg-white text-ink outline-clay"
                            : "border border-dashed border-stone-300 bg-stone-100/90 text-stone-400 cursor-not-allowed select-none"
                        }`}
                      />
                    </div>
                  </div>

                  {/* 6. Description */}
                  <div
                    className={`rounded-xl border p-3 transition-all ${
                      draftSpecsEnabled.description
                        ? "border-emerald-300 bg-white shadow-2xs"
                        : "border-stone-200 bg-stone-100/70"
                    }`}
                  >
                    <label className="flex items-center justify-between cursor-pointer select-none py-0.5">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={draftSpecsEnabled.description}
                          onChange={(e) =>
                            setDraftSpecsEnabled((p) => ({ ...p, description: e.target.checked }))
                          }
                          className="h-4 w-4 rounded accent-[#9b4a1b] cursor-pointer"
                        />
                        <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                          <span>📝</span> Description & Story <span className="text-[10px] font-normal text-[#765442]">(Scent & mood)</span>
                        </span>
                      </div>
                      {draftSpecsEnabled.description ? (
                        <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          ✓ Ticked (Must fill)
                        </span>
                      ) : (
                        <span className="rounded-md bg-stone-200 px-2 py-0.5 text-[10px] font-medium text-stone-600">
                          ✕ Unticked (Excluded)
                        </span>
                      )}
                    </label>
                    <div className="mt-2">
                      <textarea
                        rows={2}
                        disabled={!draftSpecsEnabled.description}
                        required={draftSpecsEnabled.description}
                        value={draftSpecsEnabled.description ? draft.description : ""}
                        onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                        placeholder={
                          draftSpecsEnabled.description
                            ? "Write evocative notes about this candle's scent, feel, and mood... (Required)"
                            : "✕ Unticked - You cannot write here"
                        }
                        className={`w-full rounded-lg px-3 py-2.5 text-base sm:text-sm transition-all resize-y ${
                          draftSpecsEnabled.description
                            ? "border border-[#8a614830] bg-white text-ink outline-clay"
                            : "border border-dashed border-stone-300 bg-stone-100/90 text-stone-400 cursor-not-allowed select-none"
                        }`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Product Photos Section */}
              <div className="mt-5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#765442]">
                  Product Photos
                </label>

                {/* Upload from Device Button */}
                <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-clay bg-[#f8ede0] px-4 py-3 text-xs font-semibold text-clay hover:bg-clay hover:text-white transition w-full sm:w-auto shadow-2xs active:scale-95">
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
                    {isProcessingPhoto ? "Optimizing image..." : "Upload photos directly from phone camera or gallery"}
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
                          className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/75 text-xs font-bold text-white hover:bg-red-600 transition cursor-pointer"
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
                    className="mt-1 h-14 w-full rounded-xl border border-[#8a614830] bg-white p-2.5 text-base sm:text-xs text-ink outline-clay"
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={isProcessingPhoto}
                className="mt-5 w-full sm:w-auto rounded-full bg-ink px-7 py-3.5 text-base sm:text-sm font-bold text-white hover:bg-clay transition disabled:bg-stone-400 active:scale-[0.98] shadow-md cursor-pointer"
              >
                + Add candle to store
              </button>
            </form>
          </div>

          {/* Studio Settings Column */}
          <div>
            <h2 className="display text-2xl sm:text-3xl font-bold text-ink">Studio settings</h2>
            <p className="mt-1 text-xs sm:text-sm text-[#765442]">
              Manage payment destination UPI ID and access password.
            </p>

            {/* Payment QR Settings */}
            <form onSubmit={payment} className="mt-4 rounded-2xl bg-white p-4 sm:p-5 shadow-sm border border-[#8a614820]">
              <h3 className="font-semibold text-ink text-sm sm:text-base">Payment QR Destination</h3>
              <p className="mt-1 text-xs sm:text-sm text-[#765442]">
                This UPI ID generates each checkout QR code automatically.
              </p>
              <input
                value={upi}
                onChange={(e) => setUpi(e.target.value)}
                className="mt-3 w-full rounded-xl border border-[#8a614830] p-3 text-base sm:text-sm text-ink outline-clay font-medium"
                placeholder="name@upi"
              />
              <button
                type="submit"
                className="mt-3 w-full sm:w-auto rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-clay transition active:scale-95 cursor-pointer shadow-2xs"
              >
                Save UPI ID
              </button>
            </form>

            {/* Password Settings */}
            <form onSubmit={password} className="mt-5 rounded-2xl bg-white p-4 sm:p-5 shadow-sm border border-[#8a614820]">
              <h3 className="font-semibold text-ink text-sm sm:text-base">Change studio password</h3>
              <p className="mt-1 text-xs sm:text-sm text-[#765442]">
                Keep your studio dashboard secure.
              </p>
              <input
                name="currentPassword"
                type="password"
                required
                className="mt-3 w-full rounded-xl border border-[#8a614830] p-3 text-base sm:text-sm text-ink outline-clay"
                placeholder="Current password"
              />
              <input
                name="newPassword"
                type="password"
                required
                minLength={8}
                className="mt-3 w-full rounded-xl border border-[#8a614830] p-3 text-base sm:text-sm text-ink outline-clay"
                placeholder="New password (8+ characters)"
              />
              <button
                type="submit"
                className="mt-4 w-full sm:w-auto rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-clay transition active:scale-95 cursor-pointer shadow-2xs"
              >
                Update password
              </button>
            </form>

            {/* Cloud Storage Status (Supabase) */}
            <div className="mt-5 rounded-2xl bg-white p-4 sm:p-5 shadow-sm border border-[#8a614820]">
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <h3 className="font-semibold text-ink text-sm">Cloud Storage: Supabase</h3>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-[#765442]">
                Customer orders are persisted in <b>Supabase PostgreSQL</b> and payment proof screenshots are saved in the <b>payment-proofs</b> bucket. Real-time updates push directly to this studio dashboard.
              </p>
              <div className="mt-3 flex items-center gap-2 text-[11px] font-medium text-emerald-800 bg-emerald-50 rounded-lg p-2.5 border border-emerald-200">
                <span>✓ Cloudflare KV binding removed · Zero-crash order processing active</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Payment Screenshot Viewer Modal */}
      {selectedScreenshotOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-2 sm:p-4 backdrop-blur-sm overflow-y-auto"
          onClick={() => setSelectedScreenshotOrder(null)}
        >
          <div
            className="relative flex max-h-[94vh] sm:max-h-[92vh] w-full max-w-3xl flex-col rounded-2xl sm:rounded-3xl bg-[#fff8ed] shadow-2xl border border-[#8a61483a] overflow-hidden my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#8a614820] bg-[#f5ede0] px-4 sm:px-6 py-3.5 sm:py-4">
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="display text-base sm:text-xl text-ink font-bold break-all">
                    Payment Verification: {selectedScreenshotOrder.id}
                  </h3>
                  <span className="rounded-full bg-clay/15 px-2.5 py-0.5 text-[11px] sm:text-xs font-semibold text-clay shrink-0">
                    {selectedScreenshotOrder.status}
                  </span>
                </div>
                <p className="mt-1 text-[11px] sm:text-xs text-[#765442] break-words">
                  Customer: <b className="text-ink">{selectedScreenshotOrder.customer.name}</b> · Phone:{" "}
                  <a href={`tel:${selectedScreenshotOrder.customer.phone}`} className="text-clay underline font-bold">
                    {selectedScreenshotOrder.customer.phone}
                  </a>{" "}
                  · Total: <b className="text-clay">₹{selectedScreenshotOrder.total}</b>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedScreenshotOrder(null)}
                className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full bg-white/90 text-base sm:text-lg font-bold text-[#765442] hover:bg-clay hover:text-white transition shadow-sm cursor-pointer"
                title="Close modal"
              >
                ✕
              </button>
            </div>

            {/* 3-Day Cloud Storage Expiry Notice */}
            <div className="flex items-center justify-between bg-[#fff0db] px-4 sm:px-6 py-2 sm:py-2.5 text-[11px] sm:text-xs text-[#8a4e1d] border-b border-[#f0cca3]">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#e5832d] animate-pulse shrink-0" />
                <span>
                  <b>3-Day Cloud Retention:</b> Proof automatically expires in{" "}
                  <b>{getScreenshotExpiryInfo(selectedScreenshotOrder.createdAt, selectedScreenshotOrder.screenshotExpiresAt).timeLeftText}</b>.
                </span>
              </div>
            </div>

            {/* Image Display Body */}
            <div className="flex-1 overflow-auto bg-[#2b1911] p-3 sm:p-4 flex items-center justify-center min-h-[220px] sm:min-h-[360px]">
              {selectedScreenshotOrder.screenshot ? (
                <img
                  src={selectedScreenshotOrder.screenshot}
                  alt={`Payment screenshot for order ${selectedScreenshotOrder.id}`}
                  className="max-h-[55vh] sm:max-h-[60vh] max-w-full rounded-xl object-contain shadow-2xl border border-white/10"
                />
              ) : (
                <div className="text-center p-8 sm:p-12 text-stone-300">
                  <p className="text-sm sm:text-base font-semibold">Screenshot Expired</p>
                  <p className="text-xs text-stone-400 mt-1">
                    This payment screenshot was automatically purged after 3 days to preserve cloud storage.
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 bg-[#f5ede0] px-4 sm:px-6 py-3 sm:py-3.5 border-t border-[#8a614820]">
              <div className="grid grid-cols-2 sm:flex items-center gap-2">
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
                      className="rounded-xl border border-[#8a61483a] bg-white px-3 py-2 text-xs font-semibold text-clay hover:bg-clay hover:text-white transition shadow-xs text-center cursor-pointer active:scale-95"
                    >
                      Open in Tab ↗
                    </button>
                    <a
                      href={selectedScreenshotOrder.screenshot}
                      download={`payment-order-${selectedScreenshotOrder.id}.jpg`}
                      className="rounded-xl bg-ink px-3 py-2 text-xs font-semibold text-white hover:bg-clay transition shadow-xs text-center active:scale-95 flex items-center justify-center"
                    >
                      Download ↓
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
                    className="flex-1 sm:flex-initial rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-600 hover:text-white transition cursor-pointer text-center"
                  >
                    Delete Early
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedScreenshotOrder(null)}
                  className="flex-1 sm:flex-initial rounded-xl border border-[#8a61483a] bg-white px-4 py-2 text-xs font-semibold text-ink hover:bg-stone-100 transition cursor-pointer text-center"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Product Edit Modal */}
      {editingProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-2 sm:p-4 backdrop-blur-sm overflow-y-auto"
          onClick={closeEditingProduct}
        >
          <div
            className="relative flex max-h-[96vh] sm:max-h-[94vh] w-full max-w-2xl flex-col rounded-2xl sm:rounded-3xl bg-[#fff8ed] shadow-2xl border border-[#8a61483a] overflow-hidden my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#8a614820] bg-[#f5ede0] px-4 sm:px-6 py-3.5 sm:py-4">
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg sm:text-xl shrink-0">✏️</span>
                  <h3 className="display text-base sm:text-xl text-ink font-bold truncate">
                    Edit Candle: {editingProduct.name}
                  </h3>
                </div>
                <p className="text-[11px] sm:text-xs text-[#765442] mt-0.5 truncate">
                  Edits save directly to cloud database & sync immediately with store.
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditingProduct}
                disabled={isSavingProduct}
                className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full bg-white/90 text-base sm:text-lg font-bold text-[#765442] hover:bg-clay hover:text-white transition shadow-sm cursor-pointer disabled:opacity-50"
                title="Close editor"
              >
                ✕
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={saveEditedProduct} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                {/* Candle Name & Price */}
                <div className="grid gap-3.5 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#765442] mb-1">
                      Candle Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      placeholder="e.g. Amber & Sandalwood"
                      className="w-full rounded-xl border border-[#8a614830] bg-white px-3.5 py-2.5 text-base sm:text-sm text-ink outline-clay shadow-2xs font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#765442] mb-1">
                      Price (₹ INR) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-2.5 text-sm font-bold text-[#765442]">₹</span>
                      <input
                        type="number"
                        required
                        min="0"
                        step="1"
                        value={editForm.price}
                        onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                        placeholder="e.g. 649"
                        className="w-full rounded-xl border border-[#8a614830] bg-white pl-8 pr-3.5 py-2.5 text-base sm:text-sm font-bold text-ink outline-clay shadow-2xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Category & Stock Status */}
                <div className="grid gap-3.5 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#765442] mb-1">
                      Category
                    </label>
                    <select
                      value={editForm.category}
                      onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                      className="w-full rounded-xl border border-[#8a614830] bg-white px-3 py-2.5 text-base sm:text-sm text-ink outline-clay shadow-2xs cursor-pointer"
                    >
                      <option value="Jar candle">Jar candle</option>
                      <option value="Sculptural">Sculptural</option>
                      <option value="Flower candle">Flower candle</option>
                      <option value="Tin candle">Tin candle</option>
                      <option value="Wax melts">Wax melts</option>
                      <option value="Aromatherapy">Aromatherapy</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#765442] mb-1">
                      Availability Status
                    </label>
                    <button
                      type="button"
                      onClick={() => setEditForm({ ...editForm, available: !editForm.available })}
                      className={`flex items-center justify-between w-full rounded-xl border px-3.5 py-2.5 text-base sm:text-sm font-semibold transition shadow-2xs cursor-pointer active:scale-95 ${
                        editForm.available
                          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                          : "border-stone-300 bg-stone-100 text-stone-600"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            editForm.available ? "bg-emerald-500 animate-pulse" : "bg-stone-400"
                          }`}
                        />
                        {editForm.available ? "In Stock (Available)" : "Sold Out (Unavailable)"}
                      </span>
                      <span className="text-xs underline opacity-80">Toggle</span>
                    </button>
                  </div>
                </div>

                {/* Removable / Tickable Specifications Section */}
                <div className="rounded-2xl border border-[#8a614825] bg-[#fff6eb]/60 p-3.5 sm:p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[#8a614815] pb-2.5 mb-3">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-ink flex items-center gap-1.5">
                        <span>⚙️</span> Candle Specifications (Tick to Include)
                      </h4>
                      <p className="text-[11px] text-[#765442] mt-0.5">
                        Tick to include. If ticked, it <b>must be filled</b>. If unticked, it cannot be written & will be removed.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {/* 1. Wick Size (Wink size) */}
                    <div
                      className={`rounded-xl border p-3 transition-all ${
                        editSpecsEnabled.wickSize
                          ? "border-emerald-300 bg-white shadow-2xs"
                          : "border-stone-200 bg-stone-100/70"
                      }`}
                    >
                      <label className="flex items-center justify-between cursor-pointer select-none">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={editSpecsEnabled.wickSize}
                            onChange={(e) =>
                              setEditSpecsEnabled((p) => ({ ...p, wickSize: e.target.checked }))
                            }
                            className="h-4 w-4 rounded accent-[#9b4a1b] cursor-pointer"
                          />
                          <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                            <span>🕯️</span> Wick Size <span className="text-[10px] font-normal text-[#765442]">(Wink)</span>
                          </span>
                        </div>
                        {editSpecsEnabled.wickSize ? (
                          <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                            ✓ Ticked (Must fill)
                          </span>
                        ) : (
                          <span className="rounded-md bg-stone-200 px-2 py-0.5 text-[10px] font-medium text-stone-600">
                            ✕ Excluded
                          </span>
                        )}
                      </label>
                      <div className="mt-2">
                        <input
                          type="text"
                          disabled={!editSpecsEnabled.wickSize}
                          required={editSpecsEnabled.wickSize}
                          value={editSpecsEnabled.wickSize ? editForm.wickSize : ""}
                          onChange={(e) => setEditForm({ ...editForm, wickSize: e.target.value })}
                          placeholder={
                            editSpecsEnabled.wickSize
                              ? "e.g. 24-ply braided cotton wick (Required)"
                              : "✕ Unticked - You cannot write here"
                          }
                          className={`w-full rounded-lg px-3 py-2 text-base sm:text-sm transition-all ${
                            editSpecsEnabled.wickSize
                              ? "border border-[#8a614830] bg-white text-ink outline-clay font-medium"
                              : "border border-dashed border-stone-300 bg-stone-100/90 text-stone-400 cursor-not-allowed select-none"
                          }`}
                        />
                      </div>
                    </div>

                    {/* 2. Candle Length & Breadth (Dimensions) */}
                    <div
                      className={`rounded-xl border p-3 transition-all ${
                        editSpecsEnabled.candleDimensions
                          ? "border-emerald-300 bg-white shadow-2xs"
                          : "border-stone-200 bg-stone-100/70"
                      }`}
                    >
                      <label className="flex items-center justify-between cursor-pointer select-none">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={editSpecsEnabled.candleDimensions}
                            onChange={(e) =>
                              setEditSpecsEnabled((p) => ({ ...p, candleDimensions: e.target.checked }))
                            }
                            className="h-4 w-4 rounded accent-[#9b4a1b] cursor-pointer"
                          />
                          <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                            <span>📏</span> Length & Breadth <span className="text-[10px] font-normal text-[#765442]">(Dimensions)</span>
                          </span>
                        </div>
                        {editSpecsEnabled.candleDimensions ? (
                          <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                            ✓ Ticked (Must fill)
                          </span>
                        ) : (
                          <span className="rounded-md bg-stone-200 px-2 py-0.5 text-[10px] font-medium text-stone-600">
                            ✕ Excluded
                          </span>
                        )}
                      </label>
                      <div className="mt-2">
                        <input
                          type="text"
                          disabled={!editSpecsEnabled.candleDimensions}
                          required={editSpecsEnabled.candleDimensions}
                          value={editSpecsEnabled.candleDimensions ? editForm.candleDimensions : ""}
                          onChange={(e) => setEditForm({ ...editForm, candleDimensions: e.target.value })}
                          placeholder={
                            editSpecsEnabled.candleDimensions
                              ? "e.g. 7.5 cm (L) × 7.5 cm (B) × 9 cm (H) (Required)"
                              : "✕ Unticked - You cannot write here"
                          }
                          className={`w-full rounded-lg px-3 py-2 text-base sm:text-sm transition-all ${
                            editSpecsEnabled.candleDimensions
                              ? "border border-[#8a614830] bg-white text-ink outline-clay font-medium"
                              : "border border-dashed border-stone-300 bg-stone-100/90 text-stone-400 cursor-not-allowed select-none"
                          }`}
                        />
                      </div>
                    </div>

                    {/* 3. Fragrance */}
                    <div
                      className={`rounded-xl border p-3 transition-all ${
                        editSpecsEnabled.fragrance
                          ? "border-emerald-300 bg-white shadow-2xs"
                          : "border-stone-200 bg-stone-100/70"
                      }`}
                    >
                      <label className="flex items-center justify-between cursor-pointer select-none">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={editSpecsEnabled.fragrance}
                            onChange={(e) =>
                              setEditSpecsEnabled((p) => ({ ...p, fragrance: e.target.checked }))
                            }
                            className="h-4 w-4 rounded accent-[#9b4a1b] cursor-pointer"
                          />
                          <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                            <span>🌸</span> Fragrance <span className="text-[10px] font-normal text-[#765442]">(Scent)</span>
                          </span>
                        </div>
                        {editSpecsEnabled.fragrance ? (
                          <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                            ✓ Ticked (Must fill)
                          </span>
                        ) : (
                          <span className="rounded-md bg-stone-200 px-2 py-0.5 text-[10px] font-medium text-stone-600">
                            ✕ Excluded
                          </span>
                        )}
                      </label>
                      <div className="mt-2">
                        <input
                          type="text"
                          disabled={!editSpecsEnabled.fragrance}
                          required={editSpecsEnabled.fragrance}
                          value={editSpecsEnabled.fragrance ? editForm.fragrance : ""}
                          onChange={(e) => setEditForm({ ...editForm, fragrance: e.target.value })}
                          placeholder={
                            editSpecsEnabled.fragrance
                              ? "e.g. French Vanilla, Lavender & Sandalwood (Required)"
                              : "✕ Unticked - You cannot write here"
                          }
                          className={`w-full rounded-lg px-3 py-2 text-base sm:text-sm transition-all ${
                            editSpecsEnabled.fragrance
                              ? "border border-[#8a614830] bg-white text-ink outline-clay font-medium"
                              : "border border-dashed border-stone-300 bg-stone-100/90 text-stone-400 cursor-not-allowed select-none"
                          }`}
                        />
                      </div>
                    </div>

                    {/* 4. Burn Time */}
                    <div
                      className={`rounded-xl border p-3 transition-all ${
                        editSpecsEnabled.burnTime
                          ? "border-emerald-300 bg-white shadow-2xs"
                          : "border-stone-200 bg-stone-100/70"
                      }`}
                    >
                      <label className="flex items-center justify-between cursor-pointer select-none">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={editSpecsEnabled.burnTime}
                            onChange={(e) =>
                              setEditSpecsEnabled((p) => ({ ...p, burnTime: e.target.checked }))
                            }
                            className="h-4 w-4 rounded accent-[#9b4a1b] cursor-pointer"
                          />
                          <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                            <span>⏳</span> Burn Time <span className="text-[10px] font-normal text-[#765442]">(Hours)</span>
                          </span>
                        </div>
                        {editSpecsEnabled.burnTime ? (
                          <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                            ✓ Ticked (Must fill)
                          </span>
                        ) : (
                          <span className="rounded-md bg-stone-200 px-2 py-0.5 text-[10px] font-medium text-stone-600">
                            ✕ Excluded
                          </span>
                        )}
                      </label>
                      <div className="mt-2">
                        <input
                          type="text"
                          disabled={!editSpecsEnabled.burnTime}
                          required={editSpecsEnabled.burnTime}
                          value={editSpecsEnabled.burnTime ? editForm.burnTime : ""}
                          onChange={(e) => setEditForm({ ...editForm, burnTime: e.target.value })}
                          placeholder={
                            editSpecsEnabled.burnTime
                              ? "e.g. 35–40 hours (Required)"
                              : "✕ Unticked - You cannot write here"
                          }
                          className={`w-full rounded-lg px-3 py-2 text-base sm:text-sm transition-all ${
                            editSpecsEnabled.burnTime
                              ? "border border-[#8a614830] bg-white text-ink outline-clay font-medium"
                              : "border border-dashed border-stone-300 bg-stone-100/90 text-stone-400 cursor-not-allowed select-none"
                          }`}
                        />
                      </div>
                    </div>

                    {/* 5. Ingredients */}
                    <div
                      className={`rounded-xl border p-3 transition-all ${
                        editSpecsEnabled.ingredients
                          ? "border-emerald-300 bg-white shadow-2xs"
                          : "border-stone-200 bg-stone-100/70"
                      }`}
                    >
                      <label className="flex items-center justify-between cursor-pointer select-none">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={editSpecsEnabled.ingredients}
                            onChange={(e) =>
                              setEditSpecsEnabled((p) => ({ ...p, ingredients: e.target.checked }))
                            }
                            className="h-4 w-4 rounded accent-[#9b4a1b] cursor-pointer"
                          />
                          <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                            <span>🌿</span> Ingredients <span className="text-[10px] font-normal text-[#765442]">(Made with)</span>
                          </span>
                        </div>
                        {editSpecsEnabled.ingredients ? (
                          <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                            ✓ Ticked (Must fill)
                          </span>
                        ) : (
                          <span className="rounded-md bg-stone-200 px-2 py-0.5 text-[10px] font-medium text-stone-600">
                            ✕ Excluded
                          </span>
                        )}
                      </label>
                      <div className="mt-2">
                        <input
                          type="text"
                          disabled={!editSpecsEnabled.ingredients}
                          required={editSpecsEnabled.ingredients}
                          value={editSpecsEnabled.ingredients ? editForm.ingredients : ""}
                          onChange={(e) => setEditForm({ ...editForm, ingredients: e.target.value })}
                          placeholder={
                            editSpecsEnabled.ingredients
                              ? "e.g. 100% Pure Soy Wax, Organic Essential Oils (Required)"
                              : "✕ Unticked - You cannot write here"
                          }
                          className={`w-full rounded-lg px-3 py-2 text-base sm:text-sm transition-all ${
                            editSpecsEnabled.ingredients
                              ? "border border-[#8a614830] bg-white text-ink outline-clay font-medium"
                              : "border border-dashed border-stone-300 bg-stone-100/90 text-stone-400 cursor-not-allowed select-none"
                          }`}
                        />
                      </div>
                    </div>

                    {/* 6. Description */}
                    <div
                      className={`rounded-xl border p-3 transition-all ${
                        editSpecsEnabled.description
                          ? "border-emerald-300 bg-white shadow-2xs"
                          : "border-stone-200 bg-stone-100/70"
                      }`}
                    >
                      <label className="flex items-center justify-between cursor-pointer select-none">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={editSpecsEnabled.description}
                            onChange={(e) =>
                              setEditSpecsEnabled((p) => ({ ...p, description: e.target.checked }))
                            }
                            className="h-4 w-4 rounded accent-[#9b4a1b] cursor-pointer"
                          />
                          <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                            <span>📝</span> Description <span className="text-[10px] font-normal text-[#765442]">(Scent & mood)</span>
                          </span>
                        </div>
                        {editSpecsEnabled.description ? (
                          <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                            ✓ Ticked (Must fill)
                          </span>
                        ) : (
                          <span className="rounded-md bg-stone-200 px-2 py-0.5 text-[10px] font-medium text-stone-600">
                            ✕ Excluded
                          </span>
                        )}
                      </label>
                      <div className="mt-2">
                        <textarea
                          rows={2}
                          disabled={!editSpecsEnabled.description}
                          required={editSpecsEnabled.description}
                          value={editSpecsEnabled.description ? editForm.description : ""}
                          onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                          placeholder={
                            editSpecsEnabled.description
                              ? "Write evocative notes about this candle's scent, feel, and mood... (Required)"
                              : "✕ Unticked - You cannot write here"
                          }
                          className={`w-full rounded-lg px-3 py-2 text-base sm:text-sm transition-all resize-y ${
                            editSpecsEnabled.description
                              ? "border border-[#8a614830] bg-white text-ink outline-clay font-medium"
                              : "border border-dashed border-stone-300 bg-stone-100/90 text-stone-400 cursor-not-allowed select-none"
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Product Photos Section */}
                <div className="rounded-2xl border border-[#8a614820] bg-white/70 p-3.5 sm:p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-ink">
                        Photos ({editForm.images.length})
                      </h4>
                      <p className="text-[11px] text-[#765442]">
                        First photo is the cover. Tap &quot;Make Cover&quot; to set.
                      </p>
                    </div>

                    <label className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-clay bg-[#f8ede0] px-3.5 py-2.5 text-xs font-semibold text-clay hover:bg-clay hover:text-white transition shadow-2xs w-full sm:w-auto active:scale-95">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span>Upload from Device</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleEditProductPhotoFiles}
                        disabled={isProcessingEditPhoto}
                      />
                    </label>
                  </div>

                  {/* Existing Photos Grid */}
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 pt-1">
                    {editForm.images.map((img, idx) => (
                      <div
                        key={idx}
                        className="relative group rounded-xl overflow-hidden border border-[#8a61482a] bg-[#19120c] aspect-square"
                      >
                        <img src={img} alt="" className="h-full w-full object-cover" />
                        {idx === 0 && (
                          <span className="absolute top-1 left-1 rounded-md bg-clay text-[10px] font-bold text-white px-1.5 py-0.5 shadow-xs">
                            Cover
                          </span>
                        )}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center gap-1 p-1">
                          {idx !== 0 && (
                            <button
                              type="button"
                              onClick={() => makeCoverPhoto(idx)}
                              className="rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-bold text-ink hover:bg-white"
                            >
                              Make Cover
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => removeEditPhoto(idx)}
                            disabled={editForm.images.length <= 1}
                            className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white hover:bg-red-700 disabled:opacity-40"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add by URL option */}
                  <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-[#8a614815]">
                    <input
                      type="url"
                      value={editNewImageUrl}
                      onChange={(e) => setEditNewImageUrl(e.target.value)}
                      placeholder="Or paste an image URL (https://...)"
                      className="flex-1 rounded-xl border border-[#8a614830] bg-white px-3 py-2 text-base sm:text-xs text-ink outline-clay"
                    />
                    <button
                      type="button"
                      onClick={addEditImageUrl}
                      disabled={!editNewImageUrl.trim()}
                      className="rounded-xl bg-[#f5ede0] border border-[#8a614830] px-3.5 py-2 text-xs font-semibold text-clay hover:bg-clay hover:text-white transition disabled:opacity-50 cursor-pointer text-center shrink-0 active:scale-95"
                    >
                      + Add URL
                    </button>
                  </div>
                </div>
              </div>

              {/* Modal Footer Controls */}
              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 border-t border-[#8a614820] bg-[#f5ede0] px-4 sm:px-6 py-3.5 sm:py-4">
                <button
                  type="button"
                  onClick={closeEditingProduct}
                  disabled={isSavingProduct}
                  className="rounded-xl border border-[#8a61483a] bg-white px-4 py-2.5 text-sm font-semibold text-[#765442] hover:bg-stone-100 transition cursor-pointer disabled:opacity-50 text-center"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSavingProduct}
                  className="flex items-center justify-center gap-2 rounded-xl bg-ink px-6 py-3 text-sm font-bold text-white hover:bg-clay transition shadow-md cursor-pointer disabled:opacity-50 text-center active:scale-[0.98]"
                >
                  {isSavingProduct ? (
                    <>
                      <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      <span>Saving & Syncing...</span>
                    </>
                  ) : (
                    <>
                      <span>Save Changes & Sync ↗</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
