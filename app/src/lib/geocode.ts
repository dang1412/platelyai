import type { LatLng } from "./types";

// Bước 2 — đổi tên địa điểm → toạ độ qua Google Places searchText.
// Chỉ dùng khi request không có toạ độ thiết bị (lat,lng ưu tiên hơn, xử lý ở route).
// Xem plans/01_2_geocode.md.

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

// Cache theo tên đã chuẩn hoá, sống trong vòng đời process (per-process; nâng Redis sau nếu cần).
// Bao gồm cả kết quả null (không tìm thấy / lỗi) để khỏi gọi lại Google liên tục.
// Giới hạn số item: Map giữ thứ tự chèn → LRU; vượt CACHE_MAX thì xoá key cũ nhất (đầu Map).
export const CACHE_MAX = 1000;
const cache = new Map<string, LatLng | null>();

function setCache(key: string, value: LatLng | null): void {
  cache.delete(key); // nếu đã có, set lại để đẩy về cuối (mới nhất)
  cache.set(key, value);
  if (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value; // key đầu = cũ nhất
    if (oldest !== undefined) cache.delete(oldest);
  }
}

type SearchTextResponse = {
  places?: { location?: { latitude?: number; longitude?: number } }[];
};

// Đọc toạ độ địa điểm đầu tiên từ response. THUẦN để test (không chạm mạng).
export function parseGeocodeResponse(data: SearchTextResponse): LatLng | null {
  const loc = data?.places?.[0]?.location;
  if (
    !loc ||
    typeof loc.latitude !== "number" ||
    typeof loc.longitude !== "number"
  ) {
    return null;
  }
  return { lat: loc.latitude, lng: loc.longitude };
}

export async function geocode(location: string): Promise<LatLng | null> {
  const key = location.trim().toLowerCase();
  if (!key) return null;
  if (cache.has(key)) {
    const hit = cache.get(key)!;
    setCache(key, hit); // bump recency
    return hit;
  }

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        // Chỉ lấy toạ độ cho rẻ.
        "X-Goog-FieldMask": "places.location",
      },
      body: JSON.stringify({ textQuery: location, languageCode: "vi" }),
    });

    if (!res.ok) {
      console.error("geocode HTTP", res.status);
      setCache(key, null);
      return null;
    }

    const result = parseGeocodeResponse((await res.json()) as SearchTextResponse);
    setCache(key, result);
    return result;
  } catch (e) {
    console.error("geocode failed:", e);
    setCache(key, null);
    return null;
  }
}

// Test-only: xoá cache giữa các test.
export function _resetGeocodeCache(): void {
  cache.clear();
}
