import { getStore, saveStore, SCREENSHOT_EXPIRY_MS } from "@/lib/store";
import { Order } from "@/lib/types";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();

  if (
    !body.customer?.name ||
    !body.customer?.address ||
    !/^\+?[0-9\s-]{8,16}$/.test(body.customer?.phone || "")
  ) {
    return NextResponse.json(
      { error: "Enter a name, delivery address, and valid contact number." },
      { status: 400 }
    );
  }

  if (!body.items?.length) {
    return NextResponse.json({ error: "Your bag is empty" }, { status: 400 });
  }

  const db = getStore();
  const total = body.items.reduce(
    (sum: number, i: any) => sum + Number(i.price) * Number(i.quantity),
    0
  );

  const now = new Date();
  // Screenshot expires in exactly 3 days (72 hours) to preserve cloud storage
  const screenshotExpiresAt = new Date(now.getTime() + SCREENSHOT_EXPIRY_MS).toISOString();

  const order: Order = {
    id: `CM-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
    customer: body.customer,
    items: body.items,
    total,
    status: "Order Received",
    screenshot: body.screenshot,
    screenshotExpiresAt: body.screenshot ? screenshotExpiresAt : undefined,
    createdAt: now.toISOString(),
  };

  db.orders.unshift(order);
  saveStore(db);

  return NextResponse.json(order, { status: 201 });
}
