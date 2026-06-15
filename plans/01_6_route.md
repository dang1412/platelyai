# Plan 01.6 — Route (orchestrator + sinh ứng viên)

> Bước cuối của [Search API](./01_search_api.md). Files: `app/src/app/api/search/route.ts`,
> `app/src/lib/candidates.ts`, `app/src/lib/tags.ts`.
> Trạng thái: **✅ xong** — 6/6 test (assembleDishCandidates), typecheck + lint sạch.

## Luồng (một luồng duy nhất, bỏ hết "mode" cũ)

```
GET /api/search?q=…[&lat=&lng=]
  [1] PARSE    loadTagVocab() → extractQuery(q, vocab) → ParsedQuery (6 yếu tố)
  [2] ORIGIN   coords(lat,lng) ─or─ geocode(parsed.location) → LatLng | null
  [3] CANDS    dishes.length>0 → candidatesFromDishes : candidatesNearbyOrTop
  [4] RANK     rerank(candidates, parsed.wantsCheap, parsed.tags) → top 50
  → { parsed, results }
```

`coordsFromParams`: `lat,lng` hợp lệ (validate range) thắng; không có → geocode `location`.

## `tags.ts` — vocab loader

`loadTagVocab()`: `SELECT name FROM tags`, cache trong process. Lỗi DB → `[]` và KHÔNG cache (thử
lại sau). Nhồi vào prompt extract + validate yếu tố `tags`.

## `candidates.ts` — sinh ứng viên (2 nhánh)

### Nhánh MÓN — `candidatesFromDishes(parsed, origin)`
1. `resolveDishes(...)` → `MatchedDish[]` (đã lọc bán kính/giá/kind ở [01_4](./01_4_dishes.md)).
2. Fetch summary các quán theo id món khớp (+ `distanceM` nếu origin). **Không** lọc `serves_*` —
   item đã định hướng loại; `serves_*` (Google, nhiễu) sẽ loại oan quán có món.
3. **`assembleDishCandidates`** (THUẦN, test được): gom item về quán →
   - `coverage` = số `queryDish` khớp CHẮC (`dist ≤ COVERAGE_DIST_THRESHOLD`) / tổng món hỏi.
   - `matchQuality` = `1 - minDist/DISH_DIST_THRESHOLD`.
   - `matchedDishes` = ≤3 chip, ưu tiên `dist` nhỏ; có `maxPrice` thì đồng-dist ưu tiên món **sát
     giá trần** (đỡ chip nước chấm rẻ). Quán không fetch được (ngoài bán kính) → bỏ.

### Nhánh QUÁN — `candidatesNearbyOrTop(parsed, origin)`
- **maxPrice** → `EXISTS` món đúng kind `≤ giá`; bỏ `serves_*`. Chip món **đắt nhất ≤ trần**.
- **không maxPrice** → lọc loại bằng `serves_food/serves_drink = true` (gate cấp quán).
- **origin** → `ST_DWithin RADIUS_M` + `distanceM`; **không origin** → top `POOL_LIMIT=100` theo
  `rating_count/rating`.
- **wantsCheap** (không maxPrice) → chip 3 món **rẻ nhất** đúng kind + `cheapness = 1 - minPrice/CHEAP_REF`.

## Known limit — quán CHƯA có menu

| Ca query | Quán không menu | Vì sao |
|---|---|---|
| Nhánh MÓN | ❌ không bao giờ match | mọi tín hiệu (KNN + lexical) trên `menu_items`; không item → vô hình, kể cả khi quán thật sự bán món đó |
| Nhánh QUÁN, không giá | ✅ match | `serves_*` từ Google, không cần menu |
| Nhánh QUÁN + maxPrice | ❌ bị loại | `EXISTS` cần dữ liệu giá (cố ý) |
| Nhánh QUÁN + wantsCheap | ⚠️ trong pool, `cheapness=0`, không chip | thiếu menu để tính |

Lưu ý: nhánh QUÁN có category lọc `serves_* = true` (chặt) → quán `serves_* = NULL` cũng bị loại.
**Hướng vá tương lai** (ngoài scope): nhánh MÓN lexical thêm trên `restaurants.name` ("phở" → "Phở
Thìn") để bắt quán không-menu mà tên đã lộ món.

## Test (`app/src/lib/candidates.test.ts`, vitest — thuần)

coverage chỉ đếm khớp chắc · matchQuality từ minDist · chip ≤3 ưu tiên dist · maxPrice → đồng-dist
ưu tiên sát trần · quán ngoài summaryById bị bỏ · dedup item theo tên giữ dist nhỏ nhất.
