-- Plately — quán yêu thích của user.
--
-- Mỗi user đánh dấu nhiều quán; mỗi (user, quán) tối đa 1 dòng (PK kép). Xoá user/quán →
-- cascade dọn favorite. Index theo user để liệt kê nhanh "quán yêu thích của tôi".
--
-- Additive (§4): KHÔNG sửa các file db/init/*.sql đã apply. File này tự chạy khi volume Postgres
-- còn TRỐNG. Với volume đã có dữ liệu, chạy tay:
--   set -a; . ./.env; set +a
--   psql "$DATABASE_URL" -f db/init/13_favorites.sql

CREATE TABLE IF NOT EXISTS user_favorites (
  user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  restaurant_id BIGINT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, restaurant_id)
);

CREATE INDEX IF NOT EXISTS user_favorites_user_idx
  ON user_favorites (user_id, created_at DESC);
