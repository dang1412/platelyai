# 02 — `dishes.ts`: match trên `search_vec`, bỏ nhánh category-only

## Vì sao

Cột `search_vec` đã chứa token `category + name`, nên match tên món chuyển sang chạy trên cột này
và **nhánh category-only thừa** → bỏ. Thêm tier plainto để recall ca thứ-tự-khác / bỏ-từ-giữa.

## Việc

Trong `app/src/lib/dishes.ts`, nhánh lexical của `resolveDishes`:

- **Hằng số:**
  - Xoá `LEX_CATEGORY_DIST` (không còn nhánh category).
  - Thêm `LOOSE_LEX_DIST = 0.12` (plainto-only; < `COVERAGE_DIST_THRESHOLD = 0.2` → vẫn tính phủ).
  - Giữ `SYN_LEX_DIST = 0.03`.
- **Gate (WHERE):** đổi từ `to_tsvector('simple', lower(mi.name)) @@ phraseto(...)` sang
  **`mi.search_vec @@ plainto_tsquery('simple', $..)`** OR theo các biến thể `expandSynonyms`
  (plainto rộng hơn phraseto nên là gate đủ; vẫn hit `menu_items_search_vec_idx`).
- **Cờ trong SELECT** (trên cùng `mi.search_vec`):
  - `name_exact = mi.search_vec @@ phraseto_tsquery('simple', $1)` (query gốc = variants[0]).
  - `name_phrase = mi.search_vec @@ (phraseto OR các biến thể)` (thay cho `name_any` cũ).
- **Bỏ UNION ALL category-only** (nhánh thứ 2 match `mi.category_id IN (SELECT ... category_name
  @@ ...)`). Còn một nhánh → query gọn hơn, không cần `UNION ALL`.
- `kindFilter` (lọc `kind` food/drink qua `menu_categories`), `priceFilter`, geo (`ST_DWithin`/
  `ST_Distance`), cap `DISH_PER_RESTAURANT`, `orderClause`: **giữ nguyên**. `capOrder` đổi tham
  chiếu `u.name_any` → `u.name_phrase`.
- **Gán dist:** `add(r, r.name_exact ? 0 : r.name_phrase ? SYN_LEX_DIST : LOOSE_LEX_DIST, queryDish)`.
- Cập nhật comment khối (dòng ~42–58, 118–124) cho khớp: một nguồn FTS (`search_vec`), plainto =
  recall tier, không còn category-only.

**MUST:** chỉ qua `query()`, tham số hoá `$n` cho mọi biến thể/filter; không nội suy chuỗi
(RADIUS_M hằng nội bộ giữ như cũ). Không tạo Pool mới.

## Commit

`da00dd4` — feat(search): match nhánh MÓN trên search_vec (phraseto + plainto), bỏ category-only

## Done khi

- `dishes.ts` không còn `LEX_CATEGORY_DIST`, không còn UNION category-only; có `LOOSE_LEX_DIST`.
- Query dùng `mi.search_vec`; WHERE có `plainto_tsquery`; SELECT có `phraseto_tsquery`.
- `pnpm build` (TS) xanh. (Test ở task 03.)
