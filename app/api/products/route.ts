import { getStore, saveStore } from "@/lib/store";
import { NextResponse } from "next/server";
export async function GET(){return NextResponse.json(getStore().products)}
export async function POST(req:Request){const body=await req.json(); const db=getStore(); const product={...body,id:crypto.randomUUID(),price:Number(body.price),images:body.images?.length?body.images:["https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&w=900&q=85"],available:body.available!==false}; db.products.unshift(product); saveStore(db); return NextResponse.json(product,{status:201})}
