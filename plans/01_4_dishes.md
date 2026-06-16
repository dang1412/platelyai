# Plan 01.4 — Dishes (nhánh MÓN: tên món → menu_items khớp)

> Bước 4 (nhánh MÓN) của [Search API](./01_search_api.md). Files: `app/src/lib/dishes.ts`, `app/src/lib/db.ts`.
> Trạng thái: **✅ xong** — 7/7 test xanh (dedup, ngưỡng KNN, lexical name/category, filter, origin, no-key), typecheck sạch.

## Mục tiêu

Map mỗi tên món user hỏi (`parsed.dishes`) về các `menu_items` khớp, để bước rank gom về quán
(coverage + matchedDishes chip). Chạy khi `dishes` không rỗng.

## Input / Output

```ts
function resolveDishes(
  dishes: string[],
  maxPrice: number | null,        // yếu tố 5 — lọc cứng giá MỘT món
  category: FoodCategory | null,  // yếu tố 1 — lọc cứng mc.kind
  origin: LatLng | null,          // chỉ để ORDER lexical, KHÔNG lọc bán kính
): Promise<MatchedDish[]>          // các menu_items khớp, đã dedup theo itemId
```

`MatchedDish = { itemId, restaurantId, name, price, dist, queryDish }`.

## Thiết kế

Gom từ **2 nguồn**, dedup theo `itemId` giữ `dist` nhỏ nhất:

1. **Semantic KNN** trên `menu_items.embedding` — embed `"Món: <tên>"` (khớp dạng đã sinh embedding
   trong DB, xem [01_3_embed](./01_3_embed.md)). `ORDER BY embedding <=> vec LIMIT DISH_TOP_K`, giữ
   `dist <= DISH_DIST_THRESHOLD`. Bỏ qua nếu `embedMany` trả `null` (thiếu key) → vẫn còn lexical.
2. **Lexical (FTS)** — tên món khớp **ranh giới từ CÓ DẤU** trong `mi.name` (`dist=0`, mạnh nhất)
   hoặc trong `menu_categories.category_name` (`dist=LEX_CATEGORY_DIST`, cho ca tên món bị cắt theo
   category). Dùng full-text `to_tsvector('simple', lower(name)) @@ phraseto_tsquery(...)`: token theo
   phi-alnum + GIỮ DẤU → đúng ngữ nghĩa ranh-giới-từ ("chè" ⊄ "cheese") **và** dùng được GIN index
   (sublinear, không seq scan — xem perf dưới). Hai nhánh (name / category) tách **`UNION ALL`** để mỗi
   nhánh hit index riêng. **Đồng nghĩa thủ công** (`rán`↔`chiên`, `bún riêu`↔`bún cua`…) cộng vào
   nhánh này — xem [01_4b_synonyms](./01_4b_synonyms.md).

**Lọc cứng NGAY trong SQL** (không lọc sau — có `LIMIT DISH_TOP_K` thì lọc sau đánh rơi món xếp > K):
- `maxPrice` → `mi.price <= $n` (price NULL bị loại khi có maxPrice).
- `category` → `mc.kind = $n` (**quyết định 01 §6.2**); KNN JOIN `menu_categories`, lexical dùng
  subquery `category_id IN (SELECT id FROM menu_categories WHERE kind=$n)`.

**Lọc cứng bán kính `RADIUS_M` khi có `origin`** (`ST_DWithin`, INNER JOIN restaurants) trên **cả
KNN lẫn lexical** — sửa lại quyết định 01 §6.4 (xem ghi chú dưới). Quán `location` NULL bị loại.
Không origin → lexical JOIN `restaurants` lấy rating, `ORDER BY rating DESC NULLS LAST, id` (giữ quán
tốt khi cắt `LIMIT DISH_TOP_K` thay vì tùy tiện theo id; tie-break `id` cho xác định). KNN không origin
giữ `ORDER BY embedding <=> vec` (đã là độ liên quan ngữ nghĩa).

> **Vì sao lọc cứng trong query, không để rank cắt sau:** KNN HNSW trả TOP_K theo embedding trên
> TOÀN DB, không biết địa lý. Khi data lên nhiều vùng, món phổ biến ("trà sữa") có hàng nghìn match
> toàn quốc → TOP_K bị vùng khác chiếm, **món địa phương rớt khỏi ứng viên** (Meiko bug) — rank
> không cứu được vì đã mất. Lọc `ST_DWithin` ngay trong query vừa đúng recall vừa giảm số
> `menu_items` phải scan. `RADIUS_M=1500` là 1 nguồn sự thật (rank.ts import lại để chuẩn nearness).

