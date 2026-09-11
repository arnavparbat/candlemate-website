/**
 * Candlemate Dedicated Order Server
 *
 * Handles order taking from customers, reliable persistence,
 * 3-day payment screenshot expiration, and real-time order delivery
 * to the Candlemate studio dashboard via Server-Sent Events (SSE).
 *
 * Usage:
 *   node server/order-server.js
 *   or: npm run server
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const PORT = process.env.PORT || process.env.ORDER_SERVER_PORT || 4000;
const DB_PATH =
  process.env.DATA_FILE_PATH || path.join(__dirname, "..", "data", "store.json");
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

// Active SSE client connections (Studio dashboards)
const sseClients = new Set();

/**
 * Load store data from JSON file with automatic 3-day screenshot pruning
 */
function loadStore() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, "utf8");
      if (raw) {
        const data = JSON.parse(raw);
        if (pruneScreenshots(data)) {
          saveStore(data);
        }
        return data;
      }
    }
  } catch (err) {
    console.error("[OrderServer] Error reading store:", err.message);
  }

  return {
    settings: { upiId: process.env.UPI_ID || "9552682389@ybl", adminPasswordHash: "" },
    products: [],
    orders: [],
  };
}

/**
 * Save store data to JSON file safely
 */
function saveStore(data) {
  try {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf8");
    return true;
  } catch (err) {
    console.error("[OrderServer] Error saving store:", err.message);
    return false;
  }
}

/**
 * Automatically prune payment screenshots older than 3 days to preserve cloud storage
 */
function pruneScreenshots(store) {
  if (!store || !Array.isArray(store.orders)) return false;
  let modified = false;
  const now = Date.now();

  for (const order of store.orders) {
    if (order.screenshot) {
      const createdTime = new Date(order.createdAt).getTime();
      const expiresTime = order.screenshotExpiresAt
        ? new Date(order.screenshotExpiresAt).getTime()
        : createdTime + THREE_DAYS_MS;

      if (now >= expiresTime) {
        delete order.screenshot;
        order.screenshotExpired = true;
        modified = true;
      }
    }
  }
  return modified;
}

/**
 * Broadcast event to all connected Studio SSE listeners
 */
