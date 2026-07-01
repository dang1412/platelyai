// UI toast — cố định góc phải-dưới, xếp chồng dọc. Presentational thuần:
// nhận danh sách toast + onClose. Màu theo kind, chỉ dùng token semantic.

"use client";

import type { Toast, ToastKind } from "@/lib/toast/types";

// Viền trái + màu chữ nhấn theo loại toast.
const KIND_CLASS: Record<ToastKind, string> = {
  error: "border-l-danger text-danger",
  success: "border-l-success text-success",
  info: "border-l-brand text-brand",
};

type Props = {
  toasts: Toast[];
  onClose: (id: string) => void;
};

export function ToastViewport({ toasts, onClose }: Props) {
  if (toasts.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-start gap-3 rounded-lg border border-border border-l-4 bg-surface p-3 shadow-lg ${KIND_CLASS[t.kind]}`}
        >
          <p className="flex-1 text-sm text-foreground">{t.message}</p>
          <button
            type="button"
            onClick={() => onClose(t.id)}
            aria-label="Đóng thông báo"
            className="-mr-1 -mt-1 shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
