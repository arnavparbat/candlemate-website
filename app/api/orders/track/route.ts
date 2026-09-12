import { trackOrders } from "@/lib/track";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || searchParams.get("id") || searchParams.get("phone") || "";

    if (!query.trim()) {
      return NextResponse.json(
        { error: "Please provide an Order ID or 10-digit Phone Number." },
        { status: 400 }
      );
    }

    const result = await trackOrders(query);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("Order tracking API error:", err);
    return NextResponse.json(
      { error: "An error occurred while tracking the order." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const query = body.query || body.id || body.phone || "";

    if (!query || !query.trim()) {
      return NextResponse.json(
        { error: "Please enter an Order ID or 10-digit Phone Number." },
        { status: 400 }
      );
    }

    const result = await trackOrders(query);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("Order tracking API error:", err);
    return NextResponse.json(
      { error: "An error occurred while tracking the order." },
      { status: 500 }
    );
  }
}