function broadcastToStudio(eventData) {
  const payload = `data: ${JSON.stringify(eventData)}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(payload);
    } catch {
      sseClients.delete(res);
    }
  }
  console.log(
    `[OrderServer] Broadcasted ${eventData.type} to ${sseClients.size} studio client(s)`
  );
}

/**
 * Trigger external webhook (Telegram/Discord/etc.) if configured
 */
function triggerStudioWebhook(order) {
  const webhookUrl = process.env.STUDIO_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    const parsed = new URL(webhookUrl);
    const postData = JSON.stringify({
      content: `🕯️ **New Order Received!**\n**Order ID:** ${order.id}\n**Customer:** ${order.customer.name} (${order.customer.phone})\n**Total:** ₹${order.total}\n**Address:** ${order.customer.address}`,
      orderId: order.id,
      customer: order.customer,
      total: order.total,
    });

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
      },
    };

    const client = parsed.protocol === "https:" ? require("https") : http;
    const req = client.request(options, (res) => {
      res.resume();
    });
    req.on("error", (err) => console.warn("[OrderServer] Webhook failed:", err.message));
    req.write(postData);
    req.end();
  } catch (err) {
    console.warn("[OrderServer] Webhook error:", err.message);
  }
}

/**
 * Parse JSON body helper
 */
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      // Protect against gigantic payloads (> 10MB)
      if (body.length > 10 * 1024 * 1024) {
        req.destroy();
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

/**
 * Send JSON response helper
 */
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  res.end(JSON.stringify(data));
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method.toUpperCase();

  // Handle CORS Preflight
  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    });
    return res.end();
  }

  // Route 1: Health Check
  if (pathname === "/api/health" || pathname === "/health") {
    const store = loadStore();
    return sendJson(res, 200, {
      status: "ok",
      service: "candlemate-order-server",
      totalOrders: store.orders.length,
      connectedStudios: sseClients.size,
      timestamp: new Date().toISOString(),
    });
  }

  // Route 2: Server-Sent Events for Studio Dashboard (/api/orders/live)
  if (pathname === "/api/orders/live" || pathname === "/live") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    res.write(
      `data: ${JSON.stringify({
        type: "CONNECTED",
        connectedAt: new Date().toISOString(),
        activeClients: sseClients.size + 1,
      })}\n\n`
    );

    sseClients.add(res);
    console.log(`[OrderServer] Studio connected to live stream. Total clients: ${sseClients.size}`);

    req.on("close", () => {
      sseClients.delete(res);
      console.log(`[OrderServer] Studio disconnected. Remaining: ${sseClients.size}`);
    });
    return;
  }

  // Route 3: Order Taking (Customer -> Server -> Studio)
  if (pathname === "/api/orders" && method === "POST") {
    try {
      const body = await parseJsonBody(req);

      if (
        !body.customer?.name ||
        !body.customer?.address ||
        !/^\+?[0-9\s-]{8,16}$/.test(body.customer?.phone || "")
      ) {
        return sendJson(res, 400, {
          error: "Please enter your name, full address, and a valid contact number.",
        });
      }

      if (!body.items || !body.items.length) {
        return sendJson(res, 400, { error: "Your bag is empty." });
      }

      const store = loadStore();
      const total = body.items.reduce(
        (sum, item) => sum + Number(item.price) * Number(item.quantity),
        0
      );

      const now = new Date();
      // 3 days from now
      const screenshotExpiresAt = new Date(now.getTime() + THREE_DAYS_MS).toISOString();

      const newOrder = {
        id: `CM-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
        customer: body.customer,
        items: body.items,
        total,
        status: "Order Received",
        screenshot: body.screenshot,
        screenshotExpiresAt: body.screenshot ? screenshotExpiresAt : undefined,
        createdAt: now.toISOString(),
      };

      store.orders.unshift(newOrder);
      saveStore(store);

      console.log(
        `[OrderServer] 🕯️ New Order Taken: ${newOrder.id} from ${newOrder.customer.name} (₹${newOrder.total})`
      );

      // Instantly push order to all active Studio dashboards
      broadcastToStudio({
        type: "NEW_ORDER",
        order: newOrder,
        timestamp: Date.now(),
      });

      // Optional webhook notification
      triggerStudioWebhook(newOrder);

      return sendJson(res, 201, newOrder);
    } catch (err) {
      console.error("[OrderServer] Error processing order:", err);
      return sendJson(res, 500, { error: "Internal order processing error." });
    }
  }

  // Route 4: Studio Order Fetching (/api/orders or /api/admin/orders)
  if (
    (pathname === "/api/orders" || pathname === "/api/admin/orders") &&
    method === "GET"
  ) {
    const store = loadStore();
    return sendJson(res, 200, store.orders);
  }

  // Route 5: Update Order Status
  const statusMatch = pathname.match(/^\/api\/(?:admin\/)?orders\/([^/]+)\/status$/);
  if (statusMatch && (method === "PATCH" || method === "PUT")) {
    const orderId = statusMatch[1];
    const body = await parseJsonBody(req);
    const store = loadStore();
    const order = store.orders.find((o) => o.id === orderId);

    if (!order) {
      return sendJson(res, 404, { error: "Order not found." });
    }

    order.status = body.status;
    saveStore(store);

    broadcastToStudio({
      type: "STATUS_UPDATED",
      id: orderId,
      status: body.status,
      timestamp: Date.now(),
    });

    console.log(`[OrderServer] Order ${orderId} status updated to: ${body.status}`);
    return sendJson(res, 200, order);
  }

  // Route 6: Delete Screenshot Early (Save Storage)
  const screenshotMatch = pathname.match(
    /^\/api\/(?:admin\/)?orders\/([^/]+)\/screenshot$/
  );
  if (screenshotMatch && method === "DELETE") {
    const orderId = screenshotMatch[1];
    const store = loadStore();
    const order = store.orders.find((o) => o.id === orderId);

    if (!order) {
      return sendJson(res, 404, { error: "Order not found." });
    }

    delete order.screenshot;
    order.screenshotExpired = true;
    saveStore(store);

    broadcastToStudio({
      type: "SCREENSHOT_DELETED",
      id: orderId,
      timestamp: Date.now(),
    });

    console.log(`[OrderServer] Payment screenshot deleted for order ${orderId}`);
    return sendJson(res, 200, { success: true, message: "Screenshot deleted" });
  }

  // Route 7: Payment Settings
  if (pathname === "/api/settings/payment" || pathname === "/api/admin/settings/payment") {
    const store = loadStore();
    if (method === "GET") {
      return sendJson(res, 200, { upiId: store.settings?.upiId || "candlemate@upi" });
    }
    if (method === "PUT" || method === "POST") {
      const body = await parseJsonBody(req);
      if (!store.settings) store.settings = { upiId: "", adminPasswordHash: "" };
      store.settings.upiId = body.upiId;
      saveStore(store);
      return sendJson(res, 200, { success: true, upiId: body.upiId });
    }
  }

  // Fallback 404
  return sendJson(res, 404, { error: `Route ${method} ${pathname} not found` });
});

// Periodic keepalive & 3-day auto-purge loop every 10 minutes
setInterval(() => {
  const store = loadStore();
  // Ping SSE clients
  for (const client of sseClients) {
    try {
      client.write(": ping\n\n");
    } catch {
      sseClients.delete(client);
    }
  }
}, 30000);

server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║         🕯️  CANDLEMATE DEDICATED ORDER SERVER                 ║
╠═══════════════════════════════════════════════════════════════╣
║  • Server running on: http://localhost:${PORT}                 ║
║  • Order Taking:      POST   /api/orders                      ║
║  • Studio Orders:     GET    /api/orders                      ║
║  • Live Stream (SSE): GET    /api/orders/live                 ║
║  • Health Check:      GET    /api/health                      ║
║  • Data Store:        ${DB_PATH}
║  • Storage Rule:      Screenshots auto-expire after 3 days    ║
╚═══════════════════════════════════════════════════════════════╝
  `);
});
