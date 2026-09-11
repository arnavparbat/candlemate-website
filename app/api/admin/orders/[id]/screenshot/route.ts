import { getStoreAsync, saveStoreAsync } from "@/lib/store";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = await getStoreAsync();
  const order = db.orders.find((o) => o.id === id);

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Delete screenshot image from store to save cloud storage
  delete order.screenshot;
  order.screenshotExpired = true;
  await saveStoreAsync(db);

  return NextResponse.json({
    success: true,
    message: "Screenshot deleted from storage",
    orderId: id,
  });
}
