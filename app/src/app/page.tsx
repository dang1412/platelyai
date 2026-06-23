"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import SearchBar from "@/components/SearchBar";
import RestaurantCard, { fmtVnd } from "@/components/RestaurantCard";
import RestaurantModal from "@/components/RestaurantModal";
import { useGeolocation } from "@/hooks/useGeolocation";
import type {
  LatLng,
  ParsedQuery,
  RestaurantSummary,
  SearchResponse,
} from "@/lib/types";

// &lat=..&lng=.. để gửi toạ độ thiết bị lên API; "" nếu chưa bật định vị.
const geoParam = (c: LatLng | null) => (c ? `&lat=${c.lat}&lng=${c.lng}` : "");

const searchUrl = (q: string, c: LatLng | null) =>
  `/api/search?q=${encodeURIComponent(q)}${geoParam(c)}`;

export default function Home() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RestaurantSummary[]>([]);
  const [parsed, setParsed] = useState<ParsedQuery | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { coords, status: geoStatus, request: requestGeo, clear: clearGeo } =
    useGeolocation();

  // query đổi khi user commit (Enter/blur); coords đổi khi bật/tắt định vị.
  // Cả hai đều phải tải lại — gộp vào một effect, AbortController huỷ request cũ.
  // query rỗng vẫn gọi /api/search (route trả top rating / quán gần khi có origin).
  useEffect(() => {
    const controller = new AbortController();
    const trimmed = query.trim();

    // Hiện trạng thái tải ngay khi query/coords đổi (data-fetching effect cần setState đồng bộ).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetch(searchUrl(trimmed, coords), { signal: controller.signal })
      .then((r) => r.json() as Promise<SearchResponse>)
      .then(({ parsed, results }) => {
        setParsed(parsed);
        setResults(results);
      })
      .catch((e) => {
        if (e.name !== "AbortError") console.error(e);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [query, coords]);

  // Mở/đóng modal chi tiết quán có đồng bộ URL (?quan=<id>) để chia sẻ được link.
  // pushState giữ history → nút back của trình duyệt sẽ đóng modal.
  const openRestaurant = (id: number) => {
    setSelectedId(id);
    window.history.pushState(null, "", `?quan=${id}`);
  };
  const closeRestaurant = () => {
    setSelectedId(null);
    window.history.pushState(null, "", window.location.pathname);
  };

  // Đọc ?quan khi tải trang (mở thẳng từ link chia sẻ) + xử lý nút back/forward.
  useEffect(() => {
    const sync = () => {
      const raw = new URLSearchParams(window.location.search).get("quan");
      const id = raw ? Number(raw) : NaN;
      setSelectedId(Number.isInteger(id) ? id : null);
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <header className="mb-8 text-center">
        <h1 className="flex justify-center">
          <Image
            src="/logo.png"
            alt="platelyai"
            width={713}
            height={233}
            priority
            className="h-16 w-auto"
          />
        </h1>
        <p className="mt-1 text-zinc-500 dark:text-zinc-400">
          Tìm quán ăn ngon gần Vinhomes Ocean Park
        </p>
      </header>

      <div className="mx-auto mb-8 max-w-2xl">
        <SearchBar value={query} onSearch={setQuery} />

        {/* Bật/tắt định vị thiết bị để tìm quán gần vị trí thật */}
        {geoStatus !== "unsupported" && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            {coords ? (
              <>
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                  📍 Đang dùng vị trí của bạn
                </span>
                <button
                  type="button"
                  onClick={clearGeo}
                  className="rounded-full px-2 py-0.5 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  Tắt
                </button>
              </>
            ) : geoStatus === "denied" ? (
              <span className="text-zinc-500 dark:text-zinc-400">
                Đã chặn định vị — bật lại trong cài đặt trình duyệt, hoặc gõ tên
                địa điểm trong câu tìm.
              </span>
            ) : (
              <button
                type="button"
                onClick={requestGeo}
                disabled={geoStatus === "prompting"}
                className="rounded-full bg-zinc-100 px-3 py-0.5 font-medium text-zinc-700 transition hover:bg-zinc-200 disabled:opacity-60 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              >
                {geoStatus === "prompting"
                  ? "Đang lấy vị trí…"
                  : "📍 Dùng vị trí của tôi"}
              </button>
            )}
          </div>
        )}

        {/* Ý định AI trích xuất từ câu tìm kiếm (6 yếu tố của plan 01) */}
        {parsed && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            {parsed.category && (
              <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                {parsed.category === "food" ? "🍽 Đồ ăn" : "🥤 Giải khát"}
              </span>
            )}
            {parsed.dishes.map((d) => (
              <span
                key={`dish-${d}`}
                className="rounded-full bg-green-100 px-2.5 py-0.5 text-green-700 dark:bg-green-900/40 dark:text-green-300"
              >
                🍜 {d}
              </span>
            ))}
            {parsed.tags.map((t) => (
              <span
                key={`tag-${t}`}
                className="rounded-full bg-orange-100 px-2.5 py-0.5 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"
              >
                {t}
              </span>
            ))}
            {parsed.maxPrice != null && (
              <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                💰 ≤ {fmtVnd(parsed.maxPrice)}
              </span>
            )}
            {parsed.wantsCheap && (
              <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                ưu tiên rẻ
              </span>
            )}
            {coords ? (
              <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                📍 Vị trí của bạn
              </span>
            ) : parsed.location ? (
              <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                📍 {parsed.location}
              </span>
            ) : null}
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-center text-zinc-500">Đang tải…</p>
      ) : results.length === 0 ? (
        <p className="text-center text-zinc-500">
          {query.trim()
            ? `Không tìm thấy quán nào khớp với “${query}”.`
            : "Chưa có quán nào để hiển thị."}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((r) => (
            <RestaurantCard
              key={r.id}
              restaurant={r}
              onClick={() => openRestaurant(r.id)}
            />
          ))}
        </div>
      )}

      <RestaurantModal
        key={selectedId ?? "none"}
        restaurantId={selectedId}
        onClose={closeRestaurant}
        searchLocation={coords ? null : (parsed?.location ?? null)}
        distanceM={results.find((r) => r.id === selectedId)?.distanceM ?? null}
      />
    </div>
  );
}
