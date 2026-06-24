-- Plately — admin: liên kết chủ sở hữu quán (owner) cho trang quản trị (xem plan 04).
--
-- Bảng nối nhiều-nhiều giữa users và restaurants: 1 user có thể sở hữu nhiều quán,
-- 1 quán có thể có nhiều owner. role='admin' bỏ qua bảng này (toàn quyền); role='owner'
-- chỉ sửa được quán có dòng khớp ở đây (xem app/src/lib/authz.ts).
--
-- File này tự chạy khi volume Postgres còn TRỐNG. Với volume đã có dữ liệu, chạy tay:
--   set -a; . ./.env; set +a
--   psql "$DATABASE_URL" -f db/init/03_admin.sql

CREATE TABLE IF NOT EXISTS restaurant_owners (
  restaurant_id BIGINT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id       BIGINT NOT NULL REFERENCES users(id)       ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (restaurant_id, user_id)
);

-- Liệt kê quán theo owner (trang /admin của chủ quán).
CREATE INDEX IF NOT EXISTS restaurant_owners_user_idx
  ON restaurant_owners (user_id);

-- Seed thủ công để test (thay <user_id>/<restaurant_id> bằng giá trị thật):
--   INSERT INTO restaurant_owners (restaurant_id, user_id) VALUES (1, 2)
--     ON CONFLICT DO NOTHING;
--   UPDATE users SET role = 'owner' WHERE id = 2 AND role = 'user';
