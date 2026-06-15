import { RADIUS_M } from "./dishes";
import type { RestaurantSummary } from "./types";

// Bước 4 — rerank. Thuần JS, không chạm DB → test được không cần Postgres. Tầng sinh ứng viên
// (route) đã tính sẵn tín hiệu nhánh MÓN (coverage, matchQuality 0..1) và cheapness; rerank tự
// tính nearness/ratingNorm/tagCoverage từ summary + query. Xem plans/01_5_rank.md.
//
// Khác code cũ: model 6 yếu tố BỎ `sort` (gần/tốt/rẻ) → chỉ còn `wantsCheap` (yếu tố 6). Vậy
// dist/rating là tín hiệu NỀN cố định (luôn cộng W_*_BASE), chỉ cheapness được SORT_BOOST bơm khi
// user muốn "rẻ".

const LIMIT = 50; // số kết quả trả về (plan 01 §5)

// Trọng số. coverage/match/tag là RELEVANCE (nền cao); near/rating là PREFERENCE (nền thấp).
const W_COV = 3;
const W_MATCH = 1.5;
const W_TAG = 1.5; // tỉ lệ tag query (vocab bảng tags) trùng tag quán
const W_DIST = 0.5;
const W_RATING = 0.5;
const W_PRICE_BASE = 0; // cheapness nền 0 → chỉ tác động khi wantsCheap (bơm bằng SORT_BOOST).
const SORT_BOOST = 2;

// Rating Bayesian: kéo rating về prior khi ít lượt rate, để quán 5.0 (3 lượt) không đè quán 4.6
// (2000 lượt). PRIOR ~ avg rating toàn DB; PRIOR_COUNT ~ số lượt "đủ tin" (kéo quán ít rate về prior).
const RATING_PRIOR = 4.3;
const RATING_PRIOR_COUNT = 25;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

export type Candidate = {
  summary: RestaurantSummary; // base fields (kèm distanceM/matchedDishes nếu có)
  coverage?: number; // 0..1: số tên-món-hỏi phủ được / tổng (nhánh MÓN)
  matchQuality?: number; // 0..1: chất lượng khớp ngữ nghĩa món (1 - minDist/threshold)
  cheapness?: number; // 0..1: quán càng rẻ càng cao (từ món rẻ nhất đúng kind); chỉ ca wantsCheap
};

// queryTags: tag vocab trích từ query — cộng điểm theo tỉ lệ trùng tag quán. Rỗng → không tác động.
// wantsCheap (yếu tố 6): bơm trọng số cheapness.
export function rerank(
  candidates: Candidate[],
  wantsCheap: boolean = false,
  queryTags: string[] = [],
): RestaurantSummary[] {
  const wPrice = W_PRICE_BASE + (wantsCheap ? SORT_BOOST : 0);

  const scored = candidates.map((c) => {
    const s = c.summary;
    const nearness =
      s.distanceM != null ? clamp01(1 - s.distanceM / RADIUS_M) : 0;
    // Bayesian: (n*r + m*C)/(n+m), chuẩn hoá /5. Chưa có rating → 0 (không thưởng không phạt).
    const n = s.ratingCount ?? 0;
    const ratingNorm =
      s.rating != null
        ? (n * Number(s.rating) + RATING_PRIOR_COUNT * RATING_PRIOR) /
          (n + RATING_PRIOR_COUNT) /
          5
        : 0;
    // Tỉ lệ tag query có trong tag quán (0..1). Quán chưa gán tag → 0.
    const sTags = s.tags ?? [];
    const tagCoverage = queryTags.length
      ? queryTags.filter((t) => sTags.includes(t)).length / queryTags.length
      : 0;
    const score =
      W_COV * (c.coverage ?? 0) +
      W_MATCH * (c.matchQuality ?? 0) +
      W_TAG * tagCoverage +
      W_DIST * nearness +
      W_RATING * ratingNorm +
      wPrice * (c.cheapness ?? 0);
    return { s, score };
  });

  // Tie-break xác định: điểm bằng → rating cao hơn → nhiều lượt rate hơn.
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      Number(b.s.rating ?? 0) - Number(a.s.rating ?? 0) ||
      (b.s.ratingCount ?? 0) - (a.s.ratingCount ?? 0),
  );
  return scored.slice(0, LIMIT).map((x) => x.s);
}
