import type { LatLng } from "./types";

// Bước 2 — đổi tên địa điểm → toạ độ qua Google Places searchText.
// Chỉ dùng khi request không có toạ độ thiết bị (lat,lng ưu tiên hơn, xử lý ở route).
// Xem plans/01_2_geocode.md.

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

// Cache theo tên đã chuẩn hoá, sống trong vòng đời process.
const cache = new Map<string, LatLng | null>();

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
  if (cache.has(key)) return cache.get(key)!;

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
      cache.set(key, null);
      return null;
    }

    const result = parseGeocodeResponse((await res.json()) as SearchTextResponse);
    cache.set(key, result);
    return result;
  } catch (e) {
    console.error("geocode failed:", e);
    cache.set(key, null);
    return null;
  }
}

// Test-only: xoá cache giữa các test.
export function _resetGeocodeCache(): void {
  cache.clear();
}
