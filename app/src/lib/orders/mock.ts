// Dữ liệu giả cho UI buyer (feature 11) — chạy độc lập không backend.
// TẠM THỜI: plan 10 sẽ thay bằng dữ liệu thật từ API; xoá file này khi nối xong.

import { flowFor } from "./statusMeta";
import type { Order, OrderItem, OrderStatus } from "./types";

function total(items: OrderItem[]): number {
  return items.reduce((sum, it) => sum + it.price * it.quantity, 0);
}

// Mốc thời gian cố định cho mock (tránh lệch giữa SSR/CSR).
const T0 = "2026-06-27T10:00:00.000Z";

const ITEMS_A: OrderItem[] = [
  { name: "Bún chả", price: 45000, quantity: 2 },
  { name: "Nem rán", price: 30000, quantity: 1 },
];
const ITEMS_B: OrderItem[] = [
  { name: "Cà phê sữa đá", price: 25000, quantity: 2 },
  { name: "Bánh flan", price: 15000, quantity: 1 },
];

function makeOrder(over: Partial<Order> & Pick<Order, "id">): Order {
  const items = over.items ?? ITEMS_A;
  return {
    restaurantId: "0",
    restaurantName: "Quán Ăn Ngon",
    fulfillment: "delivery",
    status: "pending",
    items,
    total: total(items),
    phone: "0901234567",
    address: "12 Nguyễn Trãi, Thanh Xuân, Hà Nội",
    note: null,
    events: [{ status: over.status ?? "pending", at: T0 }],
    createdAt: T0,
    ...over,
  };
}

// Một đơn mẫu cho mỗi trạng thái để preview UI.
const MOCK_ORDERS: Order[] = [
  makeOrder({ id: "1001", status: "pending" }),
  makeOrder({ id: "1002", status: "accepted" }),
  makeOrder({ id: "1003", status: "delivering" }),
  makeOrder({ id: "1004", status: "arrived" }),
  makeOrder({ id: "1005", status: "completed" }),
  makeOrder({ id: "1006", status: "cancelled" }),
  makeOrder({
    id: "2001",
    fulfillment: "pickup",
    status: "accepted",
    address: null,
    restaurantName: "Cà Phê Góc Phố",
    items: ITEMS_B,
  }),
  makeOrder({
    id: "2002",
    fulfillment: "pickup",
    status: "ready",
    address: null,
    restaurantName: "Cà Phê Góc Phố",
    items: ITEMS_B,
  }),
  // Thêm đơn pending/đa quán để dashboard seller có dữ liệu ở cả 3 cụm + lọc theo quán.
  makeOrder({ id: "1007", status: "pending", phone: "0912000111" }),
  makeOrder({
    id: "2003",
    fulfillment: "pickup",
    status: "pending",
    address: null,
    restaurantName: "Cà Phê Góc Phố",
    items: ITEMS_B,
    phone: "0912000222",
  }),
  makeOrder({
    id: "2004",
    fulfillment: "pickup",
    status: "rejected",
    address: null,
    restaurantName: "Cà Phê Góc Phố",
    items: ITEMS_B,
  }),
];

export function listMockOrders(): Order[] {
  return MOCK_ORDERS;
}

export function getMockOrder(id: string): Order | null {
  return MOCK_ORDERS.find((o) => o.id === id) ?? null;
}

// Danh sách quán distinct (cho dropdown lọc ở dashboard seller).
export function restaurantNames(orders: Order[]): string[] {
  return [...new Set(orders.map((o) => o.restaurantName))];
}

// Đẩy đơn sang trạng thái kế tiếp theo flow nhận hàng (cho dev stepper preview).
// Trạng thái terminal (completed/cancelled/rejected) giữ nguyên.
export function simulateAdvance(order: Order): Order {
  const flow = flowFor(order.fulfillment);
  const idx = flow.indexOf(order.status);
  if (idx < 0 || idx >= flow.length - 1) return order; // ngoài flow hoặc đã cuối
  const next: OrderStatus = flow[idx + 1];
  return {
    ...order,
    status: next,
    events: [...order.events, { status: next, at: new Date().toISOString() }],
  };
}

// Seller từ chối đơn (mock) — đặt 'rejected' + append event. Không mutate input.
export function simulateReject(order: Order): Order {
  return {
    ...order,
    status: "rejected",
    events: [
      ...order.events,
      { status: "rejected", at: new Date().toISOString() },
    ],
  };
}
