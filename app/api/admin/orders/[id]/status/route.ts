import { getStoreAsync, saveStoreAsync } from "@/lib/store";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const valid = ["Order Received", "Preparing", "Out for Delivery", "Delivered"];

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { status } = await req.json();
  if (!valid.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const db = await getStoreAsync();
  const order = db.orders.find((o) => o.id === id);
  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  order.status = status;
  await saveStoreAsync(db);
  return NextResponse.json(order);
}

