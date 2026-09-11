import { getStore,saveStore } from "@/lib/store";import {NextResponse} from "next/server";
const valid=["Order Received","Preparing","Out for Delivery","Delivered"];
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){const {id}=await params;const {status}=await req.json();if(!valid.includes(status))return NextResponse.json({error:"Invalid status"},{status:400});const db=getStore();const order=db.orders.find(o=>o.id===id);if(!order)return NextResponse.json({error:"Not found"},{status:404});order.status=status;saveStore(db);return NextResponse.json(order)}
