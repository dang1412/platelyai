"use client";

import { useCallback, useEffect, useState } from "react";
import type { LatLng } from "@/lib/types";

type GeoStatus = "idle" | "prompting" | "granted" | "denied" | "unsupported";

const STORAGE_KEY = "geo-enabled";

// Lấy toạ độ thiết bị qua trình duyệt để dùng làm origin tìm quán gần.
// Nhớ trạng thái bật qua localStorage: lần sau tự xin lại (trình duyệt nhớ permission
// nên không hỏi lại). Không tự xin nếu user chưa từng bật.
export function useGeolocation() {
  const [coords, setCoords] = useState<LatLng | null>(null);
  // Bắt đầu "idle" để khớp SSR (server không có navigator); phát hiện "unsupported"
  // sau khi mount trong effect — nếu lazy-init theo navigator sẽ lệch hydration.
  const [status, setStatus] = useState<GeoStatus>("idle");

  const request = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unsupported");
      return;
    }
    setStatus("prompting");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStatus("granted");
        try {
          localStorage.setItem(STORAGE_KEY, "1");
        } catch {
          // localStorage không khả dụng (private mode) — bỏ qua.
        }
      },
      (err) => {
        setStatus(err.code === err.PERMISSION_DENIED ? "denied" : "idle");
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 5 * 60_000 },
    );
  }, []);

  // Tắt định vị: xoá coords + cờ localStorage, quay về trạng thái mặc định.
  const clear = useCallback(() => {
    setCoords(null);
    setStatus("idle");
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // bỏ qua
    }
  }, []);

  // Sau khi mount (client-only): đánh dấu unsupported nếu trình duyệt không hỗ trợ,
  // ngược lại nếu user từng bật thì tự xin lại (không popup vì permission đã được nhớ).
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus("unsupported");
      return;
    }
    let enabled = false;
    try {
      enabled = localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      enabled = false;
    }
    if (enabled) request();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { coords, status, request, clear };
}
