"use client";
import { CartProvider } from "./cart-context";
export default function StorefrontProviders({children}:{children:React.ReactNode}){return <CartProvider>{children}</CartProvider>}
