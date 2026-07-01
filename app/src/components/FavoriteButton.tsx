// Nút tim đánh dấu quán yêu thích (buyer đã đăng nhập). Tự fetch trạng thái khi mount, toggle
// qua POST/DELETE /api/favorites. Ẩn nếu chưa đăng nhập. "use client" — state + fetch + session.

"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/apiFetch";

export function FavoriteButton({ restaurantId }: { restaurantId: number }) {
  const { status } = useSession();
  const authed = status === "authenticated";
  const [fav, setFav] = useState<boolean | null>(null); // null = chưa biết
  const [busy, setBusy] = useState(false);

  // Lấy trạng thái yêu thích của quán này (chỉ khi đã đăng nhập).
  useEffect(() => {
    if (!authed) return;
    let active = true;
    fetch(`/api/favorites?restaurantId=${restaurantId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { favorite?: boolean } | null) => {
        if (active && d) setFav(Boolean(d.favorite));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [authed, restaurantId]);

  if (!authed || fav === null) return null;

  const toggle = async () => {
    setBusy(true);
    const next = !fav;
    setFav(next); // optimistic
    try {
      const res = await apiFetch("/api/favorites", {
        method: next ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId }),
      });
      if (!res.ok) setFav(!next); // rollback (apiFetch đã bắn toast lỗi)
    } catch {
      setFav(!next); // rollback
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={fav}
      aria-label={fav ? "Bỏ yêu thích" : "Thêm vào yêu thích"}
      title={fav ? "Bỏ yêu thích" : "Thêm vào yêu thích"}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-brand transition hover:bg-surface-muted disabled:opacity-50"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill={fav ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
        aria-hidden="true"
      >
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A3.5 3.5 0 0 0 18.5 5c-1.74 0-3 .5-4.5 2-1.5-1.5-2.76-2-4.5-2A3.5 3.5 0 0 0 6 8.5c0 2.29 1.51 4.04 3 5.5l5 5Z" />
      </svg>
    </button>
  );
}
