"use client";

import { useEffect, useRef } from "react";

// Tín hiệu mỏng từ SSE (khớp OrderNotify ở realtime/bus — KHÔNG import bus ở client vì nó kéo pg).
export type OrderStreamEvent = {
  orderId: number;
  status: string;
  buyerId: number;
  restaurantId: number;
};

// Mở EventSource tới /api/orders/stream và gọi onEvent khi có tín hiệu.
// - onmessage(payload): đơn liên quan đổi trạng thái → caller refetch đơn đó.
// - onopen (không tham số): (re)connect → caller refetch để bù event lỡ lúc mất kết nối.
// EventSource tự reconnect khi rớt; chỉ cần đóng khi unmount.
export function useOrderStream(
  onEvent: (payload?: OrderStreamEvent) => void,
): void {
  const cb = useRef(onEvent);
  useEffect(() => {
    cb.current = onEvent;
  });

  useEffect(() => {
    const es = new EventSource("/api/orders/stream");
    es.onopen = () => cb.current();
    es.onmessage = (e) => {
      try {
        cb.current(JSON.parse(e.data) as OrderStreamEvent);
      } catch {
        cb.current();
      }
    };
    return () => es.close();
  }, []);
}
