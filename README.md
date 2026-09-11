# Candlemate

A warm, mobile-first handmade candle storefront with a seamless checkout flow, dedicated order server, and real-time studio dashboard.

## Starting the Project

1. Copy `.env.example` to `.env.local` and set your initial `ADMIN_PASSWORD` and `UPI_ID`.
2. Run `npm install`.
3. Start the Next.js storefront: `npm run dev`, then open `http://localhost:3000`.
4. (Optional) Run the dedicated Order Server: `npm run server` (runs on `http://localhost:4000`).

## Order Server & Real-time Studio Reach

The dedicated Order Server (`server/order-server.js` or `npm run server`) ensures customer orders reliably reach the studio maker:

- **Order Taking**: `POST /api/orders` receives customer details, ordered items, and optimized payment proof screenshots.
- **Real-Time Studio Reach**:
  - `GET /api/orders/live` streams new orders directly to the studio dashboard via Server-Sent Events (SSE).
  - Studio dashboard (`/admin`) rings an audible chime and flashes a live notification banner when an order arrives.
  - Automatic fallback polling ensures no order is missed even with unstable connections.
- **WhatsApp Order Dispatch**: Customers on the checkout confirmation screen can tap a direct WhatsApp button to send the full order summary straight to the studio maker's phone.
- **3-Day Storage Auto-Purge**: Heavy payment screenshot images automatically expire and are purged from cloud storage after 3 days (72 hours).

## Routes

- `/` — storefront and auto-rotating product cards
- `/products/[id]` — product carousel and candle specifications
- `/cart` — shopping bag with soy wax pour animation
- `/checkout` — delivery details, UPI QR payment, screenshot proof, and WhatsApp order bridge
- `/admin` — live studio dashboard with real-time order listener, screenshot modal viewer, and product management
- `/api/orders/live` — Server-Sent Events stream for live order updates
