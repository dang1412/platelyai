-- Plately — phase 2 của plan 09: DROP cột trục food/drink cứng sau khi code đã ngừng đọc/ghi.
--
-- Tiền đề (AGENTS §4 — DROP qua 2 bước): các commit task 02–06 đã bỏ HẾT tham chiếu
-- serves_food/serves_drink (restaurants) và kind (menu_categories) trong code app. Search dùng
-- type-tag mềm (db/init/09_type_tags.sql), admin không còn nhập các cột này.
--
-- CHỈ chạy file này SAU khi code mới đã deploy & chạy ổn (nếu rollback code cũ thì cột đã mất →
-- vỡ). File tự chạy khi volume Postgres còn TRỐNG (sau 01_schema tạo cột rồi 10 này drop ngay —
-- chấp nhận, KHÔNG sửa 01_schema đã apply). Với volume đã có dữ liệu, chạy tay:
--   set -a; . ./.env; set +a
--   psql "$DATABASE_URL" -f db/init/10_drop_food_drink_cols.sql
-- Idempotent (IF EXISTS) → chạy lại an toàn.

-- restaurants.serves_food / serves_drink (+ index gộp).
DROP INDEX IF EXISTS restaurants_serves_idx;
ALTER TABLE restaurants
  DROP COLUMN IF EXISTS serves_food,
  DROP COLUMN IF EXISTS serves_drink;

-- menu_categories.kind (+ index). CHECK constraint gắn với cột tự mất theo DROP COLUMN.
DROP INDEX IF EXISTS menu_categories_kind_idx;
ALTER TABLE menu_categories
  DROP COLUMN IF EXISTS kind;
