# 01 — Schema: cột `search_vec` + trigger + backfill + GIN index

## Vì sao

Cột gộp `category_name + name` là nền của cả feature. Vì `category_name` ở bảng khác
(`menu_categories`), **generated column không tham chiếu được** → phải lưu cột thật và maintain
bằng **trigger** (giữ đúng dù insert qua path nào: menuImport, 2 admin route). Lưu sẵn tsvector
(không index biểu thức) để phraseto khỏi recompute lúc recheck vị trí.

## Việc

Tạo **`db/init/04_menu_search_vec.sql`** (additive, mọi lệnh `IF NOT EXISTS`/`CREATE OR REPLACE`):

1. `ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS search_vec tsvector;`
2. Hàm derive `menu_items_search_vec(category_id, name) RETURNS tsvector` (STABLE, SQL):
   `to_tsvector('simple', lower(coalesce(category_name,'') || ' ' || coalesce(name,'')))`,
   category lấy bằng subquery theo `category_id` (NULL → chỉ name).
3. Trigger `BEFORE INSERT OR UPDATE OF name, category_id ON menu_items` → set
   `NEW.search_vec = menu_items_search_vec(NEW.category_id, NEW.name)`.
4. Trigger `AFTER UPDATE OF category_name ON menu_categories` → `UPDATE menu_items SET search_vec
   = menu_items_search_vec(category_id, name) WHERE category_id = NEW.id` (re-derive item con khi
   đổi tên category).
5. Backfill: `UPDATE menu_items mi SET search_vec = menu_items_search_vec(mi.category_id, mi.name);`
6. `CREATE INDEX IF NOT EXISTS menu_items_search_vec_idx ON menu_items USING GIN (search_vec);`
7. Comment đầu file: thứ tự nối "category món" + ghi chú index cũ `menu_items_name_fts_idx` dư
   thừa với nhánh MÓN, **giữ lại** (drop là bước cleanup riêng theo §4 AGENTS).

Sau khi viết: **chạy tay lên DB dev** (file `db/init/*` chỉ auto-run khi volume trống; DB hiện
đã có dữ liệu). Dùng `query()`/psql tham số hoá đúng convention; trong file SQL seed không có
input động nên không cần `$n`.

## Commit

`6d56788` — feat(search): thêm cột search_vec gộp category+tên món + trigger

## Done khi

- File `db/init/04_menu_search_vec.sql` tồn tại, chạy idempotent (chạy 2 lần không lỗi).
- Trên DB dev: `search_vec` populated cho mọi `menu_items` (kiểm `COUNT(*) WHERE search_vec IS NULL`
  = 0 với item có name).
- Đổi thử một `menu_categories.category_name` → `search_vec` của item con đổi theo (trigger chạy).
- `EXPLAIN ANALYZE SELECT ... WHERE search_vec @@ plainto_tsquery('simple','phở bò tái')` cho
  **Bitmap Index Scan on menu_items_search_vec_idx** (không Seq Scan).
