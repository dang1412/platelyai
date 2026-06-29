// Row tóm tắt 1 đơn cho dashboard seller — quán + badge + SDT + tổng + thời gian, link tới chi tiết.
// Presentational thuần: nhận `order`, không fetch.

import Link from "next/link";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import type { Order } from "@/lib/orders/types";

function formatPrice(price: number): string {
  return `${price.toLocaleString("vi-VN")} đ`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SellerOrderRow({ order }: { order: Order }) {
  return (
    <Link
      href={`/admin/orders/${order.id}`}
      className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 transition-colors hover:bg-surface-muted"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-foreground">{order.restaurantName}</span>
        <OrderStatusBadge status={order.status} />
      </div>
      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>
          {formatTime(order.createdAt)} · {order.phone}
        </span>
        <span className="font-semibold text-brand">{formatPrice(order.total)}</span>
      </div>
    </Link>
  );
}
