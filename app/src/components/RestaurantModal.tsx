"use client";

import { useEffect, useState } from "react";
import { mapUrl, type RestaurantDetail } from "@/lib/types";

function formatPrice(price: number | null): string {
  if (price == null) return "Liên hệ";
  return `${price.toLocaleString("vi-VN")} đ`;
}

export default function RestaurantModal({
  restaurantId,
  onClose,
  searchLocation,
  distanceM,
}: {
  restaurantId: number | null;
  onClose: () => void;
  searchLocation?: string | null; // địa điểm đang tìm gần (từ query), nếu có
  distanceM?: number | null; // khoảng cách (m) tới địa điểm đó, nếu có
}) {
  const [detail, setDetail] = useState<RestaurantDetail | null>(null);
  // Khởi tạo true vì component được remount (qua `key`) mỗi lần mở quán mới.
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Chia sẻ link quán: ưu tiên Web Share API (mobile), fallback copy clipboard.
  // URL hiện tại đã là dạng /?quan=<id> nhờ trang đồng bộ khi mở modal.
  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: detail?.restaurant.name, url });
        return;
      } catch {
        // user huỷ hộp chia sẻ → bỏ qua
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard bị chặn → bỏ qua
    }
  };

  // Đóng bằng phím Esc.
  useEffect(() => {
    if (restaurantId == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [restaurantId, onClose]);

  // Fetch chi tiết khi mở. (Component được remount qua `key` mỗi lần mở quán mới.)
  useEffect(() => {
    if (restaurantId == null) return;
    let cancelled = false;
    fetch(`/api/restaurants/${restaurantId}`)
      .then((r) => r.json())
      .then((d: RestaurantDetail) => {
        if (!cancelled) setDetail(d);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  if (restaurantId == null) return null;

  const r = detail?.restaurant;
  const gmap = r ? mapUrl(r.googlePlaceId, r.name, r.lat, r.lng) : null;
  const distanceKm = distanceM != null ? (distanceM / 1000).toFixed(1) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40"
      onClick={onClose}
    >
      <aside
        className="h-full w-full max-w-lg overflow-y-auto bg-white shadow-xl dark:bg-zinc-950"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-zinc-200 bg-white/95 p-5 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
          <div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
              {r?.name ?? (loading ? "Đang tải…" : "")}
            </h2>
            {r?.rating && (
              <p className="mt-1 text-sm font-medium text-amber-600">
                ★ {r.rating}
                {r.ratingCount != null && (
                  <span className="text-amber-600/70">
                    {" "}
                    ({r.ratingCount} đánh giá)
                  </span>
                )}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Đóng"
            className="rounded-full p-2 text-zinc-500 transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            ✕
          </button>
        </div>

        {loading && !detail ? (
          <div className="p-5 text-zinc-500">Đang tải thông tin…</div>
        ) : r ? (
          <div className="space-y-6 p-5">
            {/* Hành động */}
            <div className="flex flex-wrap gap-2">
              {gmap && (
                <a
                  href={gmap}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    // Ghi log click (đếm + thời gian) — fire-and-forget, không cản việc mở tab map.
                    fetch(`/api/restaurants/${restaurantId}/map-click`, {
                      method: "POST",
                      keepalive: true,
                    }).catch(() => {});
                  }}
                  className="rounded-full bg-orange-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-700"
                >
                  📍 Mở Google Maps
                </a>
              )}
              {r.website && (
                <a
                  href={r.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  🌐 Website
                </a>
              )}
              <button
                type="button"
                onClick={share}
                className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {copied ? "✓ Đã copy link" : "🔗 Chia sẻ"}
              </button>
            </div>

            {r.address && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {r.address}
              </p>
            )}

            {/* Địa điểm đang tìm gần + khoảng cách (nếu query có địa điểm) */}
            {(searchLocation || distanceKm) && (
              <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-zinc-500 dark:text-zinc-400">
                <span className="text-zinc-400">📍</span>
                {searchLocation && (
                  <span className="font-medium text-zinc-700 dark:text-zinc-200">
                    {searchLocation}
                  </span>
                )}
                {distanceKm && (
                  <span>
                    {searchLocation ? "· " : ""}cách {distanceKm} km
                  </span>
                )}
              </p>
            )}

            {/* Tags (vocab tag khái niệm — bảng tags) */}
            {r.tags && r.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {r.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-orange-50 px-2.5 py-1 text-xs text-orange-700 dark:bg-orange-950 dark:text-orange-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Menu */}
            {detail && detail.menu.length > 0 ? (
              <div>
                <h3 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  Thực đơn
                </h3>
                <div className="space-y-2">
                  {detail.menu.map((cat, i) => (
                    <details
                      key={i}
                      open={i === 0}
                      className="rounded-lg border border-zinc-200 dark:border-zinc-800"
                    >
                      <summary className="cursor-pointer select-none px-4 py-2.5 font-medium text-zinc-800 dark:text-zinc-200">
                        {cat.categoryName}{" "}
                        <span className="text-zinc-400">
                          ({cat.items.length})
                        </span>
                      </summary>
                      <ul className="divide-y divide-zinc-100 px-4 pb-2 dark:divide-zinc-800">
                        {cat.items.map((item, j) => (
                          <li
                            key={j}
                            className="flex items-start justify-between gap-3 py-2"
                          >
                            <div>
                              <p className="text-sm text-zinc-800 dark:text-zinc-200">
                                {item.name}
                              </p>
                              {item.description && (
                                <p className="text-xs text-zinc-500">
                                  {item.description}
                                </p>
                              )}
                            </div>
                            <span className="shrink-0 text-sm font-medium text-orange-600">
                              {formatPrice(item.price)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ))}
                </div>
              </div>
            ) : (
              detail && (
                <p className="text-sm text-zinc-500">
                  Chưa có thông tin thực đơn cho quán này.
                </p>
              )
            )}
          </div>
        ) : (
          <div className="p-5 text-zinc-500">Không tìm thấy quán.</div>
        )}
      </aside>
    </div>
  );
}
