-- Plately — search: cột FTS gộp "category món" cho nhánh MÓN (xem plan 07).
--
-- menu_items.search_vec = to_tsvector('simple', lower(category_name || ' ' || name)) — gộp tên
-- CATEGORY (trước) + tên MÓN (sau) vào MỘT tsvector. Lý do: menu Việt hay cắt tên món còn mỗi biến
-- thể ("Tái") dưới category mang phần gốc ("Phở bò") → match trên riêng name trượt "phở bò tái".
-- Gộp lại rồi match cả phraseto (cụm liền kề, đúng thứ tự → khớp chặt) lẫn plainto (đủ token →
-- recall). Nhờ cột này, dishes.ts BỎ nhánh match category-only (token category đã nằm sẵn đây).
--
-- category_name ở BẢNG KHÁC (menu_categories) → generated column không tham chiếu được → phải lưu
-- cột thật + maintain bằng TRIGGER (đúng dù insert qua menuImport hay admin route). Lưu sẵn tsvector
-- (không index biểu thức) để phraseto khỏi recompute to_tsvector mỗi dòng lúc recheck vị trí.
--
-- File này tự chạy khi volume Postgres còn TRỐNG. Với volume đã có dữ liệu, chạy tay:
--   set -a; . ./.env; set +a
--   psql "$DATABASE_URL" -f db/init/04_menu_search_vec.sql

-- 1) Cột mới (additive).
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS search_vec tsvector;

-- 2) Hàm derive: "category món" → tsvector. STABLE (đọc menu_categories theo id). category_id NULL
--    hoặc category đã xoá (ON DELETE SET NULL) → chỉ còn token name.
CREATE OR REPLACE FUNCTION menu_items_search_vec(p_category_id BIGINT, p_name TEXT)
RETURNS tsvector LANGUAGE sql STABLE AS $$
  SELECT to_tsvector('simple', lower(
    coalesce((SELECT category_name FROM menu_categories WHERE id = p_category_id), '')
    || ' ' || coalesce(p_name, '')));
$$;

-- 3) Trigger trên menu_items: đổi name HOẶC category_id → recompute search_vec. BEFORE để ghi thẳng
--    vào NEW (không cần UPDATE lần 2).
CREATE OR REPLACE FUNCTION trg_menu_items_search_vec() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vec := menu_items_search_vec(NEW.category_id, NEW.name);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS menu_items_search_vec_trg ON menu_items;
CREATE TRIGGER menu_items_search_vec_trg
  BEFORE INSERT OR UPDATE OF name, category_id ON menu_items
  FOR EACH ROW EXECUTE FUNCTION trg_menu_items_search_vec();

-- 4) Trigger trên menu_categories: đổi category_name → re-derive các item con. AFTER vì cần id đã có.
CREATE OR REPLACE FUNCTION trg_menu_categories_propagate() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE menu_items
     SET search_vec = menu_items_search_vec(category_id, name)
   WHERE category_id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS menu_categories_propagate_trg ON menu_categories;
CREATE TRIGGER menu_categories_propagate_trg
  AFTER UPDATE OF category_name ON menu_categories
  FOR EACH ROW WHEN (OLD.category_name IS DISTINCT FROM NEW.category_name)
  EXECUTE FUNCTION trg_menu_categories_propagate();

-- 5) Backfill toàn bảng (idempotent — chạy lại cho ra cùng kết quả).
UPDATE menu_items mi SET search_vec = menu_items_search_vec(mi.category_id, mi.name);

-- 6) GIN index phục vụ CẢ phraseto lẫn plainto (cùng @@ trên search_vec).
CREATE INDEX IF NOT EXISTS menu_items_search_vec_idx
  ON menu_items USING GIN (search_vec);

-- Ghi chú: index menu_items_name_fts_idx (trên to_tsvector(lower(name))) trở nên DƯ THỪA với nhánh
-- MÓN sau thay đổi này. GIỮ lại lần này; drop là bước cleanup riêng (schema change thu hẹp đi 2 bước).
