export type Product = { id: string; name: string; price: number; description: string; burnTime: string; ingredients: string; category: string; images: string[]; available: boolean };
export type CartItem = Product & { quantity: number };
export type OrderStatus = "Order Received" | "Preparing" | "Out for Delivery" | "Delivered";
export type Order = {
  id: string;
  customer: { name: string; address: string; phone: string };
  items: CartItem[];
  total: number;
  status: OrderStatus;
  screenshot?: string;
  screenshotExpired?: boolean;
  screenshotExpiresAt?: string;
  createdAt: string;
};
export type Store = { products: Product[]; orders: Order[]; settings: { upiId: string; adminPasswordHash: string } };
