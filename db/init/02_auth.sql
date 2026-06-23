-- Plately — auth: bảng users cho đăng nhập Google (Auth.js / NextAuth v5).
--
-- Giai đoạn 1: chỉ Google OAuth. Session dùng JWT nên KHÔNG cần bảng
-- accounts/sessions của adapter — chỉ cần lưu hồ sơ user + role tại đây.
-- Mỗi lần đăng nhập sẽ upsert theo email (xem app/src/auth.ts).
--
-- File này tự chạy khi volume Postgres còn TRỐNG. Với volume đã có dữ liệu,
-- chạy tay: docker exec -i plately_postgres psql -U $POSTGRES_USER -d $POSTGRES_DB < db/init/02_auth.sql

CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL PRIMARY KEY,

  email         TEXT UNIQUE NOT NULL,
  name          TEXT,
  image         TEXT,

  -- Phân quyền: 'admin' (bạn) | 'owner' (chủ quán) | 'user' (khách đặt món).
  -- Mặc định 'user'; nâng quyền bằng UPDATE tay hoặc qua ADMIN_EMAILS lúc đăng nhập.
  role          TEXT NOT NULL DEFAULT 'user'
                  CHECK (role IN ('admin', 'owner', 'user')),

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);
