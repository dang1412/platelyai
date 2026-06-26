# 03 — Test: unit (mock) cập nhật tier + integration Postgres thật

## Vì sao

Đổi cách match + bỏ một nhánh → test cũ (assert category-only, `LEX_CATEGORY_DIST`) sẽ sai. Cần
khoá lại 3 tier dist mới + verify thật cột/trigger/index trên Postgres (SQL/schema không mock được).

## Việc

### Unit — `app/src/lib/dishes.test.ts` (mock DB như hiện tại)

- **Bỏ** case "match qua tên category → LEX_CATEGORY_DIST" và import `LEX_CATEGORY_DIST`.
- Sửa case dedup/synonym cho khớp cờ mới (`name_exact` / `name_phrase`).
- Thêm/chỉnh assert:
  - WHERE query có `plainto_tsquery`; SELECT có `phraseto_tsquery`; SQL có `mi.search_vec`;
    **không** còn `UNION ALL` category-only.
  - phraseto query gốc → `dist 0`; phraseto biến thể đồng nghĩa → `SYN_LEX_DIST`; chỉ plainto →
    `LOOSE_LEX_DIST` (route rows mock với cờ `name_exact`/`name_phrase` tương ứng).
- Giữ các case còn hợp lệ: maxPrice/category filter, wantsCheap cap, origin ST_DWithin/ST_Distance.

### Integration — Postgres thật (test DB)

Đặt cạnh nguồn theo convention (vd `dishes.integration.test.ts` hoặc bổ sung vào suite integration
đang có — theo cách project đang chạy integration). Seed tối thiểu rồi assert:

- Quán có category "Phở bò", món name "Tái":
  - `resolveDishes(["phở bò tái"])` → trả món đó với `dist === 0` (phraseto khớp cụm liền kề).
  - `resolveDishes(["phở tái"])` (bỏ "bò") → cùng món với `dist === LOOSE_LEX_DIST` (plainto-only).
- Trigger: `UPDATE menu_categories SET category_name='Phở gà' WHERE id=...` → `search_vec` item con
  đổi → `resolveDishes(["phở gà tái"])` khớp, `["phở bò tái"]` không còn phraseto-khớp.
- EXPLAIN: gate plainto dùng `menu_items_search_vec_idx` (Bitmap Index Scan).

## Done khi

- `pnpm test` xanh (unit + integration).
- Không còn tham chiếu `LEX_CATEGORY_DIST` trong test.
- Integration chứng minh phraseto→0, plainto-only→LOOSE, trigger cập nhật search_vec.