## Hằng số (tunable)

| Tên | Giá trị | Ý nghĩa |
|---|---|---|
| `DISH_TOP_K` | 150 | ứng viên KNN mỗi tên món |
| `DISH_DIST_THRESHOLD` | 0.30 | ngưỡng giữ món (recall) |
| `COVERAGE_DIST_THRESHOLD` | 0.20 | ngưỡng "khớp chắc" để tính coverage (rank dùng) |
| `LEX_CATEGORY_DIST` | 0.05 | dist món match qua tên category |
| `SYN_LEX_DIST` | 0.03 | dist món match qua đồng nghĩa ([01_4b](./01_4b_synonyms.md)) |

## db.ts

`pg` thuần (đã bỏ drizzle, plan 01 §4): `Pool` tái dùng qua hot-reload + `query<T>(sql, params)` trả
thẳng `rows`. SQL viết tay, tham số hoá `$1,$2…`.

## Khác code cũ (`old/app/src/lib/dishes.ts`)

- **Thêm** lọc cứng `mc.kind = category` (cũ KHÔNG lọc kind).
- **Giữ** lọc cứng bán kính `ST_DWithin RADIUS_M` khi có origin (giống cũ) — đã cân nhắc bỏ theo
  plan 01 §6.4 nhưng đảo lại vì recall + perf (xem ghi chú trên).
- `drizzle sql` → `pg` parameterized.

## Perf lexical khi scale (✅ đã giải bằng FTS + UNION ALL)

Trước đây nhánh lexical **seq scan toàn `menu_items`** khi không origin (3 nguyên nhân chồng nhau:
sai cột index — trgm trên `normalized_name` KHÔNG dấu ≠ query có dấu; thiếu btree `category_id`; hình
dạng `OR … IN (subquery)` ép `BitmapOr` fail). Đo thật "gà rán" no-origin: **40ms, bỏ ~10.900 dòng qua
filter regex**. Pilot vài chục nghìn món thì chấp nhận, nhưng tuyến tính → triệu món thành giây.

**Giải pháp đã làm** (cả cụm, không chỉ 1 index):
1. **FTS thay regex**: `to_tsvector('simple', lower(name)) @@ phraseto_tsquery('simple', <biến thể>)`.
   `simple` = token theo phi-alnum, KHÔNG stem/stopword, **giữ dấu** → đúng ngữ nghĩa ranh-giới-từ cũ
   (verify: FTS cho **đúng 445 món y hệt regex**, 0 lệch). Khác trgm regex: GIN extract token đoán định,
   index dùng được chắc chắn (trgm trên anchored-alternation `~` trích trigram kém).
2. **Index** (`db/init/01_schema.sql`): `menu_items_name_fts_idx` GIN `to_tsvector('simple',lower(name))`,
   `menu_categories_name_fts_idx` tương tự, btree `menu_items_category_id_idx`. Biểu thức index PHẢI
   khớp đúng query.
3. **Tách `OR` → `UNION ALL`**: nhánh name (FTS GIN) ⊎ nhánh category (FTS trên `menu_categories` →
   `mi.category_id IN (…)` dùng btree). `add()` dedup itemId trùng giữa 2 nhánh theo dist nhỏ nhất.

`EXPLAIN ANALYZE` xác nhận: **không còn Seq Scan**, đều Bitmap Index Scan / Index Scan, **40ms → 9.6ms**
(và sublinear theo số match, không theo size bảng). Ca có origin vốn đã ổn (GIST `ST_DWithin` lọc trước).

> **Không** rút gọn thành lexical-chỉ-category: mất arm name = mất khớp tên CÓ DẤU `dist=0` — giá trị
> chính của tầng lexical, đẩy hết gánh nặng match tên sang KNN (vốn hay xếp tên khớp thấp).
> Index cũ `menu_items_normalized_name_trgm_idx` (không dấu) nay không query nào dùng — giữ vì script
> sinh embedding còn ghi `normalized_name`; có thể drop sau.

## Test (`app/src/lib/dishes.test.ts`, vitest — mock `./db` + `./embed`)

dishes rỗng → `[]` không gọi DB · dedup giữ dist nhỏ · KNN bỏ `dist > threshold` · lexical name=0 /
category=0.05 · `maxPrice+category` đẩy đúng JOIN/kind/params · origin → `ST_DWithin` trên CẢ KNN
lẫn lexical · không origin → không chạm restaurants · embed `null` → chỉ lexical.
