"use client";

import { useEffect, useRef } from "react";

// Tín hiệu mỏng từ SSE (khớp OrderNotify ở realtime/bus — KHÔNG import bus ở client vì nó kéo pg).
export type OrderStreamEvent = {
  orderId: number;
  status: string;
  buyerId: number;
  restaurantId: number;
};

type Listener = (payload?: OrderStreamEvent) => void;

// ── EventSource DÙNG CHUNG cho cả app ───────────────────────────────────────────────
// Mọi useOrderStream chia sẻ 1 kết nối tới /api/orders/stream (ref-count). Điều hướng giữa các
// trang (list ↔ detail) chỉ thêm/bớt listener, KHÔNG đóng/mở lại stream. Khi không còn listener,
// đóng sau 1 khoảng debounce để qua được lúc unmount→mount trong điều hướng.
let es: EventSource | null = null;
let firstOpen = true;
let closeTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<Listener>();

function ensureOpen(): void {
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
  if (es) return;
  firstOpen = true;
  es = new EventSource("/api/orders/stream");
  es.onopen = () => {
    // Lần connect đầu bỏ qua (mỗi trang tự load khi mount); reconnect sau → refetch bù lỡ.
    if (firstOpen) {
      firstOpen = false;
      return;
    }
    for (const l of listeners) l();
  };
  es.onmessage = (e) => {
    let payload: OrderStreamEvent | undefined;
    try {
      payload = JSON.parse(e.data) as OrderStreamEvent;
    } catch {
      payload = undefined;
    }
    for (const l of listeners) l(payload);
  };
}

function scheduleCloseIfIdle(): void {
  if (listeners.size > 0 || closeTimer) return;
  closeTimer = setTimeout(() => {
    closeTimer = null;
    if (listeners.size === 0 && es) {
      es.close();
      es = null;
    }
  }, 10000);
}

// Đăng ký nhận tín hiệu đơn từ stream chung.
// - onmessage(payload): đơn liên quan đổi trạng thái → caller refetch.
// - reconnect (không tham số): caller refetch để bù event lỡ.
// `enabled=false` (vd user chưa đăng nhập) → không đăng ký/không mở stream (tránh gọi
// /api/orders/stream → 401 retry liên tục). Khi bật lại mới mở.
export function useOrderStream(onEvent: Listener, enabled = true): void {
  const cb = useRef(onEvent);
  useEffect(() => {
    cb.current = onEvent;
  });

  useEffect(() => {
    if (!enabled) return;
    const listener: Listener = (p) => cb.current(p);
    listeners.add(listener);
    ensureOpen();
    return () => {
      listeners.delete(listener);
      scheduleCloseIfIdle();
    };
  }, [enabled]);
}
