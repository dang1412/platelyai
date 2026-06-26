-- Plately — type-tags thay trục food/drink cứng (xem plan 09).
--
-- Bỏ trục cứng serves_food/serves_drink + menu_categories.kind + field ParsedQuery.category;
-- food/drink giờ là TAG mềm trong bảng tags (rank cộng điểm như tag vibe, rank.ts W_TAG):
--   • "quán ăn" / "giải khát"  → type-tag extract gắn khi câu KHÔNG có tên món cụ thể.
--   • "tráng miệng" / "ăn vặt" → tag vibe THƯỜNG (chỉ cần tồn tại trong vocab; Gemini dùng tự do).
--
-- Backfill restaurant_tags CHỈ cho quán ăn ← serves_food, giải khát ← serves_drink (nguồn duy
-- nhất còn trên restaurants). "tráng miệng"/"ăn vặt" không có cột nguồn → để trống, admin gắn sau.
--
-- File này tự chạy khi volume Postgres còn TRỐNG. Với volume đã có dữ liệu, chạy tay:
--   set -a; . ./.env; set +a
--   psql "$DATABASE_URL" -f db/init/09_type_tags.sql
-- Idempotent (ON CONFLICT DO NOTHING) → chạy lại an toàn.
--
-- DROP các cột serves_food/serves_drink/kind tách sang phase 2 (db/init/10_*.sql), chỉ chạy sau
-- khi code mới đã ngừng đọc/ghi (AGENTS §4 — DROP qua 2 bước).

-- 1) Thêm 4 tag vào vocab (tags.name UNIQUE → bỏ qua tag đã có).
INSERT INTO tags (name) VALUES
  ('quán ăn'),
  ('giải khát'),
  ('tráng miệng'),
  ('ăn vặt')
ON CONFLICT (name) DO NOTHING;

-- 2) Backfill restaurant_tags từ serves_food/serves_drink (PK (restaurant_id, tag_id) → idempotent).
INSERT INTO restaurant_tags (restaurant_id, tag_id)
SELECT r.id, t.id
  FROM restaurants r
  JOIN tags t ON t.name = 'quán ăn'
 WHERE r.serves_food = true
ON CONFLICT DO NOTHING;

INSERT INTO restaurant_tags (restaurant_id, tag_id)
SELECT r.id, t.id
  FROM restaurants r
  JOIN tags t ON t.name = 'giải khát'
 WHERE r.serves_drink = true
ON CONFLICT DO NOTHING;
