// Metadata trình bày cho trạng thái đơn (thuần, không React/DB) — nhãn VI + thứ tự bước timeline.
// Logic chuyển trạng thái (transition hợp lệ + ai được phép) nằm ở plan 10 (state.ts), KHÔNG ở đây.

import type { Fulfillment, OrderStatus } from "./types";

// Nhãn tiếng Việt cho mỗi trạng thái.
export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Chờ xác nhận",
  accepted: "Đang chuẩn bị",
  delivering: "Đang giao",
  arrived: "Đã tới nơi",
  ready: "Sẵn sàng lấy",
  completed: "Hoàn tất",
  rejected: "Bị từ chối",
  cancelled: "Đã huỷ",
};

// Nhóm màu (ánh xạ token ở component): đang xử lý / hoàn tất / kết thúc tiêu cực.
export type StatusTone = "active" | "success" | "muted";

export function statusTone(status: OrderStatus): StatusTone {
  if (status === "completed") return "success";
  if (status === "rejected" || status === "cancelled") return "muted";
  return "active";
}

// Chuỗi bước "hạnh phúc" theo cách nhận hàng (không gồm rejected/cancelled).
const DELIVERY_FLOW: OrderStatus[] = [
  "pending",
  "accepted",
  "delivering",
  "arrived",
  "completed",
];
const PICKUP_FLOW: OrderStatus[] = ["pending", "accepted", "ready", "completed"];

export function flowFor(fulfillment: Fulfillment): OrderStatus[] {
  return fulfillment === "delivery" ? DELIVERY_FLOW : PICKUP_FLOW;
}

// View-model một bước trên timeline.
export type TimelineStep = {
  key: OrderStatus;
  label: string;
  state: "done" | "current" | "todo";
};

// Dựng các bước timeline cho một đơn.
// - Trạng thái bình thường: bước trước = done, đúng status = current, sau = todo.
// - rejected/cancelled: đánh dấu các bước đã qua là done rồi gắn 1 bước "current" cho trạng thái
//   kết thúc (đơn dừng ở đó, không vẽ các bước còn lại của flow).
export function timelineSteps(
  fulfillment: Fulfillment,
  status: OrderStatus,
): TimelineStep[] {
  const flow = flowFor(fulfillment);

  if (status === "rejected" || status === "cancelled") {
    // Đơn kết thúc sớm ngay sau "Chờ xác nhận" (hoặc "Đang chuẩn bị" nếu đã accepted trước đó).
    // Mock không lần ngược lịch sử nên hiển thị: pending(done) → trạng thái kết thúc(current).
    return [
      { key: "pending", label: STATUS_LABEL.pending, state: "done" },
      { key: status, label: STATUS_LABEL[status], state: "current" },
    ];
  }

  const currentIdx = flow.indexOf(status);
  return flow.map((key, idx) => ({
    key,
    label: STATUS_LABEL[key],
    state:
      idx < currentIdx ? "done" : idx === currentIdx ? "current" : "todo",
  }));
}
