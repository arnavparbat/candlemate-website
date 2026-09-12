import { getStore, saveStore } from "@/lib/store";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function PUT(req: Request) {
  try {
    const { upiId } = await req.json();
    const cleanUpi = (upiId || "").trim();

    if (!cleanUpi || !/^[-.a-zA-Z0-9_]+@[a-zA-Z0-9.-]+$/.test(cleanUpi)) {
      return NextResponse.json(
        { error: "Enter a valid UPI ID (e.g. name@bank or 9876543210@upi)" },
        { status: 400 }
      );
    }

    const db = getStore();
    if (!db.settings) {
      db.settings = { upiId: cleanUpi, adminPasswordHash: "" };
    } else {
      db.settings.upiId = cleanUpi;
    }
    saveStore(db);

    // If dedicated order server is configured, sync payment settings with it as well
    const externalServerUrl =
      process.env.ORDER_SERVER_URL || process.env.NEXT_PUBLIC_ORDER_SERVER_URL;
    if (externalServerUrl) {
      fetch(`${externalServerUrl.replace(/\/$/, "")}/api/admin/settings/payment`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upiId: cleanUpi }),
      }).catch((err) => {
        console.warn("Could not forward payment setting to order server:", err.message);
      });
    }

    return NextResponse.json({ upiId: cleanUpi });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to save UPI ID" },
      { status: 500 }
    );
  }
}
