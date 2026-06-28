// Phần tương tác của trang theo dõi đơn (feature 11 — mock): timeline + summary + badge,
// nút Huỷ / Đã nhận hàng, và dev stepper giả lập seller đẩy trạng thái.
// "use client" — giữ trạng thái đơn ở local state (chưa có backend/SSE).

"use client";

import { useEffect, useState } from "react";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { OrderStatusTimeline } from "@/components/OrderStatusTimeline";
import { OrderSummary } from "@/components/OrderSummary";
import type { OrderDraft } from "@/components/OrderForm";
import { simulateAdvance } from "@/lib/orders/mock";
import type { Order, OrderStatus } from "@/lib/orders/types";

// Dựng Order từ draft buyer vừa đặt (cất ở sessionStorage). Plan 10: lấy từ API.
function draftToOrder(id: string, d: OrderDraft): Order {
  const now = new Date().toISOString();
  return {
    id,
    restaurantName: d.restaurantName,
    fulfillment: d.fulfillment,
    status: "pending",
    items: d.items,
    total: d.total,
    phone: d.phone,
    address: d.address ?? null,
    note: d.note ?? null,
    events: [{ status: "pending", at: now }],
    createdAt: now,
  };
}

// Banner nhắc buyer hành động khi đơn tới mốc cần nhận hàng.
const HIGHLIGHT: Partial<Record<OrderStatus, string>> = {
  arrived: "Shipper đã tới — ra nhận hàng nhé!",
  ready: "Món đã sẵn sàng — tới quầy lấy nhé!",
};

export function OrderTracker({
  id,
  initialOrder,
}: {
  id: string;
  initialOrder: Order | null;
}) {
  const [order, setOrder] = useState<Order | null>(initialOrder);

  // Không có mock order theo id → thử đọc draft đã cất lúc đặt (mock submit).
  useEffect(() => {
    if (order) return;
    try {
      const raw = sessionStorage.getItem(`order-draft:${id}`);
      if (raw) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setOrder(draftToOrder(id, JSON.parse(raw) as OrderDraft));
      }
    } catch {
      // sessionStorage bị chặn — bỏ qua, hiển thị "không tìm thấy".
    }
  }, [id, order]);

  if (!order) {
    return (
      <p className="text-sm text-muted-foreground">
        Không tìm thấy đơn hàng này.
      </p>
    );
  }

  const setStatus = (status: OrderStatus) =>
    setOrder((o) =>
      o
        ? {
            ...o,
            status,
            events: [...o.events, { status, at: new Date().toISOString() }],
          }
        : o,
    );

  const canCancel = order.status === "pending" || order.status === "accepted";
  const canReceive = order.status === "arrived" || order.status === "ready";
  const highlight = HIGHLIGHT[order.status];

  return (
    <div className="flex flex-col gap-5">
      {/* Tiêu đề + badge */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-foreground">{order.restaurantName}</h1>
        <OrderStatusBadge status={order.status} />
      </div>

      {/* Banner hành động */}
      {highlight && (
        <p className="rounded-lg border border-brand bg-brand/10 px-4 py-3 text-sm font-medium text-brand">
          {highlight}
        </p>
      )}

      {/* Timeline */}
      <OrderStatusTimeline fulfillment={order.fulfillment} status={order.status} />

      {/* Tóm tắt đơn */}
      <OrderSummary
        items={order.items}
        total={order.total}
        fulfillment={order.fulfillment}
        phone={order.phone}
        address={order.address}
      />

      {/* Hành động buyer */}
      {(canCancel || canReceive) && (
        <div className="flex gap-2">
          {canCancel && (
            <button
              type="button"
              onClick={() => setStatus("cancelled")}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-surface-muted"
            >
              Huỷ đơn
            </button>
          )}
          {canReceive && (
            <button
              type="button"
              onClick={() => setStatus("completed")}
              className="flex-1 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-hover"
            >
              Đã nhận hàng
            </button>
          )}
        </div>
      )}

      {/* Dev stepper — TODO(plan 10): gỡ/khoá khi nối backend + SSE. */}
      <div className="rounded-lg border border-dashed border-border p-3">
        <p className="mb-2 text-xs text-muted-foreground">
          🛠️ Preview (dev): giả lập seller đẩy trạng thái
        </p>
        <button
          type="button"
          onClick={() => setOrder((o) => (o ? simulateAdvance(o) : o))}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface-muted"
        >
          → Trạng thái kế
        </button>
      </div>
    </div>
  );
}
