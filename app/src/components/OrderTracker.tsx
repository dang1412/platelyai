// Trang theo dõi đơn buyer (plan 10): fetch đơn thật + cập nhật realtime qua SSE; nút Huỷ / Đã nhận
// hàng gọi PATCH trạng thái. "use client" — cần fetch + EventSource.

"use client";

import { useEffect, useState } from "react";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { OrderStatusTimeline } from "@/components/OrderStatusTimeline";
import { OrderSummary } from "@/components/OrderSummary";
import { useOrderStream } from "@/lib/useOrderStream";
import type { Order, OrderStatus } from "@/lib/orders/types";

// Banner nhắc buyer hành động khi đơn tới mốc cần nhận hàng.
const HIGHLIGHT: Partial<Record<OrderStatus, string>> = {
  arrived: "Shipper đã tới — ra nhận hàng nhé!",
  ready: "Món đã sẵn sàng — tới quầy lấy nhé!",
};

export function OrderTracker({ id }: { id: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  // Refetch đơn (dùng ở stream + sau khi PATCH); set state trong promise-chain (event handler).
  const refetch = () => {
    fetch(`/api/orders/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { order: Order } | null) => setOrder(d?.order ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  // Load lần đầu khi mount (inline để không vướng set-state-in-effect).
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/orders/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { order: Order } | null) => {
        if (!cancelled) setOrder(d?.order ?? null);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Realtime: patch status từ payload (0 request); reconnect (payload rỗng) → full refetch bù lỡ.
  useOrderStream((payload) => {
    if (!payload) {
      refetch();
      return;
    }
    if (String(payload.orderId) !== id) return;
    setOrder((prev) => (prev ? { ...prev, status: payload.status as OrderStatus } : prev));
  });

  const patch = async (toStatus: OrderStatus) => {
    setActing(true);
    try {
      const res = await fetch(`/api/orders/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toStatus }),
      });
      if (res.ok) {
        const data = (await res.json()) as { order: Order };
        setOrder(data.order);
      }
    } catch {
      // bỏ qua — stream/refetch sẽ đồng bộ lại
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Đang tải đơn…</p>;
  }
  if (!order) {
    return <p className="text-sm text-muted-foreground">Không tìm thấy đơn hàng này.</p>;
  }

  const canCancel = order.status === "pending" || order.status === "accepted";
  const canReceive = order.status === "arrived" || order.status === "ready";
  const highlight = HIGHLIGHT[order.status];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-foreground">{order.restaurantName}</h1>
        <OrderStatusBadge status={order.status} />
      </div>

      {highlight && (
        <p className="rounded-lg border border-brand bg-brand/10 px-4 py-3 text-sm font-medium text-brand">
          {highlight}
        </p>
      )}

      <OrderStatusTimeline fulfillment={order.fulfillment} status={order.status} />

      <OrderSummary
        items={order.items}
        total={order.total}
        fulfillment={order.fulfillment}
        phone={order.phone}
        address={order.address}
        lat={order.lat}
        lng={order.lng}
      />

      {(canCancel || canReceive) && (
        <div className="flex gap-2">
          {canCancel && (
            <button
              type="button"
              disabled={acting}
              onClick={() => patch("cancelled")}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-surface-muted disabled:opacity-50"
            >
              Huỷ đơn
            </button>
          )}
          {canReceive && (
            <button
              type="button"
              disabled={acting}
              onClick={() => patch("completed")}
              className="flex-1 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-hover disabled:opacity-50"
            >
              Đã nhận hàng
            </button>
          )}
        </div>
      )}
    </div>
  );
}
