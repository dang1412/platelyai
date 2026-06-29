// Panel thao tác seller cho 1 đơn (plan 10): PATCH trạng thái thật + đồng bộ realtime qua SSE.
// "use client" — cần fetch + EventSource.

"use client";

import { useState } from "react";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { OrderStatusTimeline } from "@/components/OrderStatusTimeline";
import { useOrderStream } from "@/lib/useOrderStream";
import { canReject, nextSellerStep } from "@/lib/orders/sellerActions";
import type { Order, OrderStatus } from "@/lib/orders/types";

export function SellerActionPanel({ initialOrder }: { initialOrder: Order }) {
  const [order, setOrder] = useState(initialOrder);
  const [acting, setActing] = useState(false);
  const id = order.id;

  // Refetch khi có event của đơn này (vd buyer huỷ) — set state trong promise-chain.
  const refetch = () => {
    fetch(`/api/orders/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { order: Order } | null) => d && setOrder(d.order))
      .catch(() => {});
  };
  useOrderStream((payload) => {
    if (!payload || String(payload.orderId) === id) refetch();
  });

  const act = async (toStatus: OrderStatus) => {
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
      // bỏ qua — stream/refetch đồng bộ lại
    } finally {
      setActing(false);
    }
  };

  const step = nextSellerStep(order);
  const rejectable = canReject(order);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Trạng thái:</span>
        <OrderStatusBadge status={order.status} />
      </div>

      <OrderStatusTimeline fulfillment={order.fulfillment} status={order.status} />

      <div className="flex flex-wrap gap-2">
        {step && (
          <button
            type="button"
            disabled={acting}
            onClick={() => act(step.toStatus)}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-hover disabled:opacity-50"
          >
            {step.label}
          </button>
        )}
        {rejectable && (
          <button
            type="button"
            disabled={acting}
            onClick={() => act("rejected")}
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface-muted disabled:opacity-50"
          >
            Từ chối
          </button>
        )}
        {!step && !rejectable && (
          <p className="text-sm text-muted-foreground">Đơn đã kết thúc.</p>
        )}
      </div>
    </div>
  );
}
