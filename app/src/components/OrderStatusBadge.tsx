// Pill nhãn trạng thái đơn — màu theo nhóm (đang xử lý / hoàn tất / kết thúc).
// Presentational thuần: chỉ nhận `status`, không fetch.

import { STATUS_LABEL, statusTone, type StatusTone } from "@/lib/orders/statusMeta";
import type { OrderStatus } from "@/lib/orders/types";

const TONE_CLASS: Record<StatusTone, string> = {
  active: "bg-brand/10 text-brand",
  success: "bg-success/10 text-success",
  muted: "bg-surface-muted text-muted-foreground",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium ${TONE_CLASS[statusTone(status)]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
