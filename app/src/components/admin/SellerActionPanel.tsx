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
  // Form lý do từ chối (mở khi bấm "Từ chối"); lý do gửi kèm làm note của event 'rejected'.
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const id = order.id;

  // Refetch khi có event của đơn này (vd buyer huỷ) — set state trong promise-chain.
  const refetch = () => {
    fetch(`/api/orders/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { order: Order } | null) => d && setOrder(d.order))
      .catch(() => {});
  };
  // Patch status từ payload (0 request); reconnect (payload rỗng) → full refetch bù lỡ.
  useOrderStream((payload) => {
    if (!payload) {
      refetch();
      return;
    }
    if (String(payload.orderId) !== id) return;
    setOrder((prev) => (prev ? { ...prev, status: payload.status as OrderStatus } : prev));
  });

  const act = async (toStatus: OrderStatus, note?: string) => {
    setActing(true);
    try {
      const res = await fetch(`/api/orders/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toStatus, note }),
      });
      if (res.ok) {
        const data = (await res.json()) as { order: Order };
        setOrder(data.order);
        setRejecting(false);
        setReason("");
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
        {rejectable && !rejecting && (
          <button
            type="button"
            disabled={acting}
            onClick={() => setRejecting(true)}
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface-muted disabled:opacity-50"
          >
            Từ chối
          </button>
        )}
        {!step && !rejectable && (
          <p className="text-sm text-muted-foreground">Đơn đã kết thúc.</p>
        )}
      </div>

      {/* Form lý do từ chối */}
      {rejectable && rejecting && (
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <label className="text-sm font-medium text-foreground">Lý do từ chối</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="VD: hết món, ngoài giờ phục vụ, ngoài khu vực giao… (tuỳ chọn)"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-brand"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={acting}
              onClick={() => act("rejected", reason.trim() || undefined)}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-hover disabled:opacity-50"
            >
              Xác nhận từ chối
            </button>
            <button
              type="button"
              disabled={acting}
              onClick={() => {
                setRejecting(false);
                setReason("");
              }}
              className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface-muted disabled:opacity-50"
            >
              Huỷ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
