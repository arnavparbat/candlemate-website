import { orderEmitter } from "@/lib/order-events";
import { Order } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Server-Sent Events (SSE) route:
 * Allows the studio dashboard to listen to new incoming customer orders in real-time.
 */
export async function GET(req: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      try {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "CONNECTED", timestamp: Date.now() })}\n\n`
          )
        );
      } catch {}

      // Listener for new orders
      const onNewOrder = (order: Order) => {
        try {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "NEW_ORDER", order, timestamp: Date.now() })}\n\n`
            )
          );
        } catch {
          cleanup();
        }
      };

      // Listener for order status updates
      const onStatusUpdated = (data: { id: string; status: string }) => {
        try {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "STATUS_UPDATED",
                ...data,
                timestamp: Date.now(),
              })}\n\n`
            )
          );
        } catch {
          cleanup();
        }
      };

      orderEmitter.on("new_order", onNewOrder);
      orderEmitter.on("status_updated", onStatusUpdated);

      // Keepalive heartbeat ping every 20 seconds
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          cleanup();
        }
      }, 20000);

      function cleanup() {
        clearInterval(pingInterval);
        orderEmitter.off("new_order", onNewOrder);
        orderEmitter.off("status_updated", onStatusUpdated);
        try {
          controller.close();
        } catch {}
      }

      req.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
