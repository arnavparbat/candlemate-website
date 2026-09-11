import { getStore, saveStore } from "@/lib/store";
import { NextResponse } from "next/server";
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){const {id}=await params; const product=getStore().products.find(p=>p.id===id); return product?NextResponse.json(product):NextResponse.json({error:"Not found"},{status:404})}
export async function PUT(req:Request,{params}:{params:Promise<{id:string}>}){const {id}=await params;const body=await req.json();const db=getStore();const i=db.products.findIndex(p=>p.id===id);if(i<0)return NextResponse.json({error:"Not found"},{status:404});db.products[i]={...db.products[i],...body,price:Number(body.price)};saveStore(db);return NextResponse.json(db.products[i])}
export async function DELETE(_:Request,{params}:{params:Promise<{id:string}>}){const {id}=await params;const db=getStore();db.products=db.products.filter(p=>p.id!==id);saveStore(db);return NextResponse.json({ok:true})}
