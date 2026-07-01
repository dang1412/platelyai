// Emitter toast ở tầng module — làm cầu nối cho code chạy NGOÀI cây React
// (vd `apiFetch`) bắn toast tới `ToastProvider` đang subscribe. Không import React.

import {
  DEFAULT_DURATION,
  DEFAULT_KIND,
  type Toast,
  type ToastInput,
} from "./types";

type Listener = (toast: Toast) => void;

const listeners = new Set<Listener>();

// Đăng ký nhận toast; trả về hàm huỷ đăng ký.
export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

// Chuẩn hoá input → Toast rồi phát tới mọi listener.
export function emitToast(input: ToastInput): void {
  const toast: Toast = {
    id: crypto.randomUUID(),
    kind: input.kind ?? DEFAULT_KIND,
    message: input.message,
    duration: input.duration ?? DEFAULT_DURATION,
  };
  for (const fn of listeners) fn(toast);
}
