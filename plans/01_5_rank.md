# Plan 01.5 — Rank (rerank ứng viên → top kết quả)

> Bước 4 của [Search API](./01_search_api.md). File: `app/src/lib/rank.ts`.
> Trạng thái: **✅ xong** — 11/11 test xanh (coverage, Bayesian 2 chiều, nearness, tag, cheap, LIMIT, tie-break), typecheck sạch.

## Mục tiêu

Cho danh sách ứng viên (cả nhánh MÓN lẫn QUÁN, có/không origin), tính một điểm tổng có trọng số rồi
cắt top `LIMIT`. **Thuần JS, không chạm DB** → test không cần Postgres. Tầng route đã tính sẵn tín
hiệu nhánh MÓN (`coverage`, `matchQuality`) và `cheapness`; rank tự tính `nearness`/`ratingNorm`/
`tagCoverage` từ summary + query.

## Input / Output

```ts
type Candidate = {
  summary: RestaurantSummary;  // base fields (kèm distanceM/matchedDishes nếu có)
  coverage?: number;           // 0..1 — nhánh MÓN
  matchQuality?: number;       // 0..1 — nhánh MÓN
  cheapness?: number;          // 0..1 — chỉ ca wantsCheap
};

function rerank(
  candidates: Candidate[],
  wantsCheap?: boolean,        // yếu tố 6 — bơm trọng số cheapness
  queryTags?: string[],        // yếu tố 3 — tag vocab trích từ query
): RestaurantSummary[]
```

## Công thức điểm

```
score = W_COV·coverage + W_MATCH·matchQuality + W_TAG·tagCoverage
      + W_DIST·nearness + W_RATING·ratingNorm + wPrice·cheapness
```

| Tín hiệu | Nguồn | Công thức |
|---|---|---|
| `coverage` (relevance) | route, nhánh MÓN | số tên-món-hỏi phủ / tổng |
| `matchQuality` | route, nhánh MÓN | `1 - minDist/threshold` |
| `tagCoverage` (yếu tố 3) | `queryTags ∩ summary.tags` | tỉ lệ trùng (0..1) |
| `nearness` | `distanceM` | `clamp01(1 - d/RADIUS_M)`; null → 0 |
| `ratingNorm` | rating Bayesian | xem dưới |
| `cheapness` (yếu tố 6) | route | nền 0, chỉ tính khi `wantsCheap` |

**Trọng số** (plan 01 §5, tunable): `W_COV=3`, `W_MATCH=1.5`, `W_TAG=1.5`, `W_DIST=0.5`,
`W_RATING=0.5`, `W_PRICE_BASE=0` + `SORT_BOOST=2` khi `wantsCheap`. coverage/match/tag là RELEVANCE
(nền cao); near/rating là PREFERENCE (nền thấp).

## Rating Bayesian (shrinkage về prior)

```
ratingNorm = (n·r + m·C) / (n + m) / 5        C = RATING_PRIOR (4.3), m = RATING_PRIOR_COUNT (25)
```
Kéo rating về prior `C` khi ít lượt rate `n`, để quán 5.0 (3 lượt) không đè quán 4.6 (2000 lượt).
Hệ quả **cố ý** (không phải "nhiều lượt luôn thắng"):
- rating **≥ prior** → nhiều lượt rate thắng (ít bị kéo xuống).
- rating **< prior** → ÍT lượt thắng (được kéo *lên* gần prior, benefit-of-doubt); quán nhiều lượt
  giữ ở rating thật.

Chưa có rating → `ratingNorm = 0` (không thưởng không phạt).

## Sắp xếp & cắt

Sort giảm dần theo `score`; **tie-break xác định**: `score` bằng → `rating` cao hơn → `ratingCount`
nhiều hơn. Cắt `slice(0, LIMIT)` với `LIMIT = 50`.

## Khác code cũ (`old/app/src/lib/rank.ts`)

- Model 6 yếu tố **bỏ `sort` array** (gần/tốt/rẻ) → chỉ còn `wantsCheap`. Vậy `dist`/`rating` là tín
  hiệu **nền cố định** (luôn `W_*_BASE`), chỉ `cheapness` được `SORT_BOOST` bơm. (Cũ bơm cả 3 theo
  `sort`.)
- `RADIUS_M` import từ [`dishes.ts`](../app/src/lib/dishes.ts) (1 nguồn sự thật, dùng chung lọc cứng
  + chuẩn hoá nearness). `LIMIT` 30 → **50**.

## Test (`app/src/lib/rank.test.ts`, vitest — thuần, không mock)

rỗng → `[]` · coverage thắng rating cao · Bayesian nhiều lượt thắng 5.0-ít-lượt · cùng rating TRÊN
prior → nhiều lượt thắng · cùng rating DƯỚI prior → ít lượt thắng · nearness gần thắng / null→0 ·
tagCoverage nhiều trùng thắng · cheapness chỉ khi `wantsCheap` · cắt LIMIT 50 · tie-break rating /
ratingCount.
