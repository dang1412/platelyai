// Timeline dọc các bước đơn hàng — chấm done/current/todo, phân nhánh delivery/pickup
// tự nhiên vì `timelineSteps` đã trả step list khác nhau theo fulfillment.
// Presentational thuần: nhận `{fulfillment, status}`, không fetch.

import { timelineSteps } from "@/lib/orders/statusMeta";
import type { Fulfillment, OrderStatus } from "@/lib/orders/types";

type Props = {
  fulfillment: Fulfillment;
  status: OrderStatus;
};

// Class cho chấm tròn theo trạng thái bước.
const DOT_CLASS: Record<"done" | "current" | "todo", string> = {
  done: "bg-success border-success",
  current: "bg-brand border-brand",
  todo: "bg-surface border-border",
};

export function OrderStatusTimeline({ fulfillment, status }: Props) {
  const steps = timelineSteps(fulfillment, status);

  return (
    <ol className="flex flex-col">
      {steps.map((step, idx) => {
        const isLast = idx === steps.length - 1;
        return (
          <li key={step.key} className="flex gap-3">
            {/* Cột chấm + đường nối */}
            <div className="flex flex-col items-center">
              <span
                className={`mt-0.5 size-3 rounded-full border-2 ${DOT_CLASS[step.state]}`}
              />
              {!isLast && (
                <span
                  className={`w-0.5 flex-1 ${step.state === "done" ? "bg-success" : "bg-border"}`}
                />
              )}
            </div>
            {/* Nhãn bước */}
            <span
              className={`pb-6 text-sm ${
                step.state === "current"
                  ? "font-semibold text-brand"
                  : step.state === "done"
                    ? "text-foreground"
                    : "text-muted-foreground"
              }`}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
