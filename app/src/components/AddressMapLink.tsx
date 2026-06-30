// Link bản đồ cho địa chỉ giao trong tóm tắt đơn: bấm "Kiểm tra toạ độ" → gọi /api/geocode lấy
// lat/lng (cache server), có toạ độ rồi mới hiện link "Mở bản đồ" (mở đúng điểm theo toạ độ).
// "use client" — có state + fetch. Render được trong cả RSC (admin) lẫn client (OrderTracker).

"use client";

import { useState } from "react";
import type { LatLng } from "@/lib/types";

export function AddressMapLink({ address }: { address: string }) {
  const [geo, setGeo] = useState<LatLng | null>(null);
  const [checking, setChecking] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const check = async () => {
    setChecking(true);
    setErr(null);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(address)}`);
      if (!res.ok) {
        const d = (await res.json().catch(() => null)) as { error?: string } | null;
        setErr(d?.error ?? "Không tìm được toạ độ.");
        return;
      }
      setGeo((await res.json()) as LatLng);
    } catch {
      setErr("Lỗi mạng khi lấy toạ độ.");
    } finally {
      setChecking(false);
    }
  };

  if (geo) {
    return (
      <a
        href={`https://www.google.com/maps/search/?api=1&query=${geo.lat},${geo.lng}`}
        target="_blank"
        rel="noopener noreferrer"
        className="whitespace-nowrap text-brand hover:underline"
      >
        Mở bản đồ ↗
      </a>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={check}
        disabled={checking}
        className="whitespace-nowrap text-brand hover:underline disabled:opacity-50"
      >
        {checking ? "Đang lấy toạ độ…" : "Kiểm tra toạ độ"}
      </button>
      {err && <span className="ml-1 text-xs text-brand">{err}</span>}
    </>
  );
}
