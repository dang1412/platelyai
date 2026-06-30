// Trang "Quán yêu thích của tôi": liệt kê quán đã đánh dấu, bấm card mở modal quán ở trang chủ
// (?quan=<id>). "use client" — cần fetch + điều hướng.

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import RestaurantCard from "@/components/RestaurantCard";
import type { RestaurantSummary } from "@/lib/types";

export default function FavoritesPage() {
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<RestaurantSummary[] | null>(null);
  const [needLogin, setNeedLogin] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/favorites")
      .then((r) => {
        if (r.status === 401) {
          if (active) setNeedLogin(true);
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then((d: { restaurants?: RestaurantSummary[] } | null) => {
        if (active) setRestaurants(d?.restaurants ?? []);
      })
      .catch(() => active && setRestaurants([]));
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <SiteHeader />
      <h1 className="mb-6 text-xl font-bold text-foreground">Quán yêu thích</h1>

      {needLogin ? (
        <p className="text-sm text-muted-foreground">
          Đăng nhập để xem các quán bạn đã đánh dấu yêu thích.
        </p>
      ) : restaurants === null ? (
        <p className="text-sm text-muted-foreground">Đang tải…</p>
      ) : restaurants.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Chưa có quán yêu thích. Mở một quán và bấm ♥ để thêm.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {restaurants.map((r) => (
            <RestaurantCard
              key={r.id}
              restaurant={r}
              onClick={() => router.push(`/?quan=${r.id}`)}
            />
          ))}
        </div>
      )}
    </main>
  );
}
