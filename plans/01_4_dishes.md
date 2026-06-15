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
2. **Lexical** — tên món khớp **ranh giới từ CÓ DẤU** trong `mi.name` (`dist=0`, mạnh nhất) hoặc
   trong `menu_categories.category_name` (`dist=LEX_CATEGORY_DIST`, cho ca tên món bị cắt theo
   category). KHÔNG substring + unaccent ("chè" lọt "cheese"). Regex được escape.

**Lọc cứng NGAY trong SQL** (không lọc sau — có `LIMIT DISH_TOP_K` thì lọc sau đánh rơi món xếp > K):
- `maxPrice` → `mi.price <= $n` (price NULL bị loại khi có maxPrice).
- `category` → `mc.kind = $n` (**quyết định 01 §6.2**); KNN JOIN `menu_categories`, lexical dùng
  subquery `category_id IN (SELECT id FROM menu_categories WHERE kind=$n)`.

**Lọc cứng bán kính `RADIUS_M` khi có `origin`** (`ST_DWithin`, INNER JOIN restaurants) trên **cả
KNN lẫn lexical** — sửa lại quyết định 01 §6.4 (xem ghi chú dưới). Quán `location` NULL bị loại.
Không origin → `ORDER BY mi.id` (xác định, tránh Postgres trả tuỳ thứ tự vật lý).

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

## db.ts

`pg` thuần (đã bỏ drizzle, plan 01 §4): `Pool` tái dùng qua hot-reload + `query<T>(sql, params)` trả
thẳng `rows`. SQL viết tay, tham số hoá `$1,$2…`.

## Khác code cũ (`old/app/src/lib/dishes.ts`)

- **Thêm** lọc cứng `mc.kind = category` (cũ KHÔNG lọc kind).
- **Giữ** lọc cứng bán kính `ST_DWithin RADIUS_M` khi có origin (giống cũ) — đã cân nhắc bỏ theo
  plan 01 §6.4 nhưng đảo lại vì recall + perf (xem ghi chú trên).
- `drizzle sql` → `pg` parameterized.

## Known limit — perf khi KHÔNG có origin (scale toàn quốc)

- **KNN**: chạy HNSW (`menu_items_embedding_idx`), dưới tuyến tính → ổn dù DB lớn, không có origin
  cũng không lo.
- **Lexical** (`seq scan toàn menu_items` khi không origin) có **3 nguyên nhân chồng nhau**, không
  chỉ thiếu trgm index:
  1. **Sai cột index**: query match `lower(mi.name)` (CÓ dấu, cố ý). Trgm index hiện có là
     `menu_items_normalized_name_trgm_idx` trên `normalized_name` (KHÔNG dấu) → không khớp biểu thức.
  2. **Thiếu index `menu_items.category_id`**: arm category `mi.category_id IN (SELECT … )` cần fetch
     items theo `category_id`, nhưng schema không có index cột này (FK không tự tạo; chỉ có
     `restaurant_id`, `normalized_name`, `embedding`).
  3. **Hình dạng `OR ... IN (subquery)`**: Postgres khó gộp một index-scan (arm name) với một
     semi-join subquery (arm category) vào `BitmapOr` → thường ép **seq scan** dù đã có đủ index.
  Có origin thì `ST_DWithin` lọc restaurants (GIST) trước nên chỉ regex ít món; **không origin →
  regex toàn bảng** × số tên món.
- **Mức độ**: pilot 1 thành phố (vài chục nghìn món) seq scan chỉ vài–vài chục ms → chấp nhận. No-origin
  cũng hiếm (thiết bị thường có toạ độ / geocode ra origin). Rủi ro chỉ ở scale toàn quốc (triệu món).
- **Cách chữa khi cần** (làm CẢ CỤM, không chỉ thêm 1 index):
  1. Trgm GIN đúng biểu thức: `CREATE INDEX … ON menu_items USING GIN (lower(name) gin_trgm_ops);`
     và `CREATE INDEX … ON menu_categories USING GIN (lower(category_name) gin_trgm_ops);`. KHÔNG tái
     dùng `normalized_name` (bỏ dấu, phá chủ đích match có dấu).
  2. Btree `menu_items.category_id` cho arm category.
  3. **Tách `OR` → `UNION`** (hoặc 2 pass): nhánh name dùng trgm(lower(name)), nhánh category dùng
     trgm category + btree category_id — mỗi nhánh hit index riêng.
  `EXPLAIN ANALYZE` xác nhận Seq Scan → Bitmap Index Scan. Chưa làm bây giờ.
  > **Không** rút gọn thành lexical-chỉ-category (rẻ & dễ index hơn vì hết `OR`): mất arm name =
  > mất khớp tên CÓ DẤU `dist=0` — giá trị chính của tầng lexical, đẩy hết gánh nặng match tên sang
  > KNN (vốn hay xếp tên khớp thấp).

## Test (`app/src/lib/dishes.test.ts`, vitest — mock `./db` + `./embed`)

dishes rỗng → `[]` không gọi DB · dedup giữ dist nhỏ · KNN bỏ `dist > threshold` · lexical name=0 /
category=0.05 · `maxPrice+category` đẩy đúng JOIN/kind/params · origin → `ST_DWithin` trên CẢ KNN
lẫn lexical · không origin → không chạm restaurants · embed `null` → chỉ lexical.
