// Máy trạng thái đơn (thuần, không DB/auth) — nguồn sự thật cho transition hợp lệ + actor được phép.
// Repo/route dùng làm guard trước khi ghi; UI helper (sellerActions, nút buyer) bám theo file này.

import type { Fulfillment, OrderStatus } from "./types";

type Actor = "buyer" | "seller";

// Trạng thái kế hợp lệ từ `from`, phân nhánh theo cách nhận hàng (chỉ khác nhau ở bước `accepted`).
export function nextStatusesFor(
  fulfillment: Fulfillment,
  from: OrderStatus,
): OrderStatus[] {
  switch (from) {
    case "pending":
      return ["accepted", "rejected", "cancelled"];
    case "accepted":
      return [fulfillment === "delivery" ? "delivering" : "ready", "cancelled"];
    case "delivering":
      return ["arrived"];
    case "arrived":
      return ["completed"];
    case "ready":
      return ["completed"];
    default:
      return []; // completed / rejected / cancelled — terminal
  }
}

export function canTransition(
  fulfillment: Fulfillment,
  from: OrderStatus,
  to: OrderStatus,
): boolean {
  return nextStatusesFor(fulfillment, from).includes(to);
}

// Ai được phép đẩy đơn tới trạng thái `to`. seller: nhận/từ chối/giao/tới/sẵn sàng;
// buyer: huỷ; completed: cả hai (buyer "Đã nhận hàng" / seller "Hoàn tất").
const ACTORS: Record<OrderStatus, Actor[]> = {
  pending: [], // không phải đích của advance (tạo đơn là INSERT)
  accepted: ["seller"],
  delivering: ["seller"],
  arrived: ["seller"],
  ready: ["seller"],
  rejected: ["seller"],
  cancelled: ["buyer"],
  completed: ["buyer", "seller"],
};

export function allowedActors(to: OrderStatus): Set<Actor> {
  return new Set(ACTORS[to]);
}
