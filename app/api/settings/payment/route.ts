import { getStore } from "@/lib/store";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const store = getStore();
  const upiId =
    process.env.NEXT_PUBLIC_UPI_ID ||
    process.env.UPI_ID ||
    store.settings?.upiId ||
    "9552682389@ybl";

  return NextResponse.json(
    { upiId },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
        Pragma: "no-cache",
        Expires: "0",
      },
    }
  );
}
