import {getStore,saveStore} from "@/lib/store";import {NextResponse} from "next/server";
export async function PUT(req:Request){const {upiId}=await req.json();if(!/^[-.a-zA-Z0-9_]+@[a-zA-Z]+$/.test(upiId||""))return NextResponse.json({error:"Enter a valid UPI ID"},{status:400});const db=getStore();db.settings.upiId=upiId;saveStore(db);return NextResponse.json({upiId})}
