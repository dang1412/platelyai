// Logic phía seller cho khu /admin (thuần, không React/DB) — nhóm đơn + bước đẩy trạng thái kế tiếp.
// Mock-only: transition thật + kiểm quyền nằm ở plan 10. KHÔNG chép hằng số flow, tái dùng flowFor.

import { flowFor, isActiveStatus } from "./statusMeta";
import type { Order, OrderStatus } from "./types";

// Chia đơn thành 3 cụm cho dashboard seller, mỗi cụm mới nhất trước. Thuần — không mutate input.
export function groupSellerOrders(orders: Order[]): {
  needsAction: Order[];
  inProgress: Order[];
  done: Order[];
} {
  const byNewest = (a: Order, b: Order) =>
    b.createdAt.localeCompare(a.createdAt);
  return {
    needsAction: orders.filter((o) => o.status === "pending").sort(byNewest),
    inProgress: orders
      .filter((o) => o.status !== "pending" && isActiveStatus(o.status))
      .sort(byNewest),
    done: orders.filter((o) => !isActiveStatus(o.status)).sort(byNewest),
  };
}

// Nhãn hành động VI cho mỗi bước "đẩy tới" trạng thái đích.
const STEP_LABEL: Partial<Record<OrderStatus, string>> = {
  accepted: "Nhận đơn",
  delivering: "Bắt đầu giao",
  arrived: "Đã tới nơi",
  ready: "Sẵn sàng lấy",
  completed: "Hoàn tất",
};

// Bước đẩy trạng thái kế tiếp theo flow nhận hàng. Terminal/ngoài flow → null.
export function nextSellerStep(
  order: Order,
): { toStatus: OrderStatus; label: string } | null {
  const flow = flowFor(order.fulfillment);
  const idx = flow.indexOf(order.status);
  if (idx < 0 || idx >= flow.length - 1) return null;
  const toStatus = flow[idx + 1];
  return { toStatus, label: STEP_LABEL[toStatus] ?? toStatus };
}

// Seller chỉ được từ chối khi đơn còn chờ xác nhận.
export function canReject(order: Order): boolean {
  return order.status === "pending";
}
