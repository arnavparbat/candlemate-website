"use client";

import { useEffect, useState, useMemo, useRef } from "react";
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
  // Navigation tabs: 'orders' | 'products' | 'settings'
  const [activeTab, setActiveTab] = useState<"orders" | "products" | "settings">("orders");

  // Main Data States
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [upi, setUpi] = useState("");
  const [notice, setNotice] = useState("");
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Audio & Notification States
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notificationsGranted, setNotificationsGranted] = useState(false);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [newOrderAlert, setNewOrderAlert] = useState<Order | null>(null);
  const [highlightedOrderId, setHighlightedOrderId] = useState<string | null>(null);

  // Orders Filter, Search & Pagination States
  const [orderFilter, setOrderFilter] = useState("All");
  const [orderSearchQuery, setOrderSearchQuery] = useState("");
  const [orderSortBy, setOrderSortBy] = useState<"newest" | "oldest" | "highest">("newest");
  const [ordersPerPage, setOrdersPerPage] = useState<number>(10);
  const [currentOrderPage, setCurrentOrderPage] = useState<number>(1);
  const [expandedOrderIds, setExpandedOrderIds] = useState<Record<string, boolean>>({});
  const [orderViewMode, setOrderViewMode] = useState<"cards" | "table">("cards");

  // Screenshot Viewer Modal State
  const [selectedScreenshotOrder, setSelectedScreenshotOrder] = useState<Order | null>(null);

  // Add Product Modal & Form State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [isSubmittingProduct, setIsSubmittingProduct] = useState(false);
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

  // Product Edit Modal State
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

  // Products Filter & Search State
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [productCategoryFilter, setProductCategoryFilter] = useState("All");

  const orderCardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // ----------------------------------------------------
  // Audio & Push Notification Helper
  // ----------------------------------------------------
  function playOrderChime() {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      // Rich, warm 4-note chime sequence: C5 (523.25Hz), E5 (659.25Hz), G5 (783.99Hz), C6 (1046.5Hz)
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        const start = ctx.currentTime + idx * 0.12;
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.2, start);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.38);
        osc.start(start);
        osc.stop(start + 0.38);
      });
    } catch {
      // Audio autoplay policy fallback
    }

    // Haptic vibration on mobile phones
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate([250, 100, 250, 100, 400]);
      } catch {}
    }
  }

  function triggerBrowserNotification(order: Order) {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      try {
        new Notification("🕯️ Candlemate: New Order Received!", {
          body: `Order #${order.id} for ₹${order.total} from ${order.customer.name}`,
          icon: "/logo.png",
        });
      } catch {}
    }
  }

  async function requestNotificationPermission() {
    if (typeof window !== "undefined" && "Notification" in window) {
      try {
        const res = await Notification.requestPermission();
        if (res === "granted") {
          setNotificationsGranted(true);
          setNotice("✓ Browser alerts enabled! You will be notified when customers place orders.");
          new Notification("🕯️ Candlemate Studio Alerts", {
            body: "Order notifications are now enabled for this browser!",
            icon: "/logo.png",
          });
        } else {
          setNotice("Notification permission was denied in browser settings.");
        }
      } catch {
        setNotice("Unable to request notification permissions.");
      }
    } else {
      setNotice("Web Notifications are not supported on this browser.");
    }
  }

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotificationsGranted(Notification.permission === "granted");
    }
  }, []);

  // ----------------------------------------------------
  // Screenshot Expiry Calculator
  // ----------------------------------------------------
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

  // ----------------------------------------------------
  // Relative Time & Utility Helpers
  // ----------------------------------------------------
  function formatRelativeTime(dateString: string) {
    try {
      const d = new Date(dateString);
      const diffMs = Date.now() - d.getTime();
      const mins = Math.floor(diffMs / 60000);
      if (mins < 1) return "Just now";
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      if (days === 1) return "Yesterday";
      if (days < 7) return `${days}d ago`;
      return d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
    } catch {
      return dateString;
    }
  }

  function copyToClipboard(text: string, label = "Address") {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setNotice(`✓ Copied ${label} to clipboard!`);
      setTimeout(() => setNotice(""), 3000);
    }
  }

  function getWhatsAppUrl(order: Order) {
    const cleanPhone = order.customer.phone.replace(/[^0-9]/g, "");
    const phoneWithCountry = cleanPhone.startsWith("91") ? cleanPhone : `91${cleanPhone}`;
    const msg = `Hi ${order.customer.name}! Candlemate studio here regarding your order #${order.id} (₹${order.total}). We are handcrafting your candles with natural soy wax. 🕯️✨`;
    return `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(msg)}`;
  }

  // ----------------------------------------------------
  // Data Fetching & Sync
  // ----------------------------------------------------
  async function load() {
    setIsLoadingData(true);
    let o: Order[] = [];
    try {
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
      setOrders(Array.isArray(o) ? o : []);
      setProducts(Array.isArray(p) ? p : []);
      setUpi(s.upiId || "");

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
    } catch {
      setNotice("Could not load latest studio data. Retrying...");
    } finally {
      setIsLoadingData(false);
    }
  }

  useEffect(() => {
    load();

    // 1. Supabase Realtime WebSockets
    let supabaseChannel: any = null;
    if (isSupabaseConfigured()) {
      const sb = getSupabase();
      if (sb) {
        supabaseChannel = sb
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
              triggerBrowserNotification(newOrder);
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

    // 2. Server-Sent Events (SSE) fallback
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
            triggerBrowserNotification(data.order);
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

    // 3. Heartbeat polling every 10 seconds
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
                  triggerBrowserNotification(newest);
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
        const sb = getSupabase();
        sb?.removeChannel(supabaseChannel);
      }
      if (eventSource) eventSource.close();
      clearInterval(pollInterval);
    };
  }, [soundEnabled]);

  // ----------------------------------------------------
  // Order Actions
  // ----------------------------------------------------
  async function status(id: string, newStatus: OrderStatus) {
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
    setNotice(`Updated order ${id} status to "${newStatus}"`);
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

  function toggleOrderExpand(id: string) {
    setExpandedOrderIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }

  function expandAllOrders() {
    const allExpanded: Record<string, boolean> = {};
    filteredOrders.forEach((o) => {
      allExpanded[o.id] = true;
    });
    setExpandedOrderIds(allExpanded);
  }

  function collapseAllOrders() {
    setExpandedOrderIds({});
  }

  function viewNewOrderDetails(order: Order) {
    setActiveTab("orders");
    setOrderFilter("All");
    setOrderSearchQuery("");
    setCurrentOrderPage(1);
    setExpandedOrderIds((prev) => ({ ...prev, [order.id]: true }));
    setHighlightedOrderId(order.id);
    setNewOrderAlert(null);

    // Smooth scroll to card
    setTimeout(() => {
      const el = orderCardRefs.current[order.id];
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 150);

    setTimeout(() => {
      setHighlightedOrderId(null);
    }, 5000);
  }

  // ----------------------------------------------------
  // Filtered & Paginated Orders
  // ----------------------------------------------------
  const filteredOrders = useMemo(() => {
    return orders
      .filter((o) => {
        if (orderFilter !== "All" && o.status !== orderFilter) return false;
        if (!orderSearchQuery.trim()) return true;
        const q = orderSearchQuery.toLowerCase();
        return (
          o.id.toLowerCase().includes(q) ||
          o.customer.name.toLowerCase().includes(q) ||
          o.customer.phone.toLowerCase().includes(q) ||
          (o.customer.address && o.customer.address.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        if (orderSortBy === "newest") {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        } else if (orderSortBy === "oldest") {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        } else {
          return b.total - a.total;
        }
      });
  }, [orders, orderFilter, orderSearchQuery, orderSortBy]);

  const totalOrderPages = useMemo(() => {
    if (ordersPerPage === 0) return 1;
    return Math.max(1, Math.ceil(filteredOrders.length / ordersPerPage));
  }, [filteredOrders.length, ordersPerPage]);

  const paginatedOrders = useMemo(() => {
    if (ordersPerPage === 0) return filteredOrders;
    const start = (currentOrderPage - 1) * ordersPerPage;
    return filteredOrders.slice(start, start + ordersPerPage);
  }, [filteredOrders, currentOrderPage, ordersPerPage]);

  // Order Counts by Status
  const orderCounts = useMemo(() => {
    const counts: Record<string, number> = {
      All: orders.length,
      "Payment Pending": 0,
      "Order Received": 0,
      Preparing: 0,
      "Out for Delivery": 0,
      Delivered: 0,
      "Payment Failed": 0,
    };
    orders.forEach((o) => {
      if (counts[o.status] !== undefined) {
        counts[o.status] += 1;
      }
    });
    return counts;
  }, [orders]);

  // Quick Business Stats
  const stats = useMemo(() => {
    const totalRev = orders.reduce((sum, o) => {
      if (o.status !== "Payment Failed") return sum + (o.total || 0);
      return sum;
    }, 0);
    const pendingActionCount = orders.filter(
      (o) => o.status === "Order Received" || o.status === "Payment Pending"
    ).length;
    const activeProductsCount = products.filter((p) => p.available !== false).length;
    return {
      totalOrders: orders.length,
      totalRevenue: totalRev,
      pendingAction: pendingActionCount,
      activeProducts: activeProductsCount,
      totalProducts: products.length,
    };
  }, [orders, products]);

  // ----------------------------------------------------
  // Add Product Flow
  // ----------------------------------------------------
  async function handleDraftFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setIsProcessingPhoto(true);
    setNotice("Optimizing photo(s)...");
    try {
      const urls: string[] = [];
      for (const file of files) {
        const optimized = await fileToOptimizedDataUrl(file);
        urls.push(optimized);
      }
      setUploadedPhotos((prev) => [...prev, ...urls]);
      setNotice(`✓ Added ${urls.length} photo(s) from device.`);
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

    setIsSubmittingProduct(true);
    try {
      const res = await fetch("/api/products", {
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

      if (!res.ok) {
        throw new Error("Failed to add product");
      }

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
      setIsAddModalOpen(false);
      setNotice(`✓ "${draft.name.trim()}" added to your candle collection!`);
      setActiveTab("products");
      load();
    } catch (err: any) {
      setNotice(`Error adding candle: ${err.message}`);
    } finally {
      setIsSubmittingProduct(false);
    }
  }

  // ----------------------------------------------------
  // Edit Product Flow
  // ----------------------------------------------------
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
      setProducts((prev) =>
        prev.map((item) => (item.id === editingProduct.id ? updated : item))
      );

      setNotice(`✓ "${updated.name}" updated! Live on customer store.`);
      setEditingProduct(null);
      load();
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

  async function remove(id: string) {
    if (confirm("Remove this candle from your collection?")) {
      await fetch(`/api/products/${encodeURIComponent(id)}`, { method: "DELETE" });
      load();
    }
  }

  // ----------------------------------------------------
  // Settings Actions
  // ----------------------------------------------------
  async function payment(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/admin/settings/payment", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ upiId: upi }),
    });
    setNotice(r.ok ? "✓ Payment UPI destination saved." : "Please use a valid UPI ID.");
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
    setNotice(r.ok ? "✓ Studio password updated successfully." : "Couldn’t update password.");
    if (r.ok) e.currentTarget.reset();
  }

  // ----------------------------------------------------
  // Filtered Products
  // ----------------------------------------------------
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (productCategoryFilter !== "All" && p.category !== productCategoryFilter) return false;
      if (!productSearchQuery.trim()) return true;
      const q = productSearchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        (p.fragrance && p.fragrance.toLowerCase().includes(q))
      );
    });
  }, [products, productCategoryFilter, productSearchQuery]);

  const productCategories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach((p) => {
      if (p.category) cats.add(p.category);
    });
    return ["All", ...Array.from(cats)];
  }, [products]);

  return (
    <main className="min-h-screen bg-[#f8f0e3] text-ink pb-24 md:pb-12">
      {/* ==================================================== */}
      {/* 1. TOP HEADER & STUDIO CONTROLS                      */}
      {/* ==================================================== */}
      <header className="sticky top-0 z-40 bg-[#fff8ed]/95 backdrop-blur-md border-b border-[#8a614820] shadow-2xs">
        <div className="mx-auto max-w-7xl px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2">
          {/* Logo & Brand */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/" className="flex items-center gap-1.5 group active:scale-95 transition">
              <img
                src="/logo.png"
                alt="Candlemate"
                className="h-7 w-auto object-contain candle-glow drop-shadow-xs"
              />
              <img
                src="/logo-wordmark.png"
                alt="Candlemate"
                className="h-5 sm:h-6 w-auto object-contain"
              />
            </Link>

            {/* Live Sync Status Pill */}
            <div
              onClick={() => load()}
              title="Click to manually refresh orders & studio data"
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2 sm:px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 shadow-2xs cursor-pointer hover:bg-emerald-100 transition active:scale-95 select-none"
            >
              <span className={`h-2 w-2 rounded-full ${isLoadingData ? "bg-amber-500 animate-spin" : "bg-emerald-500 animate-pulse"}`} />
              <span className="hidden sm:inline">{isLoadingData ? "Syncing..." : isLiveConnected ? "Studio Live Stream" : "Studio Auto-Sync"}</span>
              <span className="sm:hidden">{isLoadingData ? "Syncing" : "Live"}</span>
              <span className="text-[10px] text-emerald-600 font-mono opacity-80">↻</span>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            {/* Audio & Alert Control */}
            <button
              type="button"
              onClick={() => {
                setSoundEnabled(!soundEnabled);
                if (!soundEnabled) playOrderChime();
              }}
              className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold border transition active:scale-95 shadow-2xs cursor-pointer ${
                soundEnabled
                  ? "bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100"
                  : "bg-stone-100 border-stone-300 text-stone-500"
              }`}
              title={soundEnabled ? "Sound chime alerts are ON (Click to mute)" : "Sound chime is MUTED (Click to enable)"}
            >
              <span>{soundEnabled ? "🔔" : "🔕"}</span>
              <span className="hidden md:inline">{soundEnabled ? "Chime On" : "Muted"}</span>
            </button>

            {/* Push Notifications Toggle */}
            {!notificationsGranted && (
              <button
                type="button"
                onClick={requestNotificationPermission}
                className="hidden sm:inline-flex items-center gap-1 rounded-xl bg-white border border-[#8a614830] px-2.5 py-1.5 text-xs font-semibold text-[#765442] hover:text-ink hover:bg-stone-50 transition active:scale-95 shadow-2xs cursor-pointer"
                title="Enable browser notifications when phone is locked"
              >
                <span>📲</span>
                <span>Enable Alerts</span>
              </button>
            )}

            {/* Prominent Quick "+ Add Candle" Button */}
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-ink hover:bg-clay text-white px-3.5 sm:px-4 py-1.5 text-xs sm:text-sm font-bold shadow-sm hover:shadow transition active:scale-95 cursor-pointer"
            >
              <span className="text-base font-black leading-none">+</span>
              <span>Add Candle</span>
            </button>

            {/* Store Link */}
            <Link
              href="/"
              className="hidden sm:inline-flex items-center rounded-full bg-white/80 border border-[#8a614820] px-3 py-1 text-xs font-medium text-[#765442] hover:text-ink hover:bg-white transition active:scale-95"
            >
              Store ↗
            </Link>
          </div>
        </div>

        {/* ==================================================== */}
        {/* 2. MODERN SEGMENTED TAB BAR                          */}
        {/* ==================================================== */}
        <div className="mx-auto max-w-7xl px-3 sm:px-6 pt-1 pb-2 flex items-center justify-between border-t border-[#8a614810]">
          <nav className="flex items-center gap-1 sm:gap-2 w-full max-w-md bg-[#ead8c2]/60 p-1 rounded-2xl">
            <button
              type="button"
              onClick={() => setActiveTab("orders")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition active:scale-95 cursor-pointer ${
                activeTab === "orders"
                  ? "bg-white text-ink shadow-xs"
                  : "text-[#765442] hover:text-ink hover:bg-white/40"
              }`}
            >
              <span>📦 Orders</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] sm:text-xs font-black ${
                  stats.pendingAction > 0
                    ? "bg-clay text-white animate-pulse"
                    : activeTab === "orders"
                    ? "bg-[#8a614820] text-ink"
                    : "bg-[#8a614815] text-[#765442]"
                }`}
              >
                {orders.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("products")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition active:scale-95 cursor-pointer ${
                activeTab === "products"
                  ? "bg-white text-ink shadow-xs"
                  : "text-[#765442] hover:text-ink hover:bg-white/40"
              }`}
            >
              <span>🕯️ Products</span>
              <span className="rounded-full bg-[#8a614815] px-1.5 py-0.2 text-[10px] sm:text-xs font-semibold text-[#765442]">
                {products.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("settings")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition active:scale-95 cursor-pointer ${
                activeTab === "settings"
                  ? "bg-white text-ink shadow-xs"
                  : "text-[#765442] hover:text-ink hover:bg-white/40"
              }`}
            >
              <span>⚙️ Settings</span>
            </button>
          </nav>

          {/* Sound test button (small) */}
          <button
            type="button"
            onClick={playOrderChime}
            className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-[#8a6148] hover:text-clay hover:underline cursor-pointer"
            title="Test the order chime sound"
          >
            <span>🔔</span> Test Chime
          </button>
        </div>
      </header>

      {/* ==================================================== */}
      {/* 3. PERSISTENT FLOATING NEW ORDER NOTIFICATION BANNER */}
      {/* ==================================================== */}
      {newOrderAlert && (
        <div className="fixed top-3 sm:top-5 inset-x-3 sm:inset-x-auto sm:right-6 z-50 sm:max-w-md animate-bounce">
          <div className="rounded-2xl bg-gradient-to-r from-[#ffe4be] via-[#ffd6a2] to-[#ffecce] p-4 border-2 border-clay shadow-2xl backdrop-blur-md">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-clay text-2xl text-white shadow-md">
                  🕯️
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-black text-ink text-sm uppercase tracking-wide">
                      New Order Came!
                    </span>
                    <span className="rounded-md bg-ink px-1.5 py-0.5 text-[10px] font-mono font-bold text-white">
                      {newOrderAlert.id}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-clay mt-0.5">
                    ₹{newOrderAlert.total} · {newOrderAlert.customer.name}
                  </p>
                  <p className="text-[11px] text-[#765442] truncate max-w-[240px]">
                    {newOrderAlert.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setNewOrderAlert(null)}
                className="text-[#765442] hover:text-ink font-bold text-sm p-1"
              >
                ✕
              </button>
            </div>

            <div className="mt-3 pt-2.5 border-t border-[#8a614825] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setNewOrderAlert(null)}
                className="rounded-xl bg-white/80 px-3 py-1.5 text-xs font-semibold text-[#765442] hover:bg-white transition"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={() => viewNewOrderDetails(newOrderAlert)}
                className="rounded-xl bg-clay hover:bg-ink text-white px-3.5 py-1.5 text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer"
              >
                View Order ↗
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="mx-auto max-w-7xl px-3 sm:px-6 py-4 sm:py-6">
        {/* Notice alert toast */}
        {notice && (
          <div className="mb-4 flex items-center justify-between gap-2 rounded-2xl bg-[#e5eedc] border border-[#c4dcbc] p-3 text-xs sm:text-sm font-semibold text-moss shadow-2xs animate-in fade-in">
            <span>{notice}</span>
            <button
              type="button"
              onClick={() => setNotice("")}
              className="p-1 hover:opacity-75 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* ==================================================== */}
        {/* 4. STUDIO QUICK STATS BAR                            */}
        {/* ==================================================== */}
        <section className="mb-5 grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
          <div
            onClick={() => { setActiveTab("orders"); setOrderFilter("All"); }}
            className="rounded-2xl border border-[#8a614820] bg-white/90 p-3 sm:p-4 shadow-2xs hover:border-clay transition cursor-pointer active:scale-98"
          >
            <div className="flex items-center justify-between text-xs text-[#765442] font-semibold uppercase tracking-wider">
              <span>Total Orders</span>
              <span>📦</span>
            </div>
            <div className="mt-1 text-xl sm:text-2xl font-black text-ink">
              {stats.totalOrders}
            </div>
            <p className="text-[10px] text-emerald-700 font-medium mt-0.5">
              Live studio orders
            </p>
          </div>

          <div
            onClick={() => { setActiveTab("orders"); setOrderFilter("Order Received"); }}
            className={`rounded-2xl border p-3 sm:p-4 shadow-2xs transition cursor-pointer active:scale-98 ${
              stats.pendingAction > 0
                ? "border-amber-400 bg-amber-50/70"
                : "border-[#8a614820] bg-white/90"
            }`}
          >
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[#765442]">
              <span>Needs Action</span>
              <span>⏳</span>
            </div>
            <div className={`mt-1 text-xl sm:text-2xl font-black ${stats.pendingAction > 0 ? "text-amber-900" : "text-ink"}`}>
              {stats.pendingAction}
            </div>
            <p className="text-[10px] text-[#765442] font-medium mt-0.5">
              Received / Pending pay
            </p>
          </div>

          <div
            onClick={() => setActiveTab("products")}
            className="rounded-2xl border border-[#8a614820] bg-white/90 p-3 sm:p-4 shadow-2xs hover:border-clay transition cursor-pointer active:scale-98"
          >
            <div className="flex items-center justify-between text-xs text-[#765442] font-semibold uppercase tracking-wider">
              <span>Collection</span>
              <span>🕯️</span>
            </div>
            <div className="mt-1 text-xl sm:text-2xl font-black text-ink">
              {stats.activeProducts} <span className="text-xs text-[#765442] font-normal">/ {stats.totalProducts}</span>
            </div>
            <p className="text-[10px] text-[#765442] font-medium mt-0.5">
              In-stock candles
            </p>
          </div>

          <div className="rounded-2xl border border-[#8a614820] bg-white/90 p-3 sm:p-4 shadow-2xs">
            <div className="flex items-center justify-between text-xs text-[#765442] font-semibold uppercase tracking-wider">
              <span>Total Revenue</span>
              <span>₹</span>
            </div>
            <div className="mt-1 text-xl sm:text-2xl font-black text-clay">
              ₹{stats.totalRevenue.toLocaleString("en-IN")}
            </div>
            <p className="text-[10px] text-emerald-700 font-medium mt-0.5">
              Sales made to date
            </p>
          </div>
        </section>

        {/* ==================================================== */}
        {/* TAB 1: INCOMING & PREVIOUS ORDERS                   */}
        {/* ==================================================== */}
        {activeTab === "orders" && (
          <section className="space-y-4">
            {/* Orders Header & Search / Filter Controls */}
            <div className="rounded-2xl sm:rounded-3xl bg-white/90 border border-[#8a614825] p-3.5 sm:p-5 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#8a614815]">
                <div>
                  <h2 className="display text-xl sm:text-2xl font-bold text-ink flex items-center gap-2">
                    <span>Incoming & Previous Orders</span>
                    <span className="text-xs font-mono font-normal text-[#765442] bg-[#8a614815] px-2.5 py-0.5 rounded-full">
                      {filteredOrders.length} shown
                    </span>
                  </h2>
                  <p className="text-xs text-[#765442] mt-0.5">
                    Browse orders with zero endless scrolling. Search by Customer, Phone, or Order ID.
                  </p>
                </div>

                {/* Card / Table View Toggle (Desktop) & Expand/Collapse all */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={expandAllOrders}
                    className="rounded-xl border border-[#8a614825] bg-white px-2.5 py-1 text-xs font-semibold text-[#765442] hover:text-ink hover:bg-stone-50 transition active:scale-95 shadow-2xs cursor-pointer"
                  >
                    Expand All
                  </button>
                  <button
                    type="button"
                    onClick={collapseAllOrders}
                    className="rounded-xl border border-[#8a614825] bg-white px-2.5 py-1 text-xs font-semibold text-[#765442] hover:text-ink hover:bg-stone-50 transition active:scale-95 shadow-2xs cursor-pointer"
                  >
                    Collapse All
                  </button>
                  <div className="hidden md:flex items-center rounded-xl bg-[#ead8c2]/50 p-0.5 border border-[#8a614820]">
                    <button
                      type="button"
                      onClick={() => setOrderViewMode("cards")}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                        orderViewMode === "cards" ? "bg-white text-ink shadow-2xs" : "text-[#765442]"
                      }`}
                    >
                      Cards
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderViewMode("table")}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                        orderViewMode === "table" ? "bg-white text-ink shadow-2xs" : "text-[#765442]"
                      }`}
                    >
                      Table
                    </button>
                  </div>
                </div>
              </div>

              {/* Search Bar & Sorter */}
              <div className="mt-3 flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <span className="absolute left-3.5 top-2.5 text-stone-400 text-sm">🔍</span>
                  <input
                    type="text"
                    value={orderSearchQuery}
                    onChange={(e) => {
                      setOrderSearchQuery(e.target.value);
                      setCurrentOrderPage(1);
                    }}
                    placeholder="Search by order ID (e.g. CM-), customer name, or phone..."
                    className="w-full rounded-xl border border-[#8a614830] bg-white pl-9 pr-8 py-2 text-sm text-ink outline-clay shadow-2xs"
                  />
                  {orderSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setOrderSearchQuery("")}
                      className="absolute right-2.5 top-2 text-stone-400 hover:text-ink text-xs font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={orderSortBy}
                    onChange={(e) => setOrderSortBy(e.target.value as any)}
                    className="rounded-xl border border-[#8a614830] bg-white px-3 py-2 text-xs font-semibold text-ink outline-clay shadow-2xs cursor-pointer"
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="highest">Highest Amount</option>
                  </select>

                  <select
                    value={ordersPerPage}
                    onChange={(e) => {
                      setOrdersPerPage(Number(e.target.value));
                      setCurrentOrderPage(1);
                    }}
                    className="rounded-xl border border-[#8a614830] bg-white px-2.5 py-2 text-xs font-semibold text-ink outline-clay shadow-2xs cursor-pointer"
                  >
                    <option value={10}>10 per page</option>
                    <option value={20}>20 per page</option>
                    <option value={50}>50 per page</option>
                    <option value={0}>Show all</option>
                  </select>
                </div>
              </div>

              {/* Status Filter Chips */}
              <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                {[
                  { key: "All", label: "All" },
                  { key: "Order Received", label: "📋 Received" },
                  { key: "Preparing", label: "🕯️ Preparing" },
                  { key: "Out for Delivery", label: "🚚 Out for Delivery" },
                  { key: "Delivered", label: "✓ Delivered" },
                  { key: "Payment Pending", label: "⏳ Pending Pay" },
                ].map((st) => (
                  <button
                    key={st.key}
                    type="button"
                    onClick={() => {
                      setOrderFilter(st.key);
                      setCurrentOrderPage(1);
                    }}
                    className={`shrink-0 rounded-full px-3 py-1.5 font-bold transition active:scale-95 cursor-pointer shadow-2xs ${
                      orderFilter === st.key
                        ? "bg-ink text-white"
                        : "bg-white border border-[#8a614820] text-[#765442] hover:bg-stone-50"
                    }`}
                  >
                    <span>{st.label}</span>{" "}
                    <span className="ml-1 opacity-75 font-mono">
                      ({orderCounts[st.key] || 0})
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Orders Listing: Compact Mobile Accordions */}
            {orderViewMode === "cards" || typeof window !== "undefined" && window.innerWidth < 768 ? (
              <div className="space-y-3">
                {paginatedOrders.map((o) => {
                  const isExpanded = expandedOrderIds[o.id];
                  const isHighlighted = highlightedOrderId === o.id;

                  return (
                    <div
                      key={o.id}
                      ref={(el) => { orderCardRefs.current[o.id] = el; }}
                      className={`rounded-2xl sm:rounded-3xl border bg-white shadow-2xs transition-all ${
                        isHighlighted
                          ? "border-amber-400 ring-4 ring-amber-300/50 bg-amber-50/40"
                          : "border-[#8a614820] hover:border-[#8a614840]"
                      }`}
                    >
                      {/* Accordion Card Header - Click anywhere to expand/collapse */}
                      <div
                        onClick={() => toggleOrderExpand(o.id)}
                        className="p-3.5 sm:p-4 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-stone-50/60 transition rounded-2xl"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-extrabold text-clay bg-[#8a614812] px-2 py-0.5 rounded-md">
                              {o.id}
                            </span>
                            <span className="text-xs text-[#765442]">
                              • {formatRelativeTime(o.createdAt)}
                            </span>

                            {/* Status Pill */}
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] sm:text-xs font-bold ${
                                o.status === "Delivered"
                                  ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                                  : o.status === "Out for Delivery"
                                  ? "bg-purple-100 text-purple-900 border border-purple-300"
                                  : o.status === "Preparing"
                                  ? "bg-amber-100 text-amber-900 border border-amber-300"
                                  : o.status === "Payment Pending"
                                  ? "bg-orange-100 text-orange-900 border border-orange-300"
                                  : o.status === "Payment Failed"
                                  ? "bg-rose-100 text-rose-900 border border-rose-300"
                                  : "bg-sky-100 text-sky-900 border border-sky-300"
                              }`}
                            >
                              {o.status}
                            </span>
                          </div>

                          {/* Customer & Items Summary */}
                          <div className="mt-1.5 flex items-center justify-between gap-2">
                            <div className="truncate">
                              <span className="font-bold text-ink text-sm sm:text-base">
                                {o.customer.name}
                              </span>
                              <span className="text-xs text-[#765442] ml-2 truncate hidden sm:inline">
                                ({o.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")})
                              </span>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-base sm:text-lg font-black text-clay">
                                ₹{o.total}
                              </span>
                            </div>
                          </div>

                          {/* Quick Payment Tag preview */}
                          <div className="mt-1 flex items-center gap-1.5 text-[11px]">
                            {o.paymentMethod === "Cashfree Gateway" || (o.screenshot && o.screenshot.startsWith("CASHFREE_")) ? (
                              <span className="text-blue-700 font-semibold">⚡ Cashfree Gateway</span>
                            ) : o.paymentMethod === "PhonePe Gateway" || (o.screenshot && o.screenshot.startsWith("PHONEPE_")) ? (
                              <span className="text-purple-700 font-semibold">⚡ PhonePe Gateway</span>
                            ) : o.screenshot ? (
                              <span className="text-emerald-700 font-semibold">📷 Proof Photo Attached</span>
                            ) : (
                              <span className="text-stone-500">Standard Checkout</span>
                            )}
                          </div>
                        </div>

                        {/* Expand Chevron Icon */}
                        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-[#8a614810] text-[#765442] shrink-0">
                          <span
                            className={`transform transition-transform duration-200 text-xs font-bold ${
                              isExpanded ? "rotate-180" : ""
                            }`}
                          >
                            ▼
                          </span>
                        </div>
                      </div>

                      {/* Accordion Expanded Body */}
                      {isExpanded && (
                        <div className="px-3.5 pb-4 sm:px-5 sm:pb-5 pt-1 border-t border-[#8a614815] bg-[#fffcf7] rounded-b-2xl sm:rounded-b-3xl space-y-3.5 animate-in fade-in duration-200">
                          {/* 1. Customer Details & Quick Contact Action Buttons */}
                          <div className="rounded-2xl bg-white border border-[#8a614815] p-3 text-xs space-y-2">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#8a614810] pb-2">
                              <div>
                                <p className="font-bold text-ink text-sm">
                                  👤 {o.customer.name}
                                </p>
                                <p className="text-[#765442] mt-0.5">
                                  📞 {o.customer.phone}
                                </p>
                              </div>

                              {/* Quick 1-Tap Customer Buttons */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <a
                                  href={`tel:${o.customer.phone}`}
                                  className="inline-flex items-center gap-1 rounded-xl bg-ink text-white px-3 py-1.5 font-bold hover:bg-clay transition active:scale-95 shadow-2xs"
                                >
                                  <span>📞 Call</span>
                                </a>
                                <a
                                  href={getWhatsAppUrl(o)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 rounded-xl bg-[#25D366] text-white px-3 py-1.5 font-bold hover:bg-[#1EBE5D] transition active:scale-95 shadow-2xs"
                                >
                                  <span>💬 WhatsApp</span>
                                </a>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(`${o.customer.name}\n${o.customer.phone}\n${o.customer.address}`, "Order Details")}
                                  className="rounded-xl border border-[#8a614825] bg-white px-2.5 py-1.5 font-semibold text-[#765442] hover:bg-stone-50 transition active:scale-95 shadow-2xs"
                                >
                                  📋 Copy Info
                                </button>
                              </div>
                            </div>

                            <div className="flex items-start justify-between gap-2 pt-1">
                              <p className="text-[#765442] text-xs leading-relaxed break-words">
                                <span className="font-bold text-ink">📍 Delivery Address:</span> {o.customer.address}
                              </p>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(o.customer.address, "Delivery Address")}
                                className="shrink-0 text-[11px] text-clay font-semibold hover:underline"
                              >
                                Copy Address
                              </button>
                            </div>
                          </div>

                          {/* 2. Ordered Candles Breakdown */}
                          <div className="rounded-2xl bg-white border border-[#8a614815] p-3 text-xs">
                            <div className="flex items-center justify-between text-[#765442] font-semibold uppercase tracking-wider text-[10px] pb-1.5 border-b border-[#8a614810]">
                              <span>Items Ordered ({o.items.reduce((s, i) => s + (i.quantity || 1), 0)})</span>
                              <span>Total</span>
                            </div>
                            <div className="divide-y divide-[#8a61480d]">
                              {o.items.map((item, idx) => (
                                <div key={idx} className="py-2 flex items-center justify-between gap-2">
                                  <div>
                                    <p className="font-bold text-ink">
                                      {item.quantity}× {item.name}
                                    </p>
                                    <p className="text-[11px] text-[#765442]">
                                      ₹{item.price} each {item.category ? `· ${item.category}` : ""}
                                    </p>
                                  </div>
                                  <div className="font-black text-clay">
                                    ₹{item.price * item.quantity}
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="pt-2 border-t border-[#8a614815] flex items-center justify-between font-bold text-sm">
                              <span>Order Total:</span>
                              <span className="text-base text-clay font-black">₹{o.total}</span>
                            </div>
                          </div>

                          {/* 3. Payment Verification & Screenshot View */}
                          <div className="rounded-2xl bg-white border border-[#8a614815] p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[#765442] block mb-1">
                                Payment Verification
                              </span>
                              {o.paymentMethod === "Cashfree Gateway" || (o.screenshot && o.screenshot.startsWith("CASHFREE_")) ? (
                                <div className="flex items-center gap-2 flex-wrap">
                                  {o.paymentStatus === "SUCCESS" || o.status === "Order Received" ? (
                                    <span className="inline-flex items-center gap-1 rounded-xl bg-blue-50 border border-blue-200 px-2.5 py-1 text-xs font-bold text-blue-900">
                                      ⚡ Cashfree Auto-Verified ✓
                                    </span>
                                  ) : (
                                    <div className="flex items-center gap-1.5">
                                      <span className="rounded-xl bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs font-semibold text-amber-800">
                                        ⏳ Cashfree Pending
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => verifyGatewayOrder(o.id)}
                                        className="rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 px-2.5 py-1 text-xs font-bold"
                                      >
                                        🔄 Check Status
                                      </button>
                                    </div>
                                  )}
                                  {o.transactionId && (
                                    <span className="text-[10px] font-mono text-[#765442]">
                                      ID: {o.transactionId}
                                    </span>
                                  )}
                                </div>
                              ) : o.screenshot ? (
                                <div className="flex items-center gap-2.5">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedScreenshotOrder(o)}
                                    className="inline-flex items-center gap-2 rounded-xl border border-clay/30 bg-[#fff8ed] p-1.5 pr-3 hover:bg-clay hover:text-white transition shadow-2xs group"
                                  >
                                    <img
                                      src={o.screenshot}
                                      alt="Proof"
                                      className="h-8 w-8 rounded-lg object-cover"
                                    />
                                    <span className="font-bold text-clay group-hover:text-white">
                                      View Payment Proof ↗
                                    </span>
                                  </button>
                                  <span className="text-[10px] text-[#8a4e1d]">
                                    ⏱ {getScreenshotExpiryInfo(o.createdAt, o.screenshotExpiresAt).timeLeftText}
                                  </span>
                                </div>
                              ) : o.screenshotExpired || getScreenshotExpiryInfo(o.createdAt, o.screenshotExpiresAt).isExpired ? (
                                <span className="text-stone-500 bg-stone-100 px-2 py-0.5 rounded text-[11px]">
                                  Screenshot Purged (3d limit)
                                </span>
                              ) : (
                                <span className="text-stone-500">No screenshot attached</span>
                              )}
                            </div>

                            {/* 4. Touch-Friendly Status Updater */}
                            <div className="w-full sm:w-auto">
                              <label className="text-[10px] font-bold uppercase tracking-wider text-[#765442] block mb-1">
                                Update Status
                              </label>
                              <select
                                value={o.status}
                                onChange={(e) => status(o.id, e.target.value as OrderStatus)}
                                className={`w-full sm:w-auto rounded-xl border font-bold px-3 py-2 text-xs transition cursor-pointer shadow-2xs ${
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
                        </div>
                      )}
                    </div>
                  );
                })}

                {!filteredOrders.length && (
                  <div className="rounded-3xl border border-[#8a614820] bg-white p-10 text-center text-[#765442]">
                    <p className="text-2xl mb-1">📦</p>
                    <p className="font-bold text-ink">No orders found</p>
                    <p className="text-xs text-[#765442] mt-1">
                      Try clearing your search query or selecting a different status filter.
                    </p>
                    {orderSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setOrderSearchQuery("")}
                        className="mt-3 rounded-xl bg-ink text-white px-4 py-1.5 text-xs font-semibold"
                      >
                        Clear Search
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Desktop Table View */
              <div className="overflow-x-auto rounded-3xl border border-[#8a614825] bg-white shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#ead8c2]/50 text-xs uppercase tracking-wide text-[#765442]">
                    <tr>
                      <th className="p-3.5">Order</th>
                      <th>Customer</th>
                      <th>Items</th>
                      <th>Total</th>
                      <th>Payment</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#8a614815]">
                    {paginatedOrders.map((o) => (
                      <tr key={o.id} className="hover:bg-stone-50/70 transition">
                        <td className="p-3.5 font-bold font-mono text-clay text-xs">
                          {o.id}
                        </td>
                        <td className="p-3.5">
                          <p className="font-bold text-ink">{o.customer.name}</p>
                          <a href={`tel:${o.customer.phone}`} className="text-xs text-clay underline">
                            {o.customer.phone}
                          </a>
                        </td>
                        <td className="p-3.5 text-xs">
                          {o.items.map((i, idx) => (
                            <div key={idx}>
                              {i.quantity}× {i.name}
                            </div>
                          ))}
                        </td>
                        <td className="p-3.5 font-black text-clay">₹{o.total}</td>
                        <td className="p-3.5 text-xs">
                          {o.paymentMethod === "Cashfree Gateway" || (o.screenshot && o.screenshot.startsWith("CASHFREE_")) ? (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-blue-50 text-blue-900 border border-blue-200 px-2 py-0.5 font-bold text-[11px]">
                              ⚡ Cashfree
                            </span>
                          ) : o.screenshot ? (
                            <button
                              type="button"
                              onClick={() => setSelectedScreenshotOrder(o)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-clay/30 bg-[#fff8ed] px-2 py-1 text-[11px] font-bold text-clay hover:bg-clay hover:text-white transition"
                            >
                              <img src={o.screenshot} alt="" className="h-4 w-4 rounded object-cover" />
                              <span>Proof ↗</span>
                            </button>
                          ) : (
                            <span className="text-stone-400">—</span>
                          )}
                        </td>
                        <td className="p-3.5">
                          <select
                            value={o.status}
                            onChange={(e) => status(o.id, e.target.value as OrderStatus)}
                            className="rounded-xl border border-[#8a614830] px-2.5 py-1 text-xs font-bold"
                          >
                            {statuses.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-3.5 text-xs text-[#765442]">
                          {formatRelativeTime(o.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {totalOrderPages > 1 && (
              <div className="rounded-2xl bg-white border border-[#8a614820] p-3 sm:p-4 flex items-center justify-between gap-2">
                <p className="text-xs text-[#765442] font-medium">
                  Page <b className="text-ink">{currentOrderPage}</b> of <b className="text-ink">{totalOrderPages}</b> ({filteredOrders.length} orders)
                </p>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={currentOrderPage <= 1}
                    onClick={() => setCurrentOrderPage((p) => Math.max(1, p - 1))}
                    className="rounded-xl border border-[#8a614825] px-3 py-1.5 text-xs font-bold text-[#765442] hover:bg-stone-50 disabled:opacity-40 cursor-pointer active:scale-95"
                  >
                    ← Previous
                  </button>

                  <div className="hidden sm:flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalOrderPages) }, (_, i) => {
                      let pageNum = i + 1;
                      if (totalOrderPages > 5 && currentOrderPage > 3) {
                        pageNum = currentOrderPage - 2 + i;
                        if (pageNum > totalOrderPages) pageNum = totalOrderPages - (4 - i);
                      }
                      return (
                        <button
                          key={pageNum}
                          type="button"
                          onClick={() => setCurrentOrderPage(pageNum)}
                          className={`h-8 w-8 rounded-xl text-xs font-bold transition ${
                            currentOrderPage === pageNum
                              ? "bg-ink text-white"
                              : "border border-[#8a614820] text-[#765442] hover:bg-stone-50"
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    disabled={currentOrderPage >= totalOrderPages}
                    onClick={() => setCurrentOrderPage((p) => Math.min(totalOrderPages, p + 1))}
                    className="rounded-xl border border-[#8a614825] px-3 py-1.5 text-xs font-bold text-[#765442] hover:bg-stone-50 disabled:opacity-40 cursor-pointer active:scale-95"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ==================================================== */}
        {/* TAB 2: PRODUCTS & COLLECTION MANAGEMENT              */}
        {/* ==================================================== */}
        {activeTab === "products" && (
          <section className="space-y-4">
            {/* Products Action Bar */}
            <div className="rounded-2xl sm:rounded-3xl bg-white/90 border border-[#8a614825] p-3.5 sm:p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="display text-xl sm:text-2xl font-bold text-ink flex items-center gap-2">
                  <span>Candle Collection</span>
                  <span className="text-xs font-mono font-normal text-[#765442] bg-[#8a614815] px-2.5 py-0.5 rounded-full">
                    {filteredProducts.length} candles
                  </span>
                </h2>
                <p className="text-xs text-[#765442] mt-0.5">
                  Manage candle prices, stock availability, specifications, and photography.
                </p>
              </div>

              {/* Direct Add Product Button */}
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-ink hover:bg-clay text-white px-5 py-2.5 text-sm font-bold shadow-sm transition active:scale-95 cursor-pointer shrink-0"
              >
                <span className="text-lg leading-none">+</span>
                <span>Add New Candle</span>
              </button>
            </div>

            {/* Product Filters & Search */}
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <span className="absolute left-3.5 top-2.5 text-stone-400 text-sm">🔍</span>
                <input
                  type="text"
                  value={productSearchQuery}
                  onChange={(e) => setProductSearchQuery(e.target.value)}
                  placeholder="Search candles by name or scent..."
                  className="w-full rounded-xl border border-[#8a614830] bg-white pl-9 pr-3 py-2 text-sm text-ink outline-clay shadow-2xs"
                />
              </div>

              <select
                value={productCategoryFilter}
                onChange={(e) => setProductCategoryFilter(e.target.value)}
                className="rounded-xl border border-[#8a614830] bg-white px-3 py-2 text-xs font-semibold text-ink outline-clay shadow-2xs cursor-pointer"
              >
                {productCategories.map((c) => (
                  <option key={c} value={c}>
                    {c === "All" ? "All Categories" : c}
                  </option>
                ))}
              </select>
            </div>

            {/* Products Grid */}
            <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredProducts.map((p) => (
                <div
                  key={p.id}
                  className="rounded-2xl border border-[#8a614820] bg-white p-3.5 sm:p-4 shadow-sm flex flex-col justify-between"
                >
                  <div>
                    {/* Top image + details */}
                    <div className="flex items-start gap-3">
                      <div className="relative h-20 w-20 rounded-xl overflow-hidden bg-stone-100 border border-[#8a614815] shrink-0">
                        <img
                          src={p.images?.[0] || "/hero-candle.jpg"}
                          alt={p.name}
                          className="h-full w-full object-cover"
                        />
                        {p.available === false && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-[10px] font-bold text-white uppercase">
                            Sold Out
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="font-bold text-ink text-sm sm:text-base truncate">
                            {p.name}
                          </span>
                        </div>
                        <p className="text-base font-black text-clay mt-0.5">
                          ₹{p.price}
                        </p>
                        <span className="inline-block rounded-md bg-[#8a614815] px-2 py-0.5 text-[10px] font-bold text-clay mt-1">
                          {p.category}
                        </span>
                      </div>
                    </div>

                    {/* Specification tags */}
                    <div className="mt-2.5 flex flex-wrap gap-1 text-[10px]">
                      {p.fragrance && (
                        <span className="rounded-md bg-[#f4ece3] px-2 py-0.5 text-[#6c4832] font-medium">
                          🌸 {p.fragrance}
                        </span>
                      )}
                      {p.burnTime && (
                        <span className="rounded-md bg-[#f4ece3] px-2 py-0.5 text-[#6c4832] font-medium">
                          ⏳ {p.burnTime}
                        </span>
                      )}
                      {p.wickSize && (
                        <span className="rounded-md bg-[#f4ece3] px-2 py-0.5 text-[#6c4832] font-medium">
                          🕯️ {p.wickSize}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions footer */}
                  <div className="mt-3.5 pt-2.5 border-t border-[#8a614815] flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => updateProduct(p, { available: !p.available })}
                      className={`rounded-xl px-3 py-1.5 text-xs font-bold transition active:scale-95 cursor-pointer shadow-2xs ${
                        p.available !== false
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          : "bg-stone-100 text-stone-600 border border-stone-300"
                      }`}
                    >
                      {p.available !== false ? "✓ In Stock" : "✕ Sold Out"}
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => startEditingProduct(p)}
                        className="rounded-xl bg-ink text-white px-3 py-1.5 text-xs font-bold hover:bg-clay transition active:scale-95 shadow-2xs"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => remove(p.id)}
                        className="rounded-xl border border-red-200 text-red-700 hover:bg-red-50 px-2.5 py-1.5 text-xs font-semibold transition active:scale-95"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {!filteredProducts.length && (
              <div className="rounded-3xl border border-[#8a614820] bg-white p-10 text-center text-[#765442]">
                <p className="text-2xl mb-1">🕯️</p>
                <p className="font-bold text-ink">No candles found</p>
                <p className="text-xs text-[#765442] mt-1">
                  Click &ldquo;Add New Candle&rdquo; to introduce a new handcrafted candle to your collection.
                </p>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  className="mt-3 rounded-xl bg-ink text-white px-4 py-2 text-xs font-bold"
                >
                  + Add Candle Now
                </button>
              </div>
            )}
          </section>
        )}

        {/* ==================================================== */}
        {/* TAB 3: STUDIO SETTINGS & DIAGNOSTICS                 */}
        {/* ==================================================== */}
        {activeTab === "settings" && (
          <section className="space-y-4 max-w-2xl mx-auto">
            {/* Payment Destination Settings */}
            <form
              onSubmit={payment}
              className="rounded-3xl bg-white p-4 sm:p-6 shadow-sm border border-[#8a614820]"
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">💳</span>
                <h3 className="font-bold text-ink text-base sm:text-lg">
                  Payment QR Destination
                </h3>
              </div>
              <p className="mt-1 text-xs text-[#765442]">
                Customer checkout automatically generates instant UPI QR codes linked to this ID.
              </p>
              <input
                value={upi}
                onChange={(e) => setUpi(e.target.value)}
                className="mt-3 w-full rounded-xl border border-[#8a614830] p-3 text-sm text-ink outline-clay font-medium"
                placeholder="e.g. name@upi"
              />
              <button
                type="submit"
                className="mt-3 rounded-xl bg-ink px-5 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-clay transition active:scale-95 cursor-pointer shadow-2xs"
              >
                Save UPI Destination
              </button>
            </form>

            {/* Password Management */}
            <form
              onSubmit={password}
              className="rounded-3xl bg-white p-4 sm:p-6 shadow-sm border border-[#8a614820]"
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">🔒</span>
                <h3 className="font-bold text-ink text-base sm:text-lg">
                  Change Studio Password
                </h3>
              </div>
              <p className="mt-1 text-xs text-[#765442]">
                Keep your studio dashboard protected.
              </p>
              <div className="mt-3 space-y-2.5">
                <input
                  name="currentPassword"
                  type="password"
                  required
                  className="w-full rounded-xl border border-[#8a614830] p-3 text-sm text-ink outline-clay"
                  placeholder="Current password"
                />
                <input
                  name="newPassword"
                  type="password"
                  required
                  minLength={8}
                  className="w-full rounded-xl border border-[#8a614830] p-3 text-sm text-ink outline-clay"
                  placeholder="New password (min 8 characters)"
                />
              </div>
              <button
                type="submit"
                className="mt-3 rounded-xl bg-ink px-5 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-clay transition active:scale-95 cursor-pointer shadow-2xs"
              >
                Update Password
              </button>
            </form>

            {/* Cloud Storage & Sync Diagnostics */}
            <div className="rounded-3xl bg-white p-4 sm:p-6 shadow-sm border border-[#8a614820]">
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                <h3 className="font-bold text-ink text-sm sm:text-base">
                  Cloud Storage & Auto-Sync
                </h3>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-[#765442]">
                Customer orders are persisted in <b>Supabase PostgreSQL</b> and payment proof screenshots are saved in the <b>payment-proofs</b> bucket. Real-time updates push directly to this studio dashboard.
              </p>
              <div className="mt-3 rounded-xl bg-emerald-50 p-3 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                <span>✓ Zero-crash Cloudflare worker architecture active</span>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* ==================================================== */}
      {/* 5. DEDICATED ADD CANDLE MODAL                        */}
      {/* ==================================================== */}
      {isAddModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-2 sm:p-4 backdrop-blur-sm overflow-y-auto"
          onClick={() => setIsAddModalOpen(false)}
        >
          <div
            className="relative flex max-h-[96vh] sm:max-h-[92vh] w-full max-w-2xl flex-col rounded-3xl bg-[#fff8ed] shadow-2xl border border-[#8a61483a] overflow-hidden my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#8a614820] bg-[#f5ede0] px-4 sm:px-6 py-3.5">
              <div className="flex items-center gap-2">
                <span className="text-xl">🕯️</span>
                <div>
                  <h3 className="display text-lg sm:text-xl font-bold text-ink">
                    Add New Candle
                  </h3>
                  <p className="text-[11px] text-[#765442]">
                    Instantly creates candle in database and displays on storefront.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-base font-bold text-[#765442] hover:bg-clay hover:text-white transition shadow-xs"
              >
                ✕
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={add} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                {/* Candle Name & Price */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#765442] mb-1">
                      Candle Name *
                    </label>
                    <input
                      required
                      value={draft.name}
                      onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                      placeholder="e.g. Amber & Sandalwood"
                      className="w-full rounded-xl border border-[#8a614830] bg-white px-3.5 py-2.5 text-sm text-ink outline-clay shadow-2xs font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#765442] mb-1">
                      Price (₹ INR) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-2.5 text-sm font-bold text-[#765442]">₹</span>
                      <input
                        required
                        min="0"
                        step="1"
                        type="number"
                        value={draft.price}
                        onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                        placeholder="e.g. 649"
                        className="w-full rounded-xl border border-[#8a614830] bg-white pl-8 pr-3.5 py-2.5 text-sm font-bold text-ink outline-clay shadow-2xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#765442] mb-1">
                    Category *
                  </label>
                  <select
                    value={draft.category}
                    onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                    className="w-full rounded-xl border border-[#8a614830] bg-white px-3.5 py-2.5 text-sm text-ink outline-clay shadow-2xs cursor-pointer"
                  >
                    <option value="Jar candle">Jar candle</option>
                    <option value="Sculptural">Sculptural</option>
                    <option value="Flower candle">Flower candle</option>
                    <option value="Tin candle">Tin candle</option>
                    <option value="Wax melts">Wax melts</option>
                    <option value="Aromatherapy">Aromatherapy</option>
                  </select>
                </div>

                {/* Tickable Specifications */}
                <div className="rounded-2xl border border-[#8a614825] bg-[#fff6eb]/60 p-3.5 sm:p-4 space-y-3">
                  <div className="border-b border-[#8a614815] pb-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-ink flex items-center gap-1.5">
                      <span>⚙️</span> Specifications (Tick to Include)
                    </h4>
                    <p className="text-[11px] text-[#765442] mt-0.5">
                      Tick a detail to include it on the store page. If ticked, it <b>must be filled</b>.
                    </p>
                  </div>

                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {/* Wick Size */}
                    <div className={`rounded-xl border p-2.5 transition ${draftSpecsEnabled.wickSize ? "border-emerald-300 bg-white" : "border-stone-200 bg-stone-100/70"}`}>
                      <label className="flex items-center justify-between cursor-pointer py-0.5">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={draftSpecsEnabled.wickSize}
                            onChange={(e) => setDraftSpecsEnabled((p) => ({ ...p, wickSize: e.target.checked }))}
                            className="h-4 w-4 rounded accent-[#9b4a1b]"
                          />
                          <span className="text-xs font-bold text-ink">🕯️ Wick Size</span>
                        </div>
                        <span className={`text-[10px] font-bold ${draftSpecsEnabled.wickSize ? "text-emerald-700" : "text-stone-500"}`}>
                          {draftSpecsEnabled.wickSize ? "✓ Ticked" : "Excluded"}
                        </span>
                      </label>
                      <input
                        type="text"
                        disabled={!draftSpecsEnabled.wickSize}
                        value={draftSpecsEnabled.wickSize ? draft.wickSize : ""}
                        onChange={(e) => setDraft({ ...draft, wickSize: e.target.value })}
                        placeholder="e.g. 24-ply braided cotton wick"
                        className="mt-1.5 w-full rounded-lg border border-[#8a614830] px-2.5 py-1.5 text-xs disabled:bg-stone-100 disabled:opacity-50"
                      />
                    </div>

                    {/* Dimensions */}
                    <div className={`rounded-xl border p-2.5 transition ${draftSpecsEnabled.candleDimensions ? "border-emerald-300 bg-white" : "border-stone-200 bg-stone-100/70"}`}>
                      <label className="flex items-center justify-between cursor-pointer py-0.5">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={draftSpecsEnabled.candleDimensions}
                            onChange={(e) => setDraftSpecsEnabled((p) => ({ ...p, candleDimensions: e.target.checked }))}
                            className="h-4 w-4 rounded accent-[#9b4a1b]"
                          />
                          <span className="text-xs font-bold text-ink">📏 Dimensions</span>
                        </div>
                        <span className={`text-[10px] font-bold ${draftSpecsEnabled.candleDimensions ? "text-emerald-700" : "text-stone-500"}`}>
                          {draftSpecsEnabled.candleDimensions ? "✓ Ticked" : "Excluded"}
                        </span>
                      </label>
                      <input
                        type="text"
                        disabled={!draftSpecsEnabled.candleDimensions}
                        value={draftSpecsEnabled.candleDimensions ? draft.candleDimensions : ""}
                        onChange={(e) => setDraft({ ...draft, candleDimensions: e.target.value })}
                        placeholder="e.g. 7.5 cm × 9 cm"
                        className="mt-1.5 w-full rounded-lg border border-[#8a614830] px-2.5 py-1.5 text-xs disabled:bg-stone-100 disabled:opacity-50"
                      />
                    </div>

                    {/* Fragrance */}
                    <div className={`rounded-xl border p-2.5 transition ${draftSpecsEnabled.fragrance ? "border-emerald-300 bg-white" : "border-stone-200 bg-stone-100/70"}`}>
                      <label className="flex items-center justify-between cursor-pointer py-0.5">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={draftSpecsEnabled.fragrance}
                            onChange={(e) => setDraftSpecsEnabled((p) => ({ ...p, fragrance: e.target.checked }))}
                            className="h-4 w-4 rounded accent-[#9b4a1b]"
                          />
                          <span className="text-xs font-bold text-ink">🌸 Fragrance</span>
                        </div>
                        <span className={`text-[10px] font-bold ${draftSpecsEnabled.fragrance ? "text-emerald-700" : "text-stone-500"}`}>
                          {draftSpecsEnabled.fragrance ? "✓ Ticked" : "Excluded"}
                        </span>
                      </label>
                      <input
                        type="text"
                        disabled={!draftSpecsEnabled.fragrance}
                        value={draftSpecsEnabled.fragrance ? draft.fragrance : ""}
                        onChange={(e) => setDraft({ ...draft, fragrance: e.target.value })}
                        placeholder="e.g. French Vanilla & Amber"
                        className="mt-1.5 w-full rounded-lg border border-[#8a614830] px-2.5 py-1.5 text-xs disabled:bg-stone-100 disabled:opacity-50"
                      />
                    </div>

                    {/* Burn Time */}
                    <div className={`rounded-xl border p-2.5 transition ${draftSpecsEnabled.burnTime ? "border-emerald-300 bg-white" : "border-stone-200 bg-stone-100/70"}`}>
                      <label className="flex items-center justify-between cursor-pointer py-0.5">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={draftSpecsEnabled.burnTime}
                            onChange={(e) => setDraftSpecsEnabled((p) => ({ ...p, burnTime: e.target.checked }))}
                            className="h-4 w-4 rounded accent-[#9b4a1b]"
                          />
                          <span className="text-xs font-bold text-ink">⏳ Burn Time</span>
                        </div>
                        <span className={`text-[10px] font-bold ${draftSpecsEnabled.burnTime ? "text-emerald-700" : "text-stone-500"}`}>
                          {draftSpecsEnabled.burnTime ? "✓ Ticked" : "Excluded"}
                        </span>
                      </label>
                      <input
                        type="text"
                        disabled={!draftSpecsEnabled.burnTime}
                        value={draftSpecsEnabled.burnTime ? draft.burnTime : ""}
                        onChange={(e) => setDraft({ ...draft, burnTime: e.target.value })}
                        placeholder="e.g. 35–40 hours"
                        className="mt-1.5 w-full rounded-lg border border-[#8a614830] px-2.5 py-1.5 text-xs disabled:bg-stone-100 disabled:opacity-50"
                      />
                    </div>

                    {/* Ingredients */}
                    <div className={`rounded-xl border p-2.5 transition ${draftSpecsEnabled.ingredients ? "border-emerald-300 bg-white" : "border-stone-200 bg-stone-100/70"}`}>
                      <label className="flex items-center justify-between cursor-pointer py-0.5">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={draftSpecsEnabled.ingredients}
                            onChange={(e) => setDraftSpecsEnabled((p) => ({ ...p, ingredients: e.target.checked }))}
                            className="h-4 w-4 rounded accent-[#9b4a1b]"
                          />
                          <span className="text-xs font-bold text-ink">🌿 Ingredients</span>
                        </div>
                        <span className={`text-[10px] font-bold ${draftSpecsEnabled.ingredients ? "text-emerald-700" : "text-stone-500"}`}>
                          {draftSpecsEnabled.ingredients ? "✓ Ticked" : "Excluded"}
                        </span>
                      </label>
                      <input
                        type="text"
                        disabled={!draftSpecsEnabled.ingredients}
                        value={draftSpecsEnabled.ingredients ? draft.ingredients : ""}
                        onChange={(e) => setDraft({ ...draft, ingredients: e.target.value })}
                        placeholder="e.g. 100% Pure Soy Wax"
                        className="mt-1.5 w-full rounded-lg border border-[#8a614830] px-2.5 py-1.5 text-xs disabled:bg-stone-100 disabled:opacity-50"
                      />
                    </div>

                    {/* Description */}
                    <div className={`rounded-xl border p-2.5 transition ${draftSpecsEnabled.description ? "border-emerald-300 bg-white" : "border-stone-200 bg-stone-100/70"}`}>
                      <label className="flex items-center justify-between cursor-pointer py-0.5">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={draftSpecsEnabled.description}
                            onChange={(e) => setDraftSpecsEnabled((p) => ({ ...p, description: e.target.checked }))}
                            className="h-4 w-4 rounded accent-[#9b4a1b]"
                          />
                          <span className="text-xs font-bold text-ink">📝 Description</span>
                        </div>
                        <span className={`text-[10px] font-bold ${draftSpecsEnabled.description ? "text-emerald-700" : "text-stone-500"}`}>
                          {draftSpecsEnabled.description ? "✓ Ticked" : "Excluded"}
                        </span>
                      </label>
                      <input
                        type="text"
                        disabled={!draftSpecsEnabled.description}
                        value={draftSpecsEnabled.description ? draft.description : ""}
                        onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                        placeholder="e.g. Handcrafted with warm cozy notes"
                        className="mt-1.5 w-full rounded-lg border border-[#8a614830] px-2.5 py-1.5 text-xs disabled:bg-stone-100 disabled:opacity-50"
                      />
                    </div>
                  </div>
                </div>

                {/* Photos Upload Section */}
                <div className="rounded-2xl border border-[#8a614825] bg-white p-3.5 sm:p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-ink">
                        Product Photos *
                      </h4>
                      <p className="text-[11px] text-[#765442]">
                        Upload images directly from your phone/camera or enter URLs.
                      </p>
                    </div>

                    <label className="inline-flex items-center gap-1.5 rounded-xl bg-ink text-white px-3 py-1.5 text-xs font-bold hover:bg-clay transition cursor-pointer active:scale-95 shadow-2xs">
                      <span>📷 Upload Photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleDraftFiles}
                        disabled={isProcessingPhoto}
                      />
                    </label>
                  </div>

                  {/* Uploaded thumbnails */}
                  {uploadedPhotos.length > 0 && (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-1">
                      {uploadedPhotos.map((url, idx) => (
                        <div key={idx} className="relative group rounded-xl overflow-hidden border border-[#8a614820] aspect-square">
                          <img src={url} alt="" className="h-full w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeUploadedPhoto(idx)}
                            className="absolute top-1 right-1 h-6 w-6 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center hover:bg-red-700"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* URL fallback */}
                  <textarea
                    rows={2}
                    value={draft.images}
                    onChange={(e) => setDraft({ ...draft, images: e.target.value })}
                    placeholder="Or paste image URLs (one per line)..."
                    className="w-full rounded-xl border border-[#8a614830] p-2.5 text-xs text-ink outline-clay"
                  />
                </div>
              </div>

              {/* Modal Footer Controls */}
              <div className="flex items-center justify-between gap-3 border-t border-[#8a614820] bg-[#f5ede0] px-4 sm:px-6 py-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="rounded-xl border border-[#8a614830] bg-white px-4 py-2 text-xs sm:text-sm font-bold text-[#765442] hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessingPhoto || isSubmittingProduct}
                  className="rounded-xl bg-ink hover:bg-clay text-white px-6 py-2.5 text-xs sm:text-sm font-bold shadow-md transition active:scale-95 disabled:opacity-50"
                >
                  {isSubmittingProduct ? "Adding Candle..." : "+ Add Candle to Store"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 6. PRODUCT EDIT MODAL                                */}
      {/* ==================================================== */}
      {editingProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-2 sm:p-4 backdrop-blur-sm overflow-y-auto"
          onClick={closeEditingProduct}
        >
          <div
            className="relative flex max-h-[96vh] sm:max-h-[92vh] w-full max-w-2xl flex-col rounded-3xl bg-[#fff8ed] shadow-2xl border border-[#8a61483a] overflow-hidden my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#8a614820] bg-[#f5ede0] px-4 sm:px-6 py-3.5">
              <div>
                <h3 className="display text-lg sm:text-xl font-bold text-ink">
                  Edit Candle: {editingProduct.name}
                </h3>
                <p className="text-[11px] text-[#765442]">
                  Changes save directly to cloud database & update storefront.
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditingProduct}
                disabled={isSavingProduct}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-base font-bold text-[#765442] hover:bg-clay hover:text-white transition shadow-xs"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={saveEditedProduct} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#765442] mb-1">
                      Candle Name *
                    </label>
                    <input
                      required
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full rounded-xl border border-[#8a614830] bg-white px-3.5 py-2.5 text-sm font-medium text-ink outline-clay shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#765442] mb-1">
                      Price (₹ INR) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-2.5 text-sm font-bold text-[#765442]">₹</span>
                      <input
                        required
                        min="0"
                        step="1"
                        type="number"
                        value={editForm.price}
                        onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                        className="w-full rounded-xl border border-[#8a614830] bg-white pl-8 pr-3.5 py-2.5 text-sm font-bold text-ink outline-clay shadow-2xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#765442] mb-1">
                      Category
                    </label>
                    <select
                      value={editForm.category}
                      onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                      className="w-full rounded-xl border border-[#8a614830] bg-white px-3.5 py-2.5 text-sm text-ink outline-clay shadow-2xs"
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
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#765442] mb-1">
                      Availability
                    </label>
                    <button
                      type="button"
                      onClick={() => setEditForm({ ...editForm, available: !editForm.available })}
                      className={`w-full rounded-xl border px-3.5 py-2.5 text-sm font-bold transition flex items-center justify-between shadow-2xs ${
                        editForm.available
                          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                          : "border-stone-300 bg-stone-100 text-stone-600"
                      }`}
                    >
                      <span>{editForm.available ? "✓ In Stock" : "✕ Sold Out"}</span>
                      <span className="text-xs underline opacity-75">Click to Toggle</span>
                    </button>
                  </div>
                </div>

                {/* Edit Specifications */}
                <div className="rounded-2xl border border-[#8a614825] bg-[#fff6eb]/60 p-3.5 sm:p-4 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-ink border-b border-[#8a614815] pb-2">
                    Specifications (Tick to Include)
                  </h4>

                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <div className={`rounded-xl border p-2.5 ${editSpecsEnabled.wickSize ? "border-emerald-300 bg-white" : "border-stone-200 bg-stone-100/70"}`}>
                      <label className="flex items-center justify-between cursor-pointer py-0.5">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={editSpecsEnabled.wickSize}
                            onChange={(e) => setEditSpecsEnabled((p) => ({ ...p, wickSize: e.target.checked }))}
                            className="h-4 w-4 rounded accent-[#9b4a1b]"
                          />
                          <span className="text-xs font-bold text-ink">🕯️ Wick Size</span>
                        </div>
                        <span className={`text-[10px] font-bold ${editSpecsEnabled.wickSize ? "text-emerald-700" : "text-stone-500"}`}>
                          {editSpecsEnabled.wickSize ? "✓ Ticked" : "Excluded"}
                        </span>
                      </label>
                      <input
                        type="text"
                        disabled={!editSpecsEnabled.wickSize}
                        value={editSpecsEnabled.wickSize ? editForm.wickSize : ""}
                        onChange={(e) => setEditForm({ ...editForm, wickSize: e.target.value })}
                        placeholder="e.g. 24-ply braided cotton wick"
                        className="mt-1.5 w-full rounded-lg border border-[#8a614830] px-2.5 py-1.5 text-xs disabled:bg-stone-100 disabled:opacity-50"
                      />
                    </div>

                    <div className={`rounded-xl border p-2.5 ${editSpecsEnabled.candleDimensions ? "border-emerald-300 bg-white" : "border-stone-200 bg-stone-100/70"}`}>
                      <label className="flex items-center justify-between cursor-pointer py-0.5">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={editSpecsEnabled.candleDimensions}
                            onChange={(e) => setEditSpecsEnabled((p) => ({ ...p, candleDimensions: e.target.checked }))}
                            className="h-4 w-4 rounded accent-[#9b4a1b]"
                          />
                          <span className="text-xs font-bold text-ink">📏 Dimensions</span>
                        </div>
                        <span className={`text-[10px] font-bold ${editSpecsEnabled.candleDimensions ? "text-emerald-700" : "text-stone-500"}`}>
                          {editSpecsEnabled.candleDimensions ? "✓ Ticked" : "Excluded"}
                        </span>
                      </label>
                      <input
                        type="text"
                        disabled={!editSpecsEnabled.candleDimensions}
                        value={editSpecsEnabled.candleDimensions ? editForm.candleDimensions : ""}
                        onChange={(e) => setEditForm({ ...editForm, candleDimensions: e.target.value })}
                        placeholder="e.g. 7.5 cm × 9 cm"
                        className="mt-1.5 w-full rounded-lg border border-[#8a614830] px-2.5 py-1.5 text-xs disabled:bg-stone-100 disabled:opacity-50"
                      />
                    </div>

                    <div className={`rounded-xl border p-2.5 ${editSpecsEnabled.fragrance ? "border-emerald-300 bg-white" : "border-stone-200 bg-stone-100/70"}`}>
                      <label className="flex items-center justify-between cursor-pointer py-0.5">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={editSpecsEnabled.fragrance}
                            onChange={(e) => setEditSpecsEnabled((p) => ({ ...p, fragrance: e.target.checked }))}
                            className="h-4 w-4 rounded accent-[#9b4a1b]"
                          />
                          <span className="text-xs font-bold text-ink">🌸 Fragrance</span>
                        </div>
                        <span className={`text-[10px] font-bold ${editSpecsEnabled.fragrance ? "text-emerald-700" : "text-stone-500"}`}>
                          {editSpecsEnabled.fragrance ? "✓ Ticked" : "Excluded"}
                        </span>
                      </label>
                      <input
                        type="text"
                        disabled={!editSpecsEnabled.fragrance}
                        value={editSpecsEnabled.fragrance ? editForm.fragrance : ""}
                        onChange={(e) => setEditForm({ ...editForm, fragrance: e.target.value })}
                        placeholder="e.g. French Vanilla & Amber"
                        className="mt-1.5 w-full rounded-lg border border-[#8a614830] px-2.5 py-1.5 text-xs disabled:bg-stone-100 disabled:opacity-50"
                      />
                    </div>

                    <div className={`rounded-xl border p-2.5 ${editSpecsEnabled.burnTime ? "border-emerald-300 bg-white" : "border-stone-200 bg-stone-100/70"}`}>
                      <label className="flex items-center justify-between cursor-pointer py-0.5">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={editSpecsEnabled.burnTime}
                            onChange={(e) => setEditSpecsEnabled((p) => ({ ...p, burnTime: e.target.checked }))}
                            className="h-4 w-4 rounded accent-[#9b4a1b]"
                          />
                          <span className="text-xs font-bold text-ink">⏳ Burn Time</span>
                        </div>
                        <span className={`text-[10px] font-bold ${editSpecsEnabled.burnTime ? "text-emerald-700" : "text-stone-500"}`}>
                          {editSpecsEnabled.burnTime ? "✓ Ticked" : "Excluded"}
                        </span>
                      </label>
                      <input
                        type="text"
                        disabled={!editSpecsEnabled.burnTime}
                        value={editSpecsEnabled.burnTime ? editForm.burnTime : ""}
                        onChange={(e) => setEditForm({ ...editForm, burnTime: e.target.value })}
                        placeholder="e.g. 35–40 hours"
                        className="mt-1.5 w-full rounded-lg border border-[#8a614830] px-2.5 py-1.5 text-xs disabled:bg-stone-100 disabled:opacity-50"
                      />
                    </div>

                    <div className={`rounded-xl border p-2.5 ${editSpecsEnabled.ingredients ? "border-emerald-300 bg-white" : "border-stone-200 bg-stone-100/70"}`}>
                      <label className="flex items-center justify-between cursor-pointer py-0.5">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={editSpecsEnabled.ingredients}
                            onChange={(e) => setEditSpecsEnabled((p) => ({ ...p, ingredients: e.target.checked }))}
                            className="h-4 w-4 rounded accent-[#9b4a1b]"
                          />
                          <span className="text-xs font-bold text-ink">🌿 Ingredients</span>
                        </div>
                        <span className={`text-[10px] font-bold ${editSpecsEnabled.ingredients ? "text-emerald-700" : "text-stone-500"}`}>
                          {editSpecsEnabled.ingredients ? "✓ Ticked" : "Excluded"}
                        </span>
                      </label>
                      <input
                        type="text"
                        disabled={!editSpecsEnabled.ingredients}
                        value={editSpecsEnabled.ingredients ? editForm.ingredients : ""}
                        onChange={(e) => setEditForm({ ...editForm, ingredients: e.target.value })}
                        placeholder="e.g. 100% Pure Soy Wax"
                        className="mt-1.5 w-full rounded-lg border border-[#8a614830] px-2.5 py-1.5 text-xs disabled:bg-stone-100 disabled:opacity-50"
                      />
                    </div>

                    <div className={`rounded-xl border p-2.5 ${editSpecsEnabled.description ? "border-emerald-300 bg-white" : "border-stone-200 bg-stone-100/70"}`}>
                      <label className="flex items-center justify-between cursor-pointer py-0.5">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={editSpecsEnabled.description}
                            onChange={(e) => setEditSpecsEnabled((p) => ({ ...p, description: e.target.checked }))}
                            className="h-4 w-4 rounded accent-[#9b4a1b]"
                          />
                          <span className="text-xs font-bold text-ink">📝 Description</span>
                        </div>
                        <span className={`text-[10px] font-bold ${editSpecsEnabled.description ? "text-emerald-700" : "text-stone-500"}`}>
                          {editSpecsEnabled.description ? "✓ Ticked" : "Excluded"}
                        </span>
                      </label>
                      <input
                        type="text"
                        disabled={!editSpecsEnabled.description}
                        value={editSpecsEnabled.description ? editForm.description : ""}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        placeholder="e.g. Handcrafted with warm cozy notes"
                        className="mt-1.5 w-full rounded-lg border border-[#8a614830] px-2.5 py-1.5 text-xs disabled:bg-stone-100 disabled:opacity-50"
                      />
                    </div>
                  </div>
                </div>

                {/* Edit Photos */}
                <div className="rounded-2xl border border-[#8a614825] bg-white p-3.5 sm:p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-ink">
                      Candle Photos ({editForm.images.length})
                    </h4>
                    <label className="rounded-xl bg-ink text-white px-3 py-1.5 text-xs font-bold hover:bg-clay transition cursor-pointer">
                      + Add Photos
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

                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-1">
                    {editForm.images.map((img, idx) => (
                      <div key={idx} className="relative group rounded-xl overflow-hidden border border-[#8a614820] aspect-square">
                        <img src={img} alt="" className="h-full w-full object-cover" />
                        {idx === 0 && (
                          <span className="absolute top-1 left-1 rounded bg-clay text-white text-[9px] font-bold px-1 py-0.5">
                            Cover
                          </span>
                        )}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center gap-1 p-1">
                          {idx !== 0 && (
                            <button
                              type="button"
                              onClick={() => makeCoverPhoto(idx)}
                              className="rounded bg-white px-1.5 py-0.5 text-[9px] font-bold text-ink"
                            >
                              Make Cover
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => removeEditPhoto(idx)}
                            disabled={editForm.images.length <= 1}
                            className="rounded bg-red-600 px-1.5 py-0.5 text-[9px] font-bold text-white disabled:opacity-40"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-[#8a614815]">
                    <input
                      type="url"
                      value={editNewImageUrl}
                      onChange={(e) => setEditNewImageUrl(e.target.value)}
                      placeholder="Or paste an image URL..."
                      className="flex-1 rounded-xl border border-[#8a614830] px-3 py-1.5 text-xs text-ink outline-clay"
                    />
                    <button
                      type="button"
                      onClick={addEditImageUrl}
                      disabled={!editNewImageUrl.trim()}
                      className="rounded-xl bg-[#f5ede0] border border-[#8a614830] px-3 py-1.5 text-xs font-bold text-clay hover:bg-clay hover:text-white disabled:opacity-40"
                    >
                      + Add URL
                    </button>
                  </div>
                </div>
              </div>

              {/* Modal Footer Controls */}
              <div className="flex items-center justify-between gap-3 border-t border-[#8a614820] bg-[#f5ede0] px-4 sm:px-6 py-3">
                <button
                  type="button"
                  onClick={closeEditingProduct}
                  disabled={isSavingProduct}
                  className="rounded-xl border border-[#8a614830] bg-white px-4 py-2 text-xs sm:text-sm font-bold text-[#765442]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingProduct}
                  className="rounded-xl bg-ink hover:bg-clay text-white px-6 py-2.5 text-xs sm:text-sm font-bold shadow-md transition active:scale-95 disabled:opacity-50"
                >
                  {isSavingProduct ? "Saving..." : "Save Changes & Sync ↗"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 7. PAYMENT SCREENSHOT VIEWER MODAL                   */}
      {/* ==================================================== */}
      {selectedScreenshotOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-2 sm:p-4 backdrop-blur-sm overflow-y-auto"
          onClick={() => setSelectedScreenshotOrder(null)}
        >
          <div
            className="relative flex max-h-[94vh] sm:max-h-[92vh] w-full max-w-3xl flex-col rounded-3xl bg-[#fff8ed] shadow-2xl border border-[#8a61483a] overflow-hidden my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#8a614820] bg-[#f5ede0] px-4 sm:px-6 py-3.5">
              <div>
                <h3 className="display text-base sm:text-xl text-ink font-bold">
                  Payment Verification: {selectedScreenshotOrder.id}
                </h3>
                <p className="text-[11px] text-[#765442]">
                  Customer: <b>{selectedScreenshotOrder.customer.name}</b> ({selectedScreenshotOrder.customer.phone}) · ₹{selectedScreenshotOrder.total}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedScreenshotOrder(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-base font-bold text-[#765442] hover:bg-clay hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="bg-[#fff0db] px-4 sm:px-6 py-2 text-[11px] text-[#8a4e1d] border-b border-[#f0cca3]">
              ⏱ <b>Retention Notice:</b> Screenshot automatically purged after 3 days.{" "}
              <b>{getScreenshotExpiryInfo(selectedScreenshotOrder.createdAt, selectedScreenshotOrder.screenshotExpiresAt).timeLeftText}</b>.
            </div>

            <div className="flex-1 overflow-auto bg-[#2b1911] p-4 flex items-center justify-center min-h-[260px]">
              {selectedScreenshotOrder.screenshot ? (
                <img
                  src={selectedScreenshotOrder.screenshot}
                  alt="Payment Screenshot"
                  className="max-h-[60vh] max-w-full rounded-xl object-contain shadow-2xl"
                />
              ) : (
                <div className="text-center text-stone-300 p-8">
                  <p className="font-bold">Screenshot Expired</p>
                  <p className="text-xs text-stone-400 mt-1">This payment screenshot was automatically purged from cloud storage.</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-[#8a614820] bg-[#f5ede0] px-4 sm:px-6 py-3">
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
                      className="rounded-xl border border-[#8a614830] bg-white px-3 py-1.5 text-xs font-bold text-clay hover:bg-clay hover:text-white"
                    >
                      Open in Tab ↗
                    </button>
                    <a
                      href={selectedScreenshotOrder.screenshot}
                      download={`payment-order-${selectedScreenshotOrder.id}.jpg`}
                      className="rounded-xl bg-ink text-white px-3 py-1.5 text-xs font-bold hover:bg-clay"
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
                      if (confirm(`Delete screenshot for order ${selectedScreenshotOrder.id} early to save storage?`)) {
                        await deleteScreenshotEarly(selectedScreenshotOrder.id);
                      }
                    }}
                    className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-3 py-1.5 text-xs font-bold hover:bg-red-600 hover:text-white"
                  >
                    Delete Early
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedScreenshotOrder(null)}
                  className="rounded-xl border border-[#8a614830] bg-white px-4 py-1.5 text-xs font-bold text-ink"
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
