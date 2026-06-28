// Tóm tắt 1 đơn cho danh sách — tên quán + badge + tổng + thời gian.
// Nhận `onClick?` nên là client component (cần handler); plan 10 có thể bọc Link thay vì onClick.

"use client";

import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import type { Order } from "@/lib/orders/types";

// Định dạng giá VND (như RestaurantModal).
function formatPrice(price: number): string {
  return `${price.toLocaleString("vi-VN")} đ`;
}

// Thời gian tạo đơn dạng dd/MM HH:mm (cố định locale vi-VN cho ổn định SSR/CSR).
function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Props = {
  order: Order;
  onClick?: () => void;
};

export function OrderCard({ order, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-col gap-2 rounded-lg border border-border bg-surface p-4 text-left transition-colors hover:bg-surface-muted"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-foreground">{order.restaurantName}</span>
        <OrderStatusBadge status={order.status} />
      </div>
      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>{formatTime(order.createdAt)}</span>
        <span className="font-semibold text-brand">{formatPrice(order.total)}</span>
      </div>
    </button>
  );
}
