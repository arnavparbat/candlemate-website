# Candlemate

A warm, mobile-first handmade candle storefront with a no-login order flow and a small password-protected studio dashboard.

## Start locally

1. Copy `.env.example` to `.env.local` and set your initial `ADMIN_PASSWORD` and `UPI_ID`.
2. Run `npm install`.
3. Run `npm run dev`, then open `http://localhost:3000`.

Development uses its own `.next-dev` cache, so it does not clash with a production build.

The first server run creates `data/store.json` with sample candles. The settings in `.env.local` only seed this file; after that, update the UPI ID and admin password in `/admin`.

## Routes

- `/` — storefront and auto-rotating product cards
- `/products/[id]` — product carousel and details
- `/cart` and `/checkout` — cart, QR payment, screenshot proof, animated candle completion
- `/admin` — dashboard (redirects to `/admin/login` when signed out)

## Development storage

The app stores products, orders, payment settings, and the bcrypt-hashed admin password in local `data/store.json`. Payment screenshots are saved as image data in this development store; use S3/Cloudinary and a proper database before production.
