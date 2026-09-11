"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { CartItem, Product } from "@/lib/types";
type Ctx = { items: CartItem[]; add: (p:Product)=>void; remove:(id:string)=>void; update:(id:string,n:number)=>void; total:number; clear:()=>void };
const Cart = createContext<Ctx | null>(null);
export function CartProvider({children}:{children:React.ReactNode}) { const [items,setItems]=useState<CartItem[]>([]); useEffect(()=>{ const cached=localStorage.getItem("candlemate-cart"); if(cached) setItems(JSON.parse(cached)); },[]); useEffect(()=>localStorage.setItem("candlemate-cart",JSON.stringify(items)),[items]); const add=(p:Product)=>setItems(x=>{const found=x.find(i=>i.id===p.id); return found?x.map(i=>i.id===p.id?{...i,quantity:i.quantity+1}:i):[...x,{...p,quantity:1}]}); const update=(id:string,n:number)=>setItems(x=>x.map(i=>i.id===id?{...i,quantity:n}:i).filter(i=>i.quantity>0)); return <Cart.Provider value={{items,add,remove:(id)=>update(id,0),update,total:items.reduce((s,i)=>s+i.price*i.quantity,0),clear:()=>setItems([])}}>{children}</Cart.Provider> }
export function useCart(){const c=useContext(Cart); if(!c) throw new Error("Use within CartProvider"); return c;}
