import "./globals.css";
import type { Metadata } from "next";
import StorefrontProviders from "@/components/storefront";
export const metadata: Metadata = { title: "Candlemate | Made for slow moments", description: "Hand-poured natural candles" };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body><StorefrontProviders>{children}</StorefrontProviders></body></html>; }
