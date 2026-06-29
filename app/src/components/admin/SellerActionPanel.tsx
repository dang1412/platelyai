// Panel thao tác seller cho 1 đơn (feature 13 — mock). Giữ trạng thái đơn ở local state và mô phỏng
// nhận/từ chối/đẩy trạng thái. "use client" — chưa có backend/SSE (plan 10 thay bằng PATCH + refetch).

"use client";

import { useState } from "react";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { OrderStatusTimeline } from "@/components/OrderStatusTimeline";
import { simulateAdvance, simulateReject } from "@/lib/orders/mock";
import { canReject, nextSellerStep } from "@/lib/orders/sellerActions";
import type { Order } from "@/lib/orders/types";

export function SellerActionPanel({ initialOrder }: { initialOrder: Order }) {
  const [order, setOrder] = useState(initialOrder);
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
            onClick={() => setOrder(simulateAdvance(order))}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-hover"
          >
            {step.label}
          </button>
        )}
        {rejectable && (
          <button
            type="button"
            onClick={() => setOrder(simulateReject(order))}
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface-muted"
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
