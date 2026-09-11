"use client";
import Link from "next/link";
import { useCart } from "./cart-context";
export function Header(){const {items}=useCart(); const count=items.reduce((s,i)=>s+i.quantity,0); return <header className="sticky top-0 z-40 border-b border-[#5c39271a] bg-[#fff8ed]/90 backdrop-blur"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4"><Link href="/" className="display text-2xl font-bold">candlemate<span className="text-gold">.</span></Link><nav className="flex items-center gap-5 text-sm"><a href="/#shop" className="hidden sm:block hover:text-clay">Shop candles</a><Link className="rounded-full bg-ink px-4 py-2 text-cream" href="/cart">Bag {count ? `(${count})` : ""}</Link></nav></div></header>}
