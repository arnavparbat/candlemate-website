import { EventEmitter } from "events";
import { Order } from "./types";

declare global {
  // Prevent multiple event emitters in development hot-reloading
  var __candlemateOrderEmitter: EventEmitter | undefined;
}

export const orderEmitter: EventEmitter =
  global.__candlemateOrderEmitter ||
  (global.__candlemateOrderEmitter = new EventEmitter());

orderEmitter.setMaxListeners(100);

export function notifyStudioNewOrder(order: Order) {
  try {
    orderEmitter.emit("new_order", order);
  } catch (err) {
    console.error("Failed to emit new order event:", err);
  }
}

export function notifyStudioStatusUpdated(id: string, status: string) {
  try {
    orderEmitter.emit("status_updated", { id, status });
  } catch (err) {
    console.error("Failed to emit status update event:", err);
  }
}
