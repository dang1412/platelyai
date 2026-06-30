import { NextRequest } from "next/server";
import { extractQuery } from "@/lib/extract";
import { geocode } from "@/lib/geocode";
import { loadTagVocab } from "@/lib/tags";
import {
  candidatesFromDishes,
  candidatesNearbyOrTop,
} from "@/lib/candidates";
import { rerank } from "@/lib/rank";
import { getCurrentUser } from "@/lib/authz";
import { appendSearchLog } from "@/lib/searchLog";
import type { LatLng, SearchResponse } from "@/lib/types";

// fs để ghi search log theo ngày (plan 16) cần Node runtime.
export const runtime = "nodejs";

// GET /api/search?q=<câu tự nhiên>[&lat=&lng=]
// Một luồng duy nhất (plan 01 §3): extract → origin → candidates (MÓN/QUÁN) → rerank.
export async function GET(request: NextRequest): Promise<Response> {
  const params = request.nextUrl.searchParams;
  const q = params.get("q")?.trim() ?? "";
  const coords = coordsFromParams(params);

  // [1] PARSE — vocab tag nạp từ DB (cache) để validate yếu tố tags. error = lỗi gọi LLM (ghi log).
  const vocab = await loadTagVocab();
  const { parsed, error } = await extractQuery(q, vocab);

  // [2] ORIGIN — toạ độ thiết bị thắng; không có thì geocode location trong câu.
  const origin: LatLng | null =
    coords ?? (parsed.location ? await geocode(parsed.location) : null);

  // [3] CANDIDATES — có món → nhánh MÓN; không → nhánh QUÁN.
  const candidates =
    parsed.dishes.length > 0
      ? await candidatesFromDishes(parsed, origin)
      : await candidatesNearbyOrTop(parsed, origin);

  // [4] RANK — wantsCheap bơm cheapness, tags cộng điểm trùng tag quán.
  const results = rerank(candidates, parsed.wantsCheap, parsed.tags);

  // [5] LOG — fire-and-forget ra file theo ngày (plan 16). Không await để khỏi trì hoãn response;
  // appendSearchLog tự nuốt lỗi nên không làm vỡ search. Không lộ `error` ra client.
  const userId = (await getCurrentUser())?.id ?? null;
  void appendSearchLog({
    ts: new Date().toISOString(),
    userId,
    q,
    location: parsed.location,
    deviceCoords: coords,
    origin,
    parsed,
    resultCount: results.length,
    error,
  });

  return Response.json({ parsed, results } satisfies SearchResponse);
}

// Toạ độ thiết bị từ ?lat=&lng= (client gửi khi bật định vị). null nếu thiếu/ngoài range.
function coordsFromParams(params: URLSearchParams): LatLng | null {
  const latRaw = params.get("lat");
  const lngRaw = params.get("lng");
  if (!latRaw || !lngRaw) return null;
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  ) {
    return { lat, lng };
  }
  return null;
}
