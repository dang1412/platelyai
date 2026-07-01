// Lớp React nhận toast từ bus (module-level), giữ trong state và tự huỷ sau
// `duration`. Render children + viewport. Không cung cấp Context — code bắn toast
// dùng bus/useToast trực tiếp, nên Provider chỉ lo hiển thị.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ToastViewport } from "./ToastViewport";
import { subscribe } from "@/lib/toast/bus";
import type { Toast } from "@/lib/toast/types";

export default function ToastProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Giữ timer theo id để clear khi unmount / đóng tay.
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  useEffect(() => {
    const timersMap = timers.current;
    const off = subscribe((toast) => {
      setToasts((prev) => [...prev, toast]);
      const timer = setTimeout(() => remove(toast.id), toast.duration);
      timersMap.set(toast.id, timer);
    });
    return () => {
      off();
      for (const timer of timersMap.values()) clearTimeout(timer);
      timersMap.clear();
    };
  }, [remove]);

  return (
    <>
      {children}
      <ToastViewport toasts={toasts} onClose={remove} />
    </>
  );
}
