import { getStore } from "@/lib/store"; import { NextResponse } from "next/server";
export async function GET(){return NextResponse.json({upiId:getStore().settings.upiId})}
